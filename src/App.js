import React, { useState, useEffect } from 'react';
import './App.css';
import { FaUserFriends, FaTimes, FaCar, FaCheckCircle, FaPhone, FaSignOutAlt, FaPlus, FaClock, FaCalendar, FaUser, FaFilter, FaBars, FaHome, FaSearch, FaRoute, FaTicketAlt, FaBell, FaWhatsapp, FaTrash } from 'react-icons/fa';
import { AuthProvider, useAuth } from './AuthContext';

const API_URL = process.env.REACT_APP_API_URL || 'https://bitspool-backend-production.up.railway.app';

function AppContent() {
  const { currentUser, loginWithGoogle, logout, getIdToken, error: authError } = useAuth();
  
  const [currentView, setCurrentView] = useState('home');
  const [selectedRide, setSelectedRide] = useState(null);
  const [rides, setRides] = useState([]);
  const [myRides, setMyRides] = useState([]);
  const [joinedRidesData, setJoinedRidesData] = useState([]); // Separate state for joined rides from API
  const [loading, setLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [userProfile, setUserProfile] = useState({ phoneNumber: null });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [phoneModalOpen, setPhoneModalOpen] = useState(false);
  const [tempPhoneNumber, setTempPhoneNumber] = useState('');
  const [phoneModalCallback, setPhoneModalCallback] = useState(null);
  const [filter, setFilter] = useState('all');
  const [whatsappModal, setWhatsappModal] = useState({ open: false, link: null });
  const [pendingRequests, setPendingRequests] = useState([]);
  const [processingRequest, setProcessingRequest] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [notificationsPanelOpen, setNotificationsPanelOpen] = useState(false);
  
  // State for approval modal (from WhatsApp link)
  const [approvalModal, setApprovalModal] = useState({ 
    open: false, 
    requestId: null, 
    action: null, 
    token: null,
    processing: false,
    result: null
  });
  
  const [formData, setFormData] = useState({
    hostName: '',
    carType: '',
    rideType: 'city',
    origin: '', 
    destination: '',
    date: '',
    time: '',
    seatsTotal: 1,
    contactNumber: ''
  });

  // Filter joined rides from API data - only filter out past rides
  const joinedRides = joinedRidesData.filter(ride => {
    // Filter out past rides (date + time has passed)
    const rideDate = ride.date?.toDate ? ride.date.toDate() : new Date(ride.date);
    const [hours, minutes] = (ride.time || '23:59').split(':').map(Number);
    rideDate.setHours(hours || 23, minutes || 59, 0, 0);
    return rideDate >= new Date();
  });

  const [error, setError] = useState('');

  // Check for approval request in URL on page load
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const requestId = urlParams.get('approve_request');
    const action = urlParams.get('action');
    const token = urlParams.get('token');
    
    if (requestId && action && token) {
      setApprovalModal({ 
        open: true, 
        requestId, 
        action, 
        token,
        processing: false,
        result: null
      });
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Determine ride type for badge
  const getRideType = (ride) => {
    // Check if ride has explicit rideType
    if (ride.rideType) return ride.rideType;
    // Fallback to text detection
    const text = `${ride.origin} ${ride.destination}`.toLowerCase();
    if (text.includes('airport')) return 'airport';
    if (text.includes('station') || text.includes('railway')) return 'station';
    if (text.includes('campus')) return 'campus';
    return 'city';
  };

  // API call helper
  const apiCall = async (endpoint, options = {}) => {
    try {
      const token = await getIdToken();
      const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
          ...options.headers,
        },
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Request failed');
      }
      return await response.json();
    } catch (err) {
      console.error('API Error:', err);
      throw err;
    }
  };

  const fetchRides = async () => {
    if (!currentUser) return;
    try {
      setLoading(true);
      setError('');
      const data = await apiCall('/api/rides');
      const validRides = Array.isArray(data) ? data : [];
      setRides(validRides.reverse());
    } catch (err) {
      setError(`Failed to load rides: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserProfile = async () => {
    if (!currentUser) return;
    try {
      const data = await apiCall('/api/user/profile');
      setUserProfile(data);
      if (!data.phoneNumber) {
        setPhoneModalOpen(true);
        setPhoneModalCallback(() => async (phone) => {
          if (phone) await savePhoneNumber(phone);
        });
      }
    } catch (err) {
      console.error('Error fetching user profile:', err);
    }
  };

  const savePhoneNumber = async (phoneNumber) => {
    try {
      await apiCall('/api/user/profile', {
        method: 'POST',
        body: JSON.stringify({ phoneNumber })
      });
      setUserProfile({ ...userProfile, phoneNumber });
    } catch (err) {
      alert('Failed to save phone number: ' + err.message);
    }
  };

  const fetchMyRides = async () => {
    if (!currentUser) return;
    try {
      setLoading(true);
      const data = await apiCall('/api/my-rides');
      setMyRides(Array.isArray(data) ? data : []);
    } catch (err) {
      setError('Failed to load your rides: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchJoinedRides = async () => {
    if (!currentUser) return;
    try {
      const data = await apiCall('/api/joined-rides');
      setJoinedRidesData(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load joined rides:', err.message);
    }
  };

  const fetchPendingRequests = async () => {
    if (!currentUser) return;
    try {
      const data = await apiCall('/api/my-pending-requests');
      setPendingRequests(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load pending requests:', err.message);
    }
  };

  const handleRespondToRequest = async (requestId, action) => {
    try {
      setProcessingRequest(requestId);
      await apiCall(`/api/requests/${requestId}/respond`, {
        method: 'POST',
        body: JSON.stringify({ action })
      });
      // Refresh data
      fetchPendingRequests();
      fetchMyRides();
      fetchRides();
      alert(`Request ${action === 'approve' ? 'approved' : 'rejected'} successfully!`);
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setProcessingRequest(null);
    }
  };

  const handleCancelRide = async (ride) => {
    const hasPassengers = ride.passengers?.length > 0;
    const confirmMsg = hasPassengers 
      ? `Are you sure you want to cancel this ride? ${ride.passengers.length} passenger(s) will be notified via email.`
      : 'Are you sure you want to cancel this ride?';
    
    if (!window.confirm(confirmMsg)) return;
    
    try {
      setLoading(true);
      await apiCall(`/api/rides/${ride.id}`, { method: 'DELETE' });
      setSelectedRide(null);
      fetchRides();
      fetchMyRides();
      fetchPendingRequests();
      alert('Ride cancelled successfully!');
    } catch (err) {
      alert('Error cancelling ride: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch notifications
  const fetchNotifications = async () => {
    if (!currentUser) return;
    try {
      const data = await apiCall('/api/notifications');
      setNotifications(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load notifications:', err.message);
    }
  };

  // Mark notification as read
  const markNotificationRead = async (notificationId) => {
    try {
      await apiCall(`/api/notifications/${notificationId}/read`, { method: 'POST' });
      setNotifications(prev => prev.map(n => 
        n.id === notificationId ? { ...n, read: true } : n
      ));
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  // Mark all notifications as read
  const markAllNotificationsRead = async () => {
    try {
      await apiCall('/api/notifications/mark-all-read', { method: 'POST' });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    }
  };

  // Delete notification
  const deleteNotification = async (notificationId) => {
    try {
      await apiCall(`/api/notifications/${notificationId}`, { method: 'DELETE' });
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  };

  // Count unread notifications
  const unreadNotificationsCount = notifications.filter(n => !n.read).length;

  useEffect(() => {
    if (currentUser) {
      setDataLoaded(false);
      Promise.all([fetchUserProfile(), fetchRides(), fetchMyRides(), fetchJoinedRides(), fetchPendingRequests(), fetchNotifications()])
        .finally(() => setDataLoaded(true));
    }
  }, [currentUser]);

  // Refresh pending requests and notifications periodically
  useEffect(() => {
    if (currentUser) {
      const interval = setInterval(() => {
        fetchPendingRequests();
        fetchNotifications();
      }, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [currentUser]);

  // Autofill form when user profile loads
  useEffect(() => {
    if (currentUser) {
      setFormData(prev => ({
        ...prev,
        hostName: prev.hostName || currentUser.displayName || '',
        contactNumber: userProfile.phoneNumber || prev.contactNumber || ''
      }));
    }
  }, [currentUser, userProfile.phoneNumber]);

  const handleLogin = async () => {
    try {
      await loginWithGoogle();
    } catch (err) {
      alert('Login failed: ' + err.message);
    }
  };

  const handleLogout = async () => {
    if (!window.confirm('Are you sure you want to sign out?')) return;
    try {
      await logout();
      setRides([]);
      setMyRides([]);
      setJoinedRidesData([]);
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handlePhoneSubmit = async () => {
    if (!tempPhoneNumber.trim()) return;
    if (phoneModalCallback) await phoneModalCallback(tempPhoneNumber);
    setPhoneModalOpen(false);
    setTempPhoneNumber('');
    setPhoneModalCallback(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentUser) return alert('Please log in first');

    try {
      setLoading(true);
      const rideData = {
        hostName: formData.hostName || currentUser.displayName || 'Anonymous',
        carType: formData.carType,
        rideType: formData.rideType,
        hostEmail: currentUser.email,
        origin: formData.origin,
        destination: formData.destination,
        date: new Date(formData.date).toISOString(),
        time: formData.time,
        seatsTotal: parseInt(formData.seatsTotal),
        contactNumber: formData.contactNumber
      };
      
      await apiCall('/api/rides', { method: 'POST', body: JSON.stringify(rideData) });
      alert('Ride posted successfully!');
      setFormData({ hostName: '', carType: '', rideType: 'city', origin: '', destination: '', date: '', time: '', seatsTotal: 1, contactNumber: '' });
      setCurrentView('browse');
      fetchRides();
    } catch (err) {
      alert('Error posting ride: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestRide = async (ride) => {
    if (!currentUser) return alert('Please log in first');
    if (ride.hostEmail === currentUser.email) return alert("You can't request your own ride!");
    
    let passengerPhone = userProfile.phoneNumber;
    if (!passengerPhone) {
      setPhoneModalOpen(true);
      setPhoneModalCallback(() => async (phone) => {
        if (phone) {
          await savePhoneNumber(phone);
          continueRequestRide(ride, phone);
        }
      });
      return;
    }
    continueRequestRide(ride, passengerPhone);
  };

  // Open WhatsApp link (iOS compatible)
  const openWhatsApp = (url) => {
    // iOS Safari blocks window.open for deep links, use location.href instead
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    
    if (isIOS) {
      // For iOS, use location.href which works better with deep links
      window.location.href = url;
    } else {
      // For Android and desktop, window.open works fine
      window.open(url, '_blank');
    }
  };

  const continueRequestRide = async (ride, passengerPhone) => {
    try {
      setLoading(true);
      const response = await apiCall(`/api/rides/${ride.id}/request`, {
        method: 'POST',
        body: JSON.stringify({
          passengerName: currentUser.displayName || 'BITS Student',
          passengerEmail: currentUser.email,
          passengerPhone: passengerPhone
        })
      });
      setSelectedRide(null);
      fetchRides();
      fetchJoinedRides(); // Refresh joined rides after requesting
      if (response.hostWhatsAppLink) {
        setWhatsappModal({ open: true, link: response.hostWhatsAppLink });
      } else {
        alert('Request sent successfully!');
      }
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };
  // Handle approval/rejection from WhatsApp link (secure endpoint)
  const handleApprovalResponse = async () => {
    if (!approvalModal.requestId || !approvalModal.action || !approvalModal.token) return;
    
    try {
      setApprovalModal(prev => ({ ...prev, processing: true }));
      
      const response = await apiCall(`/api/requests/${approvalModal.requestId}/secure-respond`, {
        method: 'POST',
        body: JSON.stringify({
          action: approvalModal.action,
          token: approvalModal.token
        })
      });
      
      setApprovalModal(prev => ({ 
        ...prev, 
        processing: false,
        result: { success: true, ...response }
      }));
      
      // Refresh rides data
      fetchRides();
      fetchMyRides();
      fetchJoinedRides();
      
    } catch (err) {
      setApprovalModal(prev => ({ 
        ...prev, 
        processing: false,
        result: { success: false, error: err.message }
      }));
    }
  };

  // Close approval modal
  const closeApprovalModal = () => {
    setApprovalModal({ 
      open: false, 
      requestId: null, 
      action: null, 
      token: null,
      processing: false,
      result: null
    });
  };

  // Filter rides for Browse (exclude full rides AND past rides)
  const filteredRides = rides.filter(ride => {
    const seatsLeft = ride.seatsAvailable ?? ride.seatsTotal;
    if (seatsLeft <= 0) return false; // Hide full rides from browse
    
    // Filter out past rides
    const rideDate = ride.date?.toDate ? ride.date.toDate() : new Date(ride.date);
    const [hours, minutes] = (ride.time || '23:59').split(':').map(Number);
    rideDate.setHours(hours || 23, minutes || 59, 0, 0);
    if (rideDate < new Date()) return false;
    
    if (filter === 'all') return true;
    return getRideType(ride) === filter;
  });

  // Filter myRides to exclude past rides (but keep full rides)
  const filteredMyRides = myRides.filter(ride => {
    const rideDate = ride.date?.toDate ? ride.date.toDate() : new Date(ride.date);
    const [hours, minutes] = (ride.time || '23:59').split(':').map(Number);
    rideDate.setHours(hours || 23, minutes || 59, 0, 0);
    return rideDate >= new Date();
  });

  // Sign In Page - with special handling for approval links
  if (!currentUser) {
    return (
      <div className="App">
        <nav className="navbar">
          <div className="navbar-left">
            <div className="logo">
              <div className="logo-icon"><FaCar /></div>
              <span>BITSPool</span>
            </div>
          </div>
        </nav>
        <div className="signin-container">
          <div className="signin-card">
            <div className="signin-logo"><FaCar /></div>
            <h1 className="signin-title">Welcome to BITSPool</h1>
            {approvalModal.open ? (
              <>
                <p className="signin-subtitle" style={{color: '#f97316'}}>
                  🔐 You need to sign in as the <strong>ride host</strong> to {approvalModal.action} this request.
                </p>
                <p className="signin-subtitle" style={{fontSize: '14px', marginTop: '8px'}}>
                  Only the host who posted the ride can approve or reject requests.
                </p>
              </>
            ) : (
              <p className="signin-subtitle">Share rides with fellow BITSians. Sign in with your BITS email to continue.</p>
            )}
            <button className="btn-google" onClick={handleLogin}>
              Sign in with BITS Email
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Modal Component
  const RideModal = ({ ride, onClose }) => {
    if (!ride) return null;
    const isOwnRide = currentUser && ride.hostEmail === currentUser.email;
    const isAlreadyPassenger = currentUser && ride.passengers?.some(p => p.email === currentUser.email);
    
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={e => e.stopPropagation()}>
          <button className="close-btn" onClick={onClose}><FaTimes /></button>
          <div className="modal-header">Trip Details</div>
          
          <div className="detail-row">
            <span className="detail-label">From</span>
            <span className="detail-value">{ride.origin}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">To</span>
            <span className="detail-value">{ride.destination}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Date</span>
            <span className="detail-value">
              {ride.date?.toDate ? ride.date.toDate().toLocaleDateString() : new Date(ride.date).toLocaleDateString()}
            </span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Time</span>
            <span className="detail-value">{ride.time}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Host</span>
            <span className="detail-value">{ride.hostName}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Contact</span>
            <span className="detail-value">{ride.contactNumber}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Seats Left</span>
            <span className="detail-value">{ride.seatsAvailable ?? ride.seatsTotal} left (of {ride.seatsTotal})</span>
          </div>

          {ride.passengers?.length > 0 && (
            <div className="passengers-section">
              <div className="detail-label"><FaUserFriends /> Co-passengers ({ride.passengers.length})</div>
              <div className="passengers-list">
                {ride.passengers.map((p, idx) => <div key={idx} className="passenger-chip">{p.name}</div>)}
              </div>
            </div>
          )}

          {!isOwnRide && !isAlreadyPassenger && (
            <button className="btn-primary btn-block" style={{marginTop: '1.5rem'}} onClick={() => handleRequestRide(ride)} disabled={loading}>
              {loading ? 'Sending...' : 'Join Ride'}
            </button>
          )}
          
          {isAlreadyPassenger && (
            <div className="your-ride-modal-badge">
              <FaCheckCircle /> You're on this ride
            </div>
          )}
          
          {isOwnRide && (
            <>
              <div className="your-ride-modal-badge">Your Ride</div>
              <button 
                className="btn-cancel" 
                style={{
                  marginTop: '1rem',
                  width: '100%',
                  padding: '0.75rem',
                  background: 'transparent',
                  color: '#ef4444',
                  border: '1px solid #ef4444',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem'
                }}
                onClick={() => handleCancelRide(ride)}
                disabled={loading}
              >
                <FaTrash /> {loading ? 'Cancelling...' : 'Cancel Ride'}
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="App">
      {/* Navbar */}
      <nav className="navbar">
        <div className="navbar-left">
          <div className="logo" onClick={() => { setCurrentView('home'); setMobileMenuOpen(false); }} style={{cursor: 'pointer'}}>
            <div className="logo-icon"><FaCar /></div>
            <span>BITSPool</span>
          </div>
        </div>
        <div className="campus-badge">BITS Pilani</div>
        <div className="nav-links desktop-nav">
          <span className={`nav-item ${currentView === 'home' ? 'active' : ''}`} onClick={() => setCurrentView('home')}>Home</span>
          <span className={`nav-item ${currentView === 'browse' ? 'active' : ''}`} onClick={() => setCurrentView('browse')}>Browse</span>
          <span className={`nav-item ${currentView === 'myrides' ? 'active' : ''}`} onClick={() => setCurrentView('myrides')} style={{position: 'relative'}}>
            My Rides
            {pendingRequests.length > 0 && <span className="nav-badge">{pendingRequests.length}</span>}
          </span>
          <span className={`nav-item ${currentView === 'post' ? 'active' : ''}`} onClick={() => setCurrentView('post')}>Post Ride</span>
          <span 
            className="nav-item notification-bell" 
            onClick={() => setNotificationsPanelOpen(!notificationsPanelOpen)}
            style={{position: 'relative', cursor: 'pointer'}}
          >
            <FaBell />
            {unreadNotificationsCount > 0 && <span className="nav-badge">{unreadNotificationsCount}</span>}
          </span>
        </div>
        <button className="hamburger-btn" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
          {mobileMenuOpen ? <FaTimes /> : <FaBars />}
        </button>
      </nav>

      {/* Notifications Panel */}
      {notificationsPanelOpen && (
        <div className="notifications-panel">
          <div className="notifications-header">
            <h3>Notifications</h3>
            <div style={{display: 'flex', gap: '0.5rem'}}>
              {unreadNotificationsCount > 0 && (
                <button className="mark-all-read-btn" onClick={markAllNotificationsRead}>
                  Mark all read
                </button>
              )}
              <button className="close-notifications-btn" onClick={() => setNotificationsPanelOpen(false)}>
                <FaTimes />
              </button>
            </div>
          </div>
          <div className="notifications-list">
            {notifications.length === 0 ? (
              <div className="no-notifications">
                <FaBell style={{fontSize: '2rem', opacity: 0.3, marginBottom: '0.5rem'}} />
                <p>No notifications yet</p>
              </div>
            ) : (
              notifications.map(notification => (
                <div 
                  key={notification.id} 
                  className={`notification-item ${!notification.read ? 'unread' : ''} ${notification.type}`}
                  onClick={() => !notification.read && markNotificationRead(notification.id)}
                >
                  <div className="notification-icon">
                    {notification.type === 'request_approved' && <FaCheckCircle style={{color: '#22c55e'}} />}
                    {notification.type === 'request_rejected' && <FaTimes style={{color: '#ef4444'}} />}
                    {notification.type === 'ride_cancelled' && <FaTimes style={{color: '#ef4444'}} />}
                    {notification.type === 'new_request' && <FaUserFriends style={{color: '#3b82f6'}} />}
                  </div>
                  <div className="notification-content">
                    <div className="notification-title">{notification.title}</div>
                    <div className="notification-message">{notification.message}</div>
                    <div className="notification-time">
                      {new Date(notification.createdAt).toLocaleDateString()} at {new Date(notification.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </div>
                  </div>
                  <button 
                    className="delete-notification-btn"
                    onClick={(e) => { e.stopPropagation(); deleteNotification(notification.id); }}
                  >
                    <FaTimes />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="mobile-menu">
          <div className={`mobile-menu-item ${currentView === 'home' ? 'active' : ''}`} onClick={() => { setCurrentView('home'); setMobileMenuOpen(false); }}>
            <FaHome /> Home
          </div>
          <div className={`mobile-menu-item ${currentView === 'browse' ? 'active' : ''}`} onClick={() => { setCurrentView('browse'); setMobileMenuOpen(false); }}>
            <FaSearch /> Browse Rides
          </div>
          <div className={`mobile-menu-item ${currentView === 'myrides' ? 'active' : ''}`} onClick={() => { setCurrentView('myrides'); setMobileMenuOpen(false); }}>
            <FaRoute /> My Rides {pendingRequests.length > 0 && <span className="menu-badge" style={{background: '#f97316'}}>{pendingRequests.length}</span>}
          </div>
          <div className={`mobile-menu-item ${currentView === 'joined' ? 'active' : ''}`} onClick={() => { setCurrentView('joined'); setMobileMenuOpen(false); }}>
            <FaTicketAlt /> Joined Rides {joinedRides.length > 0 && <span className="menu-badge">{joinedRides.length}</span>}
          </div>
          <div className={`mobile-menu-item`} onClick={() => { setNotificationsPanelOpen(true); setMobileMenuOpen(false); }}>
            <FaBell /> Notifications {unreadNotificationsCount > 0 && <span className="menu-badge" style={{background: '#f97316'}}>{unreadNotificationsCount}</span>}
          </div>
          <div className={`mobile-menu-item ${currentView === 'post' ? 'active' : ''}`} onClick={() => { setCurrentView('post'); setMobileMenuOpen(false); }}>
            <FaPlus /> Post Ride
          </div>
          <div className="mobile-menu-divider"></div>
          <div className="mobile-menu-user">
            <FaUser /> {currentUser.displayName || 'Student'}
          </div>
          <div className="mobile-menu-item" onClick={() => { handleLogout(); setMobileMenuOpen(false); }}>
            <FaSignOutAlt /> Sign Out
          </div>
        </div>
      )}

      {/* Main Layout */}
      <div className="main-layout">
        {/* Sidebar - hidden on home for mobile */}
        <aside className={`sidebar ${currentView === 'home' ? 'hide-mobile' : ''}`}>
          <div className="sidebar-section">
            <div className="sidebar-title"><FaFilter /> Filters</div>
            <div className="filter-list">
              <div className={`filter-item ${filter === 'all' ? 'active' : ''}`} onClick={() => { setFilter('all'); setCurrentView('browse'); }}>All Rides</div>
              <div className={`filter-item ${filter === 'airport' ? 'active' : ''}`} onClick={() => { setFilter('airport'); setCurrentView('browse'); }}>Airport</div>
              <div className={`filter-item ${filter === 'station' ? 'active' : ''}`} onClick={() => { setFilter('station'); setCurrentView('browse'); }}>Station</div>
              <div className={`filter-item ${filter === 'city' ? 'active' : ''}`} onClick={() => { setFilter('city'); setCurrentView('browse'); }}>City</div>
            </div>
          </div>
          
          <div className="user-card">
            <div className="user-info">
              <div className="user-avatar"><FaUser /></div>
              <div className="user-details">
                <div className="user-name">{currentUser.displayName || 'Student'}</div>
                <div className="user-email">{currentUser.email}</div>
              </div>
            </div>
            <button className="btn-signout" onClick={handleLogout}>
              <FaSignOutAlt /> Sign Out
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="main-content">
          {/* Home View */}
          {currentView === 'home' && (
            <div className="home-container">
              <div className="home-hero">
                <div className="home-icon"><FaCar /></div>
                <h1 className="home-title">Find a ride with fellow BITSians</h1>
                <p className="home-subtitle">Share rides to airports, railway stations, and cities. Save money, make friends, and travel together.</p>
                <div className="home-actions">
                  <button className="btn-primary btn-large" onClick={() => setCurrentView('browse')}>
                    <FaSearch /> Browse Rides
                  </button>
                  <button className="btn-secondary btn-large" onClick={() => setCurrentView('post')}>
                    <FaPlus /> Post a Ride
                  </button>
                </div>
              </div>
              <div className="home-stats">
                <div className="stat-card clickable" onClick={() => setCurrentView('browse')}>
                  <div className="stat-number">{dataLoaded ? filteredRides.length : '...'}</div>
                  <div className="stat-label">Active Rides</div>
                </div>
                <div className="stat-card clickable" onClick={() => setCurrentView('myrides')}>
                  <div className="stat-number">{dataLoaded ? filteredMyRides.length : '...'}</div>
                  <div className="stat-label">Your Rides</div>
                </div>
                <div className="stat-card clickable" onClick={() => setCurrentView('joined')}>
                  <div className="stat-number">{dataLoaded ? joinedRides.length : '...'}</div>
                  <div className="stat-label">Joined Rides</div>
                </div>
              </div>
            </div>
          )}

          {/* Browse View */}
          {currentView === 'browse' && (
            <>
              <div className="page-header">
                <div>
                  <h1 className="page-title">Available Rides</h1>
                  <p className="page-subtitle">Find a ride that matches your schedule.</p>
                </div>
                <div className="header-actions">
                  <div className="status-badge">
                    <span className="status-dot"></span> System Online
                  </div>
                  <button className="btn-primary" onClick={() => setCurrentView('post')}>
                    <FaPlus /> Post Ride
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="loading-state">
                  <div className="loading-spinner"></div>
                  <p>Loading rides...</p>
                </div>
              ) : filteredRides.length === 0 ? (
                <div className="empty-state">
                  <h3>No rides available</h3>
                  <p>Be the first to post a ride!</p>
                  <button className="btn-primary" onClick={() => setCurrentView('post')}>
                    <FaPlus /> Post a Ride
                  </button>
                </div>
              ) : (
                <div className="rides-list">
                  {filteredRides.map((ride, index) => {
                    const rideType = getRideType(ride);
                    const isOwnRide = ride.hostEmail === currentUser.email;
                    const isAlreadyPassenger = ride.passengers?.some(p => p.email === currentUser.email);
                    const rideDate = ride.date?.toDate ? ride.date.toDate() : new Date(ride.date);
                    
                    return (
                      <div key={ride.id || index} className="ride-item" onClick={() => setSelectedRide(ride)}>
                        <span className={`ride-type-badge ${rideType}`}>{rideType}</span>
                        
                        <div className="ride-main">
                          <div className="ride-host">Hosted by {ride.hostName}</div>
                          {ride.carType && ride.carType !== 'Not specified' && (
                            <div className="ride-car"><FaCar /> {ride.carType}</div>
                          )}
                          <div className="ride-route">
                            <div>
                              <div className="ride-location">{ride.origin}</div>
                              <div className="ride-location-label">Origin</div>
                            </div>
                            <span className="route-arrow">→</span>
                            <div>
                              <div className="ride-location">{ride.destination}</div>
                              <div className="ride-location-label">Destination</div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="ride-details">
                          <div className="ride-detail">
                            <FaCalendar /> {rideDate.toLocaleDateString()}
                          </div>
                          <div className="ride-detail">
                            <FaClock /> {ride.time}
                          </div>
                          <div className="ride-seats">
                            <FaUserFriends /> {ride.seatsAvailable || ride.seatsTotal} seats left
                          </div>
                        </div>
                        
                        <div className="ride-actions">
                          {isOwnRide ? (
                            <span className="your-ride-tag">Your Ride</span>
                          ) : isAlreadyPassenger ? (
                            <span className="on-ride-tag"><FaCheckCircle /> On this ride</span>
                          ) : (
                            <button className="btn-join" onClick={(e) => { e.stopPropagation(); handleRequestRide(ride); }}>
                              Join Ride
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* My Rides View */}
          {currentView === 'myrides' && (
            <>
              <div className="page-header">
                <div>
                  <h1 className="page-title">My Rides</h1>
                  <p className="page-subtitle">Rides you've posted ({filteredMyRides.length})</p>
                </div>
              </div>

              {/* Pending Requests Section */}
              {pendingRequests.length > 0 && (
                <div className="pending-requests-section" style={{marginBottom: '2rem'}}>
                  <h2 style={{color: 'var(--text-primary)', fontSize: '1.1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                    <FaBell style={{color: '#f97316'}} /> Pending Requests ({pendingRequests.length})
                  </h2>
                  <div className="rides-list">
                    {pendingRequests.map((request, index) => (
                      <div key={request.id || index} className="ride-item request-item" style={{borderLeft: '4px solid #f97316'}}>
                        <div className="ride-main">
                          <div className="ride-host" style={{color: '#f97316', fontWeight: '600'}}>
                            🙋 {request.passengerName} wants to join
                          </div>
                          <div className="ride-route" style={{marginTop: '0.5rem'}}>
                            <div>
                              <div className="ride-location">{request.rideOrigin}</div>
                              <div className="ride-location-label">From</div>
                            </div>
                            <span className="route-arrow">→</span>
                            <div>
                              <div className="ride-location">{request.rideDestination}</div>
                              <div className="ride-location-label">To</div>
                            </div>
                          </div>
                          <div style={{marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--text-muted)'}}>
                            <FaCalendar style={{marginRight: '0.25rem'}} /> {new Date(request.rideDate).toLocaleDateString()} at {request.rideTime}
                          </div>
                          <div style={{marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)'}}>
                            <FaPhone style={{marginRight: '0.25rem'}} /> {request.passengerPhone}
                          </div>
                        </div>
                        
                        <div className="ride-actions" style={{flexDirection: 'column', gap: '0.5rem', minWidth: '140px'}}>
                          <button 
                            className="btn-approve" 
                            style={{
                              background: '#22c55e', 
                              color: 'white', 
                              border: 'none', 
                              padding: '0.5rem 1rem', 
                              borderRadius: '6px', 
                              cursor: 'pointer',
                              fontSize: '0.85rem',
                              fontWeight: '500',
                              width: '100%'
                            }}
                            onClick={(e) => { e.stopPropagation(); handleRespondToRequest(request.id, 'approve'); }}
                            disabled={processingRequest === request.id}
                          >
                            {processingRequest === request.id ? '...' : '✓ Approve'}
                          </button>
                          <button 
                            className="btn-reject"
                            style={{
                              background: 'transparent', 
                              color: '#ef4444', 
                              border: '1px solid #ef4444', 
                              padding: '0.5rem 1rem', 
                              borderRadius: '6px', 
                              cursor: 'pointer',
                              fontSize: '0.85rem',
                              fontWeight: '500',
                              width: '100%'
                            }}
                            onClick={(e) => { e.stopPropagation(); handleRespondToRequest(request.id, 'reject'); }}
                            disabled={processingRequest === request.id}
                          >
                            ✗ Reject
                          </button>
                          <a 
                            href={`https://wa.me/${request.passengerPhone?.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '0.25rem',
                              background: 'transparent', 
                              color: '#25D366', 
                              border: '1px solid #25D366', 
                              padding: '0.5rem 1rem', 
                              borderRadius: '6px', 
                              cursor: 'pointer',
                              fontSize: '0.8rem',
                              textDecoration: 'none',
                              width: '100%',
                              boxSizing: 'border-box'
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <FaWhatsapp /> Chat
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Your Rides */}
              {filteredMyRides.length === 0 && pendingRequests.length === 0 ? (
                <div className="empty-state">
                  <h3>No upcoming rides</h3>
                  <p>Post a ride and find co-passengers!</p>
                  <button className="btn-primary" onClick={() => setCurrentView('post')}>
                    <FaPlus /> Post a Ride
                  </button>
                </div>
              ) : filteredMyRides.length > 0 && (
                <>
                  {pendingRequests.length > 0 && (
                    <h2 style={{color: 'var(--text-primary)', fontSize: '1.1rem', marginBottom: '1rem'}}>
                      Your Rides
                    </h2>
                  )}
                  <div className="rides-list">
                    {filteredMyRides.map((ride, index) => {
                      const rideType = getRideType(ride);
                      const rideDate = ride.date?.toDate ? ride.date.toDate() : new Date(ride.date);
                      const rideRequests = pendingRequests.filter(r => r.rideId === ride.id);
                      
                      return (
                        <div key={ride.id || index} className="ride-item" onClick={() => setSelectedRide(ride)}>
                          <span className={`ride-type-badge ${rideType}`}>{rideType}</span>
                          {rideRequests.length > 0 && (
                            <span className="request-badge" style={{
                              position: 'absolute',
                              top: '0.5rem',
                              right: '0.5rem',
                              background: '#f97316',
                              color: 'white',
                              fontSize: '0.7rem',
                              padding: '0.2rem 0.5rem',
                              borderRadius: '10px'
                            }}>
                              {rideRequests.length} request{rideRequests.length > 1 ? 's' : ''}
                            </span>
                          )}
                          
                          <div className="ride-main">
                            <div className="ride-route">
                              <div>
                                <div className="ride-location">{ride.origin}</div>
                                <div className="ride-location-label">Origin</div>
                              </div>
                              <span className="route-arrow">→</span>
                              <div>
                                <div className="ride-location">{ride.destination}</div>
                                <div className="ride-location-label">Destination</div>
                              </div>
                            </div>
                          </div>
                          
                          <div className="ride-details">
                            <div className="ride-detail">
                              <FaCalendar /> {rideDate.toLocaleDateString()}
                            </div>
                            <div className="ride-detail">
                              <FaClock /> {ride.time}
                            </div>
                            <div className="ride-seats">
                              <FaUserFriends /> {ride.seatsAvailable ?? ride.seatsTotal} seats left
                            </div>
                          </div>
                          
                          <div className="ride-actions" style={{display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end'}}>
                            <span className="your-ride-tag">Your Ride</span>
                            <button 
                              className="btn-cancel-small"
                              style={{
                                background: 'transparent',
                                color: '#ef4444',
                                border: '1px solid #ef4444',
                                padding: '0.35rem 0.75rem',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '0.75rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.25rem'
                              }}
                              onClick={(e) => { e.stopPropagation(); handleCancelRide(ride); }}
                            >
                              <FaTrash /> Cancel
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          )}

          {/* Joined Rides View */}
          {currentView === 'joined' && (
            <>
              <div className="page-header">
                <div>
                  <h1 className="page-title">Joined Rides</h1>
                  <p className="page-subtitle">Rides you've joined ({joinedRides.length})</p>
                </div>
              </div>

              {joinedRides.length === 0 ? (
                <div className="empty-state">
                  <h3>No joined rides yet</h3>
                  <p>Browse available rides and join one!</p>
                  <button className="btn-primary" onClick={() => setCurrentView('browse')}>
                    <FaSearch /> Browse Rides
                  </button>
                </div>
              ) : (
                <div className="rides-list">
                  {joinedRides.map((ride, index) => {
                    const rideType = getRideType(ride);
                    const rideDate = ride.date?.toDate ? ride.date.toDate() : new Date(ride.date);
                    
                    return (
                      <div key={ride.id || index} className="ride-item" onClick={() => setSelectedRide(ride)}>
                        <span className={`ride-type-badge ${rideType}`}>{rideType}</span>
                        
                        <div className="ride-main">
                          <div className="ride-host">Hosted by {ride.hostName}</div>
                          <div className="ride-route">
                            <div>
                              <div className="ride-location">{ride.origin}</div>
                              <div className="ride-location-label">Origin</div>
                            </div>
                            <span className="route-arrow">→</span>
                            <div>
                              <div className="ride-location">{ride.destination}</div>
                              <div className="ride-location-label">Destination</div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="ride-details">
                          <div className="ride-detail">
                            <FaCalendar /> {rideDate.toLocaleDateString()}
                          </div>
                          <div className="ride-detail">
                            <FaClock /> {ride.time}
                          </div>
                          <div className="ride-seats">
                            <FaUserFriends /> {ride.seatsAvailable ?? ride.seatsTotal} seats left
                          </div>
                        </div>
                        
                        <div className="ride-actions">
                          <span className="on-ride-tag"><FaCheckCircle /> Joined</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* Post Ride View */}
          {currentView === 'post' && (
            <div className="form-container">
              <h2 className="form-title">Post a New Ride</h2>
              <form onSubmit={handleSubmit}>
                <div className="form-row">
                  <div className="form-group">
                    <label>Your Name</label>
                    <input name="hostName" className="form-input" placeholder="Full name" value={formData.hostName} onChange={handleChange} required />
                  </div>
                  <div className="form-group">
                    <label>Car Type</label>
                    <input name="carType" className="form-input" placeholder="e.g. Swift, Innova" value={formData.carType} onChange={handleChange} required />
                  </div>
                </div>

                <div className="form-group">
                  <label>Ride Type</label>
                  <select name="rideType" className="form-select" value={formData.rideType} onChange={handleChange}>
                    <option value="airport">Airport</option>
                    <option value="station">Railway Station</option>
                    <option value="campus">Campus</option>
                    <option value="city">City</option>
                  </select>
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label>From (Origin)</label>
                    <input name="origin" className="form-input" placeholder="Pickup location" value={formData.origin} onChange={handleChange} required />
                  </div>
                  <div className="form-group">
                    <label>To (Destination)</label>
                    <input name="destination" className="form-input" placeholder="Drop location" value={formData.destination} onChange={handleChange} required />
                  </div>
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label>Date</label>
                    <input name="date" type="date" className="form-input" value={formData.date} onChange={handleChange} min={new Date().toISOString().split('T')[0]} required />
                  </div>
                  <div className="form-group">
                    <label>Time</label>
                    <input name="time" type="time" className="form-input" value={formData.time} onChange={handleChange} required />
                  </div>
                </div>
                
                <div className="form-row">
                  <div className="form-group">
                    <label>Seats Available</label>
                    <select name="seatsTotal" className="form-select" value={formData.seatsTotal} onChange={handleChange}>
                      {[1,2,3,4,5,6,7].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>WhatsApp Number</label>
                    <input name="contactNumber" className="form-input" placeholder="+91 98765 43210" value={formData.contactNumber} onChange={handleChange} required />
                  </div>
                </div>
                
                <button type="submit" className="btn-primary btn-block" disabled={loading}>
                  {loading ? 'Posting...' : 'Post Ride'}
                </button>
              </form>
            </div>
          )}
        </main>
      </div>

      {/* Footer */}
      <footer className="footer">
        <span>Made with ❤️ by Kurkure & Pulkit</span>
        <div className="footer-links">
          <span>© 2026 BITSPool</span>
        </div>
      </footer>

      {/* Modals */}
      {selectedRide && <RideModal ride={selectedRide} onClose={() => setSelectedRide(null)} />}
      
      {phoneModalOpen && (
        <div className="modal-overlay" onClick={() => setPhoneModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setPhoneModalOpen(false)}><FaTimes /></button>
            <div className="modal-header"><FaPhone /> Enter Phone Number</div>
            <p style={{color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.875rem'}}>
              Required for WhatsApp communication with hosts.
            </p>
            <div className="form-group">
              <label>WhatsApp Number</label>
              <input type="tel" className="form-input" placeholder="+91 98765 43210" value={tempPhoneNumber} 
                onChange={(e) => setTempPhoneNumber(e.target.value)} 
                onKeyPress={(e) => e.key === 'Enter' && handlePhoneSubmit()} autoFocus />
            </div>
            <button className="btn-primary btn-block" onClick={handlePhoneSubmit} disabled={!tempPhoneNumber.trim()}>
              Save & Continue
            </button>
          </div>
        </div>
      )}

      {/* Request Success Modal */}
      {whatsappModal.open && (
        <div className="modal-overlay" onClick={() => setWhatsappModal({ open: false, link: null })}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setWhatsappModal({ open: false, link: null })}><FaTimes /></button>
            <div style={{textAlign: 'center', padding: '1rem 0'}}>
              <div style={{fontSize: '48px', marginBottom: '1rem'}}><FaCheckCircle style={{color: '#22c55e', fontSize: '48px'}} /></div>
              <div className="modal-header" style={{justifyContent: 'center', marginBottom: '0.5rem'}}>Request Sent!</div>
              <p style={{color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '0.9rem', lineHeight: '1.5'}}>
                The host has been notified on the website and via email. They will approve or reject your request soon.
              </p>
              <div style={{background: 'var(--bg-elevated)', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem'}}>
                <p style={{color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '0.5rem'}}>
                  <strong>Want faster response?</strong>
                </p>
                <p style={{color: 'var(--text-muted)', fontSize: '0.8rem'}}>
                  You can also reach out directly on WhatsApp
                </p>
              </div>
            </div>
            <div style={{display: 'flex', gap: '0.75rem'}}>
              <button 
                className="btn-primary" 
                style={{flex: 1}} 
                onClick={() => setWhatsappModal({ open: false, link: null })}
              >
                Done
              </button>
              <button 
                className="btn-secondary" 
                style={{flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'}} 
                onClick={() => { openWhatsApp(whatsappModal.link); setWhatsappModal({ open: false, link: null }); }}
              >
                <FaWhatsapp style={{color: '#25D366'}} /> WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Approval Modal - For hosts responding to ride requests */}
      {approvalModal.open && (
        <div className="modal-overlay" onClick={closeApprovalModal}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="close-btn" onClick={closeApprovalModal}><FaTimes /></button>
            
            {/* Not yet processed - show confirmation */}
            {!approvalModal.result && (
              <>
                <div className="modal-header">
                  Confirm {approvalModal.action === 'approve' ? 'Approval' : 'Rejection'}
                </div>
                <p style={{color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem', lineHeight: '1.5'}}>
                  {approvalModal.action === 'approve' 
                    ? 'Are you sure you want to approve this ride request? The passenger will be notified.'
                    : 'Are you sure you want to reject this ride request? The passenger will be notified.'}
                </p>
                <div style={{display: 'flex', gap: '0.75rem'}}>
                  <button 
                    className="btn-secondary" 
                    style={{flex: 1}} 
                    onClick={closeApprovalModal}
                    disabled={approvalModal.processing}
                  >
                    Cancel
                  </button>
                  <button 
                    className="btn-primary" 
                    style={{
                      flex: 1, 
                      background: approvalModal.action === 'approve' ? '#22c55e' : '#ef4444'
                    }} 
                    onClick={handleApprovalResponse}
                    disabled={approvalModal.processing}
                  >
                    {approvalModal.processing 
                      ? 'Processing...' 
                      : (approvalModal.action === 'approve' ? 'Yes, Approve' : 'Yes, Reject')}
                  </button>
                </div>
              </>
            )}

            {/* Success result */}
            {approvalModal.result?.success && (
              <>
                <div style={{textAlign: 'center', padding: '1rem'}}>
                  <div style={{fontSize: '64px', marginBottom: '1rem'}}>
                    {approvalModal.action === 'approve' ? <FaCheckCircle style={{color: '#22c55e'}} /> : <FaTimes style={{color: '#ef4444'}} />}
                  </div>
                  <h2 style={{color: approvalModal.action === 'approve' ? '#22c55e' : '#ef4444', marginBottom: '1rem'}}>
                    Request {approvalModal.action === 'approve' ? 'Approved!' : 'Rejected'}
                  </h2>
                  <p style={{color: 'var(--text-muted)', marginBottom: '1rem'}}>
                    {approvalModal.result.message}
                  </p>
                  {approvalModal.result.passengerPhone && approvalModal.action === 'approve' && (
                    <button 
                      className="btn-primary" 
                      style={{background: '#25D366', marginTop: '1rem'}} 
                      onClick={() => window.open(`https://wa.me/${approvalModal.result.passengerPhone.replace(/\D/g, '')}`, '_blank')}
                    >
                      <FaWhatsapp /> Message Passenger on WhatsApp
                    </button>
                  )}
                  <button 
                    className="btn-secondary" 
                    style={{marginTop: '1rem', display: 'block', width: '100%'}} 
                    onClick={closeApprovalModal}
                  >
                    Close
                  </button>
                </div>
              </>
            )}

            {/* Error result */}
            {approvalModal.result && !approvalModal.result.success && (
              <>
                <div style={{textAlign: 'center', padding: '1rem'}}>
                  <div style={{fontSize: '64px', marginBottom: '1rem'}}>🚫</div>
                  <h2 style={{color: '#ef4444', marginBottom: '1rem'}}>Unable to Process</h2>
                  <p style={{color: 'var(--text-muted)', marginBottom: '1rem'}}>
                    {approvalModal.result.error}
                  </p>
                  <p style={{color: 'var(--text-muted)', fontSize: '0.85rem'}}>
                    Make sure you're logged in with the <strong>host account</strong> that posted the ride.
                  </p>
                  <button 
                    className="btn-secondary" 
                    style={{marginTop: '1rem'}} 
                    onClick={closeApprovalModal}
                  >
                    Close
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
