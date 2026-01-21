import React, { useState, useEffect } from 'react';
import './App.css';
import { FaUserFriends, FaTimes, FaCar, FaCheckCircle, FaPhone, FaSignOutAlt, FaPlus, FaClock, FaCalendar, FaUser, FaFilter, FaBars, FaHome, FaSearch, FaRoute, FaTicketAlt } from 'react-icons/fa';
import { AuthProvider, useAuth } from './AuthContext';

const API_URL = process.env.REACT_APP_API_URL || 'https://bitspool-backend-production.up.railway.app';

function AppContent() {
  const { currentUser, loginWithGoogle, logout, getIdToken, error: authError } = useAuth();
  
  const [currentView, setCurrentView] = useState('home');
  const [selectedRide, setSelectedRide] = useState(null);
  const [rides, setRides] = useState([]);
  const [myRides, setMyRides] = useState([]);
  const [loading, setLoading] = useState(false);
  const [userProfile, setUserProfile] = useState({ phoneNumber: null });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [phoneModalOpen, setPhoneModalOpen] = useState(false);
  const [tempPhoneNumber, setTempPhoneNumber] = useState('');
  const [phoneModalCallback, setPhoneModalCallback] = useState(null);
  const [filter, setFilter] = useState('all');
  const [whatsappModal, setWhatsappModal] = useState({ open: false, link: null });
  
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

  // Get rides where user is a passenger (joined rides)
  const joinedRides = rides.filter(ride => 
    ride.passengers?.some(p => p.email === currentUser?.email) && ride.hostEmail !== currentUser?.email
  );

  const [error, setError] = useState('');

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

  useEffect(() => {
    if (currentUser) {
      fetchUserProfile();
      fetchRides();
      fetchMyRides();
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
    try {
      await logout();
      setRides([]);
      setMyRides([]);
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

  // Filter rides
  const filteredRides = rides.filter(ride => {
    if (filter === 'all') return true;
    return getRideType(ride) === filter;
  });

  // Sign In Page
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
            <p className="signin-subtitle">Share rides with fellow BITSians. Sign in with your BITS email to continue.</p>
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
            <span className="detail-label">Seats</span>
            <span className="detail-value">{ride.seatsAvailable || ride.seatsTotal}/{ride.seatsTotal}</span>
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
            <div className="your-ride-modal-badge">Your Ride</div>
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
          <span className={`nav-item ${currentView === 'myrides' ? 'active' : ''}`} onClick={() => setCurrentView('myrides')}>My Rides</span>
          <span className={`nav-item ${currentView === 'post' ? 'active' : ''}`} onClick={() => setCurrentView('post')}>Post Ride</span>
        </div>
        <button className="hamburger-btn" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
          {mobileMenuOpen ? <FaTimes /> : <FaBars />}
        </button>
      </nav>

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
            <FaRoute /> My Rides
          </div>
          <div className={`mobile-menu-item ${currentView === 'joined' ? 'active' : ''}`} onClick={() => { setCurrentView('joined'); setMobileMenuOpen(false); }}>
            <FaTicketAlt /> Joined Rides {joinedRides.length > 0 && <span className="menu-badge">{joinedRides.length}</span>}
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
        {/* Sidebar */}
        <aside className="sidebar">
          <div className="sidebar-section">
            <div className="sidebar-title"><FaFilter /> Filters</div>
            <div className="filter-list">
              <div className={`filter-item ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>All Rides</div>
              <div className={`filter-item ${filter === 'airport' ? 'active' : ''}`} onClick={() => setFilter('airport')}>Airport</div>
              <div className={`filter-item ${filter === 'station' ? 'active' : ''}`} onClick={() => setFilter('station')}>Station</div>
              <div className={`filter-item ${filter === 'city' ? 'active' : ''}`} onClick={() => setFilter('city')}>City</div>
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
                  <div className="stat-number">{rides.length}</div>
                  <div className="stat-label">Active Rides</div>
                </div>
                <div className="stat-card clickable" onClick={() => setCurrentView('myrides')}>
                  <div className="stat-number">{myRides.length}</div>
                  <div className="stat-label">Your Rides</div>
                </div>
                <div className="stat-card clickable" onClick={() => setCurrentView('joined')}>
                  <div className="stat-number">{joinedRides.length}</div>
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
                            <FaUserFriends /> {ride.seatsAvailable || ride.seatsTotal}/{ride.seatsTotal} seats
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
                  <p className="page-subtitle">Rides you've posted ({myRides.length})</p>
                </div>
              </div>

              {myRides.length === 0 ? (
                <div className="empty-state">
                  <h3>No rides posted yet</h3>
                  <p>Post your first ride and find co-passengers!</p>
                  <button className="btn-primary" onClick={() => setCurrentView('post')}>
                    <FaPlus /> Post a Ride
                  </button>
                </div>
              ) : (
                <div className="rides-list">
                  {myRides.map((ride, index) => {
                    const rideType = getRideType(ride);
                    const rideDate = ride.date?.toDate ? ride.date.toDate() : new Date(ride.date);
                    
                    return (
                      <div key={ride.id || index} className="ride-item" onClick={() => setSelectedRide(ride)}>
                        <span className={`ride-type-badge ${rideType}`}>{rideType}</span>
                        
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
                            <FaUserFriends /> {ride.seatsAvailable || ride.seatsTotal}/{ride.seatsTotal} seats
                          </div>
                        </div>
                        
                        <div className="ride-actions">
                          <span className="your-ride-tag">Your Ride</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
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
                            <FaUserFriends /> {ride.seatsAvailable || ride.seatsTotal}/{ride.seatsTotal} seats
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

          {/* Post Ride View */}}
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

      {/* WhatsApp Confirmation Modal */}
      {whatsappModal.open && (
        <div className="modal-overlay" onClick={() => setWhatsappModal({ open: false, link: null })}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setWhatsappModal({ open: false, link: null })}><FaTimes /></button>
            <div className="modal-header"><FaCheckCircle style={{color: '#22c55e'}} /> Request Sent!</div>
            <p style={{color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem', lineHeight: '1.5'}}>
              Your ride request has been sent successfully. Would you like to notify the host on WhatsApp?
            </p>
            <div style={{display: 'flex', gap: '0.75rem'}}>
              <button 
                className="btn-secondary" 
                style={{flex: 1}} 
                onClick={() => setWhatsappModal({ open: false, link: null })}
              >
                Maybe Later
              </button>
              <button 
                className="btn-primary" 
                style={{flex: 1, background: '#25D366'}} 
                onClick={() => { openWhatsApp(whatsappModal.link); setWhatsappModal({ open: false, link: null }); }}
              >
                Open WhatsApp
              </button>
            </div>
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
