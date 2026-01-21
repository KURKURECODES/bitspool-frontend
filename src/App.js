import React, { useState, useEffect } from 'react';
import './App.css';
import { FaUserFriends, FaTimes, FaCar, FaCheckCircle, FaPhone, FaSignOutAlt, FaPlus, FaClock, FaCalendar, FaUser, FaFilter } from 'react-icons/fa';
import { AuthProvider, useAuth } from './AuthContext';

const API_URL = process.env.REACT_APP_API_URL || 'https://bitspool-backend-production.up.railway.app';

function AppContent() {
  const { currentUser, loginWithGoogle, logout, getIdToken, error: authError } = useAuth();
  
  const [currentView, setCurrentView] = useState('browse');
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
  
  const [formData, setFormData] = useState({
    hostName: '',
    carType: '',
    origin: '', 
    destination: '',
    date: '',
    time: '',
    seatsTotal: 1,
    contactNumber: ''
  });

  const [error, setError] = useState('');

  // Determine ride type for badge
  const getRideType = (ride) => {
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
      setFormData({ hostName: '', carType: '', origin: '', destination: '', date: '', time: '', seatsTotal: 1, contactNumber: '' });
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
      if (response.hostWhatsAppLink && window.confirm('Request sent! Click OK to notify host via WhatsApp.')) {
        openWhatsApp(response.hostWhatsAppLink);
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
          <div className="logo">
            <div className="logo-icon"><FaCar /></div>
            <span>BITSPool</span>
          </div>
        </div>
        <div className="campus-badge">BITS Pilani</div>
        <div className="nav-links">
          <span className={`nav-item ${currentView === 'browse' ? 'active' : ''}`} onClick={() => setCurrentView('browse')}>Browse</span>
          <span className={`nav-item ${currentView === 'myrides' ? 'active' : ''}`} onClick={() => setCurrentView('myrides')}>My Rides</span>
          <span className={`nav-item ${currentView === 'post' ? 'active' : ''}`} onClick={() => setCurrentView('post')}>Post Ride</span>
        </div>
      </nav>

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
