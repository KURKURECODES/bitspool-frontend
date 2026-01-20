import React, { useState, useEffect } from 'react';
import './App.css';
import { FaCalendarAlt, FaUserFriends, FaTimes, FaMapMarkerAlt } from 'react-icons/fa';
import { AuthProvider, useAuth } from './AuthContext';

// --- CONFIGURATION ---
const HERO_IMAGE_URL = 'https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?q=80&w=2070&auto=format&fit=crop';
const API_URL = process.env.REACT_APP_API_URL || 'https://bitspool-backend-production.up.railway.app';

const RIDE_IMAGES = [
  'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?q=80&w=2021&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1503376763036-066120622c74?q=80&w=2070&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?q=80&w=2070&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1511632765486-a01980e01a18?q=80&w=2070&auto=format&fit=crop'
];

function AppContent() {
  const { currentUser, loginWithGoogle, logout, getIdToken, error: authError } = useAuth();
  
  const [currentView, setCurrentView] = useState('home');
  const [selectedRide, setSelectedRide] = useState(null);
  const [rides, setRides] = useState([]);
  const [myRides, setMyRides] = useState([]);
  const [loading, setLoading] = useState(false);
  const [userProfile, setUserProfile] = useState({ phoneNumber: null });
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved === 'true';
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [phoneModalOpen, setPhoneModalOpen] = useState(false);
  const [tempPhoneNumber, setTempPhoneNumber] = useState('');
  const [phoneModalCallback, setPhoneModalCallback] = useState(null);
  
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

  const getRideImage = (rideId, index) => {
    if (rideId) {
      let hash = 0;
      for (let i = 0; i < rideId.length; i++) {
        hash += rideId.charCodeAt(i);
      }
      return RIDE_IMAGES[hash % RIDE_IMAGES.length];
    }
    return RIDE_IMAGES[index % RIDE_IMAGES.length];
  };

  // API call helper with auth token
  const apiCall = async (endpoint, options = {}) => {
    try {
      const token = await getIdToken();
      console.log('Making API call to:', endpoint);
      console.log('Token exists:', !!token);
      
      const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
          ...options.headers,
        },
      });

      console.log('Response status:', response.status);
      
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

  // Fetch all rides
  const fetchRides = async () => {
    if (!currentUser) {
      console.log('No user, skipping fetch');
      return;
    }
    
    try {
      setLoading(true);
      setError('');
      console.log('Fetching rides...');
      
      const data = await apiCall('/api/rides');
      console.log('Rides received:', data);
      
      const validRides = Array.isArray(data) ? data : [];
      setRides(validRides.reverse());
    } catch (err) {
      console.error("Error fetching rides:", err);
      setError('Failed to load rides: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch user profile (phone number)
  const fetchUserProfile = async () => {
    if (!currentUser) return;
    
    try {
      const data = await apiCall('/api/user/profile');
      setUserProfile(data);
      
      // If no phone number, show modal for it
      if (!data.phoneNumber) {
        setPhoneModalOpen(true);
        setPhoneModalCallback(() => async (phone) => {
          if (phone) {
            await savePhoneNumber(phone);
          }
        });
      }
    } catch (err) {
      console.error('Error fetching user profile:', err);
    }
  };

  // Save phone number
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

  // Fetch user's own rides
  const fetchMyRides = async () => {
    if (!currentUser) return;
    
    try {
      setLoading(true);
      const data = await apiCall('/api/my-rides');
      setMyRides(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching my rides:', err);
      setError('Failed to load your rides: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Load user profile and rides when user is logged in
  useEffect(() => {
    console.log('Effect triggered - User:', !!currentUser, 'View:', currentView);
    if (currentUser) {
      fetchUserProfile();
      
      if (currentView === 'browse' || currentView === 'home') {
        fetchRides();
      }
      if (currentView === 'myrides') {
        fetchMyRides();
      }
      
      // Auto-fill name and phone in form
      setFormData(prev => ({
        ...prev,
        hostName: currentUser.displayName || prev.hostName,
        contactNumber: userProfile.phoneNumber || prev.contactNumber
      }));
    }
  }, [currentUser, currentView, userProfile.phoneNumber]);

  // Dark mode effect
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    localStorage.setItem('darkMode', darkMode);
  }, [darkMode]);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  const handleLogin = async () => {
    try {
      await loginWithGoogle();
      console.log('Login successful');
    } catch (err) {
      console.error('Login failed:', err);
      alert('Login failed: ' + err.message);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      setCurrentView('home');
      setRides([]);
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handlePhoneSubmit = async () => {
    if (!tempPhoneNumber.trim()) {
      alert('Please enter a valid phone number');
      return;
    }
    
    if (phoneModalCallback) {
      await phoneModalCallback(tempPhoneNumber);
    }
    
    setPhoneModalOpen(false);
    setTempPhoneNumber('');
    setPhoneModalCallback(null);
  };

  const handlePhoneModalClose = () => {
    setPhoneModalOpen(false);
    setTempPhoneNumber('');
    setPhoneModalCallback(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!currentUser) {
      alert('Please log in first');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      console.log('Submitting ride:', formData);
      
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
      
      const result = await apiCall('/api/rides', {
        method: 'POST',
        body: JSON.stringify(rideData)
      });
      
      console.log('Ride posted:', result);
      alert('Ride Posted Successfully! ✅');
      
      // Reset form
      setFormData({ 
        hostName: '', 
        carType: '',
        origin: '', 
        destination: '', 
        date: '', 
        time: '', 
        seatsTotal: 1, 
        contactNumber: ''
      });
      
      // Go to browse and refresh
      setCurrentView('browse');
      setTimeout(() => fetchRides(), 500);
      
    } catch (err) {
      console.error('Submit error:', err);
      setError(err.message || 'Failed to post ride');
      alert('Error posting ride: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestRide = async (ride) => {
    if (!currentUser) {
      alert('Please log in to request a ride');
      return;
    }

    if (ride.hostEmail === currentUser.email) {
      alert("You can't request your own ride!");
      return;
    }

    // Use stored phone number or ask for it
    let passengerPhone = userProfile.phoneNumber;
    if (!passengerPhone) {
      // Show phone modal
      setPhoneModalOpen(true);
      setPhoneModalCallback(() => async (phone) => {
        if (phone) {
          await savePhoneNumber(phone);
          // Continue with request after saving phone
          continueRequestRide(ride, phone);
        }
      });
      return;
    }

    continueRequestRide(ride, passengerPhone);
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
      
      // Show success message with WhatsApp option
      if (response.hostWhatsAppLink) {
        const notifyHost = window.confirm(
          '✅ Request sent!\n\n' +
          'Click OK to notify the host on WhatsApp with approve/reject links.\n' +
          'Click Cancel to skip (host will still receive an email).'
        );
        
        if (notifyHost) {
          window.open(response.hostWhatsAppLink, '_blank');
        }
      } else {
        alert('✅ Request sent! The host will receive an email.');
      }
      
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const getWhatsAppLink = (phone, ride) => {
    const cleanPhone = phone.replace(/\D/g, '');
    const rideDate = new Date(ride.date.seconds ? ride.date.seconds * 1000 : ride.date);
    const message = `Hi! I'm interested in your BITSPool ride from ${ride.origin} to ${ride.destination} on ${rideDate.toLocaleDateString()}`;
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  };

  // --- COMPONENT: Ride Modal ---
  const RideModal = ({ ride, onClose }) => {
    if (!ride) return null;
    
    const isOwnRide = currentUser && ride.hostEmail === currentUser.email;
    
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={e => e.stopPropagation()}>
          <button className="close-btn" onClick={onClose}><FaTimes /></button>
          
          <div className="modal-header">Trip Details</div>
          
          <div className="detail-row">
            <span className="detail-label">Origin</span>
            <span className="detail-value">{ride.origin}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Destination</span>
            <span className="detail-value">{ride.destination}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Date</span>
            <span className="detail-value">
              {ride.date?.toDate 
                ? ride.date.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                : new Date(ride.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
              }
            </span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Time</span>
            <span className="detail-value">{ride.time}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Posted by</span>
            <span className="detail-value">{ride.hostName}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Contact</span>
            <span className="detail-value">{ride.contactNumber}</span>
          </div>
          <div className="detail-row" style={{borderBottom: 'none'}}>
            <span className="detail-label">Seats Available</span>
            <span className="detail-value">{ride.seatsAvailable || ride.seatsTotal} / {ride.seatsTotal}</span>
          </div>

          {!isOwnRide && (
            <div style={{marginTop: '1rem'}}>
              <button 
                className="btn-primary" 
                style={{width: '100%'}}
                onClick={() => handleRequestRide(ride)}
                disabled={loading}
              >
                {loading ? 'Sending...' : 'Request to Join (via WhatsApp)'}
              </button>
              <p style={{fontSize: '0.85rem', color: '#666', marginTop: '0.5rem', textAlign: 'center'}}>
                Click to send request with approve/reject links to host
              </p>
            </div>
          )}
          
          {isOwnRide && (
            <div className="your-ride-modal-badge">
              <strong>This is your ride</strong>
            </div>
          )}
        </div>
      </div>
    );
  };

  // --- COMPONENT: Navbar ---
  const Navbar = () => (
    <nav className="navbar">
      <div className="navbar-left">
        <button className="theme-toggle" onClick={toggleDarkMode} title={darkMode ? 'Light mode' : 'Dark mode'}>
          {darkMode ? '☀️' : '🌙'}
        </button>
        <div className="logo" onClick={() => setCurrentView('home')} style={{cursor: 'pointer'}}>
          <div className="logo-icon">♦</div> BITSPool
        </div>
      </div>
      
      <button className="mobile-menu-toggle" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
        {mobileMenuOpen ? '✕' : '☰'}
      </button>
      
      <div className={`nav-links ${mobileMenuOpen ? 'mobile open' : ''}`}>
        {currentUser && (
          <>
            <span className="nav-item" onClick={() => { setCurrentView('home'); setMobileMenuOpen(false); }}>Home</span>
            <span className="nav-item" onClick={() => { setCurrentView('browse'); setMobileMenuOpen(false); }}>Browse Rides</span>
            <span className="nav-item" onClick={() => { setCurrentView('myrides'); setMobileMenuOpen(false); }}>My Rides</span>
            <span className="nav-item" onClick={() => { setCurrentView('post'); setMobileMenuOpen(false); }}>Post a Ride</span>
          </>
        )}
        <button className="btn-login" onClick={() => { currentUser ? handleLogout() : handleLogin(); setMobileMenuOpen(false); }}>
          {currentUser ? `Logout` : 'Sign in with BITS Email'}
        </button>
      </div>
    </nav>
  );

  return (
    <div className="App">
      <Navbar />

      {/* Error Display */}
      {(authError || error) && (
        <div style={{
          backgroundColor: '#fee',
          color: '#c00',
          padding: '1rem',
          textAlign: 'center',
          margin: '1rem'
        }}>
          {authError || error}
        </div>
      )}

      {/* --- HOME VIEW --- */}
      {currentView === 'home' && (
        <>
          <header 
            className="hero" 
            style={{
              backgroundImage: `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), url('${HERO_IMAGE_URL}')`,
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
          >
            <h1>Share Rides with Fellow BITSians</h1>
            <p style={{color: 'white', fontSize: '1.2rem', marginBottom: '2rem'}}>
              {currentUser ? `Welcome, ${currentUser.displayName || currentUser.email.split('@')[0]}!` : 'Connect, carpool, and travel together'}
            </p>
            <div className="hero-buttons">
              {currentUser ? (
                <>
                  <button className="btn-primary" onClick={() => setCurrentView('post')}>Post a Ride</button>
                  <button className="btn-hero-white" onClick={() => setCurrentView('browse')}>Browse Rides</button>
                </>
              ) : (
                <button className="btn-primary" onClick={handleLogin}>Sign in to Continue</button>
              )}
            </div>
          </header>

          {currentUser && (
            <>
              <h2 className="section-title">Recent Rides ({rides.length})</h2>
              
              {loading ? (
                <p style={{textAlign: 'center', padding: '2rem'}}>Loading rides...</p>
              ) : rides.length === 0 ? (
                <div style={{textAlign: 'center', padding: '2rem'}}>
                  <p>No rides available yet. Be the first to post!</p>
                  <button className="btn-primary" onClick={() => setCurrentView('post')} style={{marginTop: '1rem'}}>
                    Post a Ride
                  </button>
                </div>
              ) : (
                <div className="rides-grid">
                  {rides.slice(0, 4).map((ride, index) => (
                    <div key={ride.id || ride._id || index} className="ride-card" onClick={() => setSelectedRide(ride)}>
                      <div 
                        className="card-image" 
                        style={{
                          backgroundColor: '#ddd',
                          backgroundImage: `url('${getRideImage(ride.id || ride._id, index)}')`
                        }}
                      ></div>
                      <div className="card-content">
                        <div className="card-route">{ride.origin} → {ride.destination}</div>
                        <div className="card-details">
                          <span>
                            {ride.date?.toDate 
                              ? ride.date.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                              : new Date(ride.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                            }, {ride.time}
                          </span>
                        </div>
                        <div className="card-seats">{ride.seatsAvailable || ride.seatsTotal} seats</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* --- BROWSE VIEW --- */}
      {currentView === 'browse' && (
        <div style={{marginTop: '2rem'}}>
          <h2 className="browse-title">All Available Rides ({rides.length})</h2>

          {!currentUser ? (
            <div style={{textAlign: 'center', padding: '4rem'}}>
              <h2>Please sign in</h2>
              <button className="btn-primary" onClick={handleLogin} style={{marginTop: '1rem'}}>
                Sign in with BITS Email
              </button>
            </div>
          ) : loading ? (
            <p style={{textAlign: 'center', padding: '2rem'}}>Loading rides...</p>
          ) : rides.length === 0 ? (
            <div style={{textAlign: 'center', padding: '4rem'}}>
              <p>No rides available</p>
              <button className="btn-primary" onClick={() => setCurrentView('post')} style={{marginTop: '1rem'}}>
                Post a Ride
              </button>
            </div>
          ) : (
            <div className="rides-grid">
              {rides.map((ride, index) => (
                <div key={ride.id || ride._id || index} className="ride-card" onClick={() => setSelectedRide(ride)}>
                  <div 
                    className="card-image" 
                    style={{
                      backgroundColor: '#ddd',
                      backgroundImage: `url('${getRideImage(ride.id || ride._id, index)}')`
                    }}
                  ></div>
                  <div className="card-content">
                    <div className="card-route">{ride.origin} → {ride.destination}</div>
                    <div className="card-details">
                      <span>
                        {ride.date?.toDate 
                          ? ride.date.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                          : new Date(ride.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                        }, {ride.time}
                      </span>
                    </div>
                    <div className="card-seats">{ride.seatsAvailable || ride.seatsTotal} seats</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* --- POST RIDE VIEW --- */}
      {currentView === 'post' && (
        <>
          {!currentUser ? (
            <div style={{textAlign: 'center', padding: '4rem'}}>
              <h2>Please sign in to post</h2>
              <button className="btn-primary" onClick={handleLogin} style={{marginTop: '1rem'}}>
                Sign in
              </button>
            </div>
          ) : (
            <div className="form-container">
              <h2 style={{marginBottom: '1.5rem'}}>Post a Ride</h2>
              
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label>Your Name</label>
                  <input 
                    name="hostName" 
                    className="form-input" 
                    placeholder={currentUser.displayName || "Your name"} 
                    value={formData.hostName}
                    onChange={handleChange} 
                    required 
                  />
                </div>

                <div className="form-group">
                  <label>Your BITS Email</label>
                  <input 
                    className="form-input" 
                    value={currentUser.email}
                    disabled
                    style={{backgroundColor: '#f5f5f5'}}
                  />
                </div>

                <div className="form-group">
                  <label>Car Type</label>
                  <input 
                    name="carType" 
                    className="form-input" 
                    placeholder="e.g. Honda City, Maruti Swift" 
                    value={formData.carType}
                    onChange={handleChange} 
                    required 
                  />
                </div>

                <div className="form-group">
                  <label>From (Pickup)</label>
                  <input 
                    name="origin" 
                    className="form-input" 
                    placeholder="e.g. Pilani Campus" 
                    value={formData.origin}
                    onChange={handleChange} 
                    required 
                  />
                </div>

                <div className="form-group">
                  <label>To (Drop)</label>
                  <input 
                    name="destination" 
                    className="form-input" 
                    placeholder="e.g. Jaipur Airport" 
                    value={formData.destination}
                    onChange={handleChange} 
                    required 
                  />
                </div>

                <div className="form-group">
                  <label>Date</label>
                  <input 
                    name="date" 
                    type="date" 
                    className="form-input" 
                    value={formData.date}
                    onChange={handleChange} 
                    min={new Date().toISOString().split('T')[0]}
                    required 
                  />
                </div>

                <div className="form-group">
                  <label>Time</label>
                  <input 
                    name="time" 
                    type="time" 
                    className="form-input" 
                    value={formData.time}
                    onChange={handleChange} 
                    required 
                  />
                </div>

                <div className="form-group">
                  <label>Seats</label>
                  <select 
                    name="seatsTotal" 
                    className="form-select" 
                    value={formData.seatsTotal}
                    onChange={handleChange}
                  >
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                    <option value="4">4</option>
                    <option value="5">5</option>
                    <option value="6">6</option>
                    <option value="7">7</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>WhatsApp Number</label>
                  <input 
                    name="contactNumber" 
                    className="form-input" 
                    placeholder="+91 98765 43210" 
                    value={formData.contactNumber}
                    onChange={handleChange} 
                    required 
                  />
                </div>

                <button type="submit" className="btn-primary btn-block" disabled={loading}>
                  {loading ? 'Posting...' : 'Post Ride'}
                </button>
              </form>
            </div>
          )}
        </>
      )}

      {/* --- MY RIDES VIEW --- */}
      {currentView === 'myrides' && (
        <div style={{marginTop: '2rem'}}>
          <h2 style={{textAlign: 'center', marginBottom: '2rem'}}>My Rides ({myRides.length})</h2>

          {loading ? (
            <p style={{textAlign: 'center', padding: '2rem'}}>Loading your rides...</p>
          ) : myRides.length === 0 ? (
            <div style={{textAlign: 'center', padding: '4rem'}}>
              <p>You haven't posted any rides yet.</p>
              <button className="btn-primary" onClick={() => setCurrentView('post')} style={{marginTop: '1rem'}}>
                Post Your First Ride
              </button>
            </div>
          ) : (
            <div className="rides-grid">
              {myRides.map((ride, index) => (
                <div key={ride.id || ride._id || index} className="ride-card" onClick={() => setSelectedRide(ride)}>
                  <div 
                    className="card-image" 
                    style={{
                      backgroundColor: '#ddd',
                      backgroundImage: `url('${getRideImage(ride.id || ride._id, index)}')`
                    }}
                  ></div>
                  <div className="card-content">
                    <div className="card-route">{ride.origin} → {ride.destination}</div>
                    <div className="card-details">
                      <span>{ride.date?.toDate ? ride.date.toDate().toDateString() : new Date(ride.date).toDateString()}, {ride.time}</span>
                    </div>
                    <div className="card-seats">{ride.seatsAvailable || ride.seatsTotal} / {ride.seatsTotal} seats</div>
                    <div className="your-ride-badge">
                      <strong>Your Ride</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* --- MODAL --- */}
      {selectedRide && <RideModal ride={selectedRide} onClose={() => setSelectedRide(null)} />}
      
      {/* --- PHONE NUMBER MODAL --- */}
      {phoneModalOpen && (
        <div className="modal-overlay" onClick={handlePhoneModalClose}>
          <div className="modal-content phone-modal" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={handlePhoneModalClose}>
              <FaTimes />
            </button>
            <div className="modal-header">📱 Enter Your Phone Number</div>
            <p style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>
              We need your phone number to connect you with ride hosts via WhatsApp
            </p>
            <div className="form-group">
              <label htmlFor="phone-input">WhatsApp Number</label>
              <input
                id="phone-input"
                type="tel"
                className="form-input"
                placeholder="+91 98765 43210"
                value={tempPhoneNumber}
                onChange={(e) => setTempPhoneNumber(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handlePhoneSubmit()}
                autoFocus
              />
            </div>
            <button 
              className="btn-primary btn-block" 
              onClick={handlePhoneSubmit}
              disabled={!tempPhoneNumber.trim()}
            >
              Save & Continue
            </button>
          </div>
        </div>
      )}
      
      {/* --- FOOTER --- */}
      <footer style={{
        textAlign: 'center',
        padding: '2rem',
        marginTop: '3rem',
        borderTop: '1px solid #e0e0e0',
        color: '#666',
        fontSize: '0.9rem'
      }}>
        Made with ❤️ by Kurkure and Pulkit
      </footer>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;