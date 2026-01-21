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
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    hostName: '',
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

  // Fetch all rides
  const fetchRides = async () => {
    if (!currentUser) return;
    
    try {
      setLoading(true);
      setError('');
      
      const data = await apiCall('/api/rides');
      const validRides = Array.isArray(data) ? data : [];
      setRides(validRides.reverse());
    } catch (err) {
      console.error("Error fetching rides:", err);
      setError('Failed to load rides: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Load rides when user is logged in and view changes
  useEffect(() => {
    if (currentUser && (currentView === 'browse' || currentView === 'home')) {
      fetchRides();
    }
  }, [currentUser, currentView]);

  const handleLogin = async () => {
    try {
      await loginWithGoogle();
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!currentUser) {
      alert('Please log in first');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      const rideData = {
        hostName: formData.hostName || currentUser.displayName || 'Anonymous',
        hostEmail: currentUser.email,
        origin: formData.origin,
        destination: formData.destination,
        date: formData.date,
        time: formData.time,
        seatsTotal: parseInt(formData.seatsTotal),
        contactNumber: formData.contactNumber
      };
      
      await apiCall('/api/rides', {
        method: 'POST',
        body: JSON.stringify(rideData)
      });
      
      alert('Ride Posted Successfully! ✅');
      
      setFormData({ 
        hostName: '', 
        origin: '', 
        destination: '', 
        date: '', 
        time: '', 
        seatsTotal: 1, 
        contactNumber: ''
      });
      
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

    const passengerPhone = prompt('Enter your phone number (for WhatsApp):');
    if (!passengerPhone) return;

    try {
      setLoading(true);
      
      await apiCall(`/api/rides/${ride.id}/request`, {
        method: 'POST',
        body: JSON.stringify({
          passengerName: currentUser.displayName || 'BITS Student',
          passengerEmail: currentUser.email,
          passengerPhone: passengerPhone
        })
      });
      
      alert('✅ Request sent! The host will receive an email.');
      setSelectedRide(null);
      fetchRides();
      
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const getWhatsAppLink = (phone, ride) => {
    const cleanPhone = phone.replace(/\D/g, '');
    const message = `Hi! I'm interested in your BITSPool ride from ${ride.origin} to ${ride.destination} on ${new Date(ride.date).toLocaleDateString()}`;
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
            <span className="detail-value">{new Date(ride.date).toLocaleDateString()}</span>
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
            <div style={{marginTop: '1rem', display: 'flex', gap: '0.5rem'}}>
              <button 
                className="btn-primary" 
                style={{flex: 1}}
                onClick={() => handleRequestRide(ride)}
                disabled={loading}
              >
                {loading ? 'Sending...' : 'Request to Join'}
              </button>
              <a 
                href={getWhatsAppLink(ride.contactNumber, ride)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary"
                style={{
                  flex: 1, 
                  textAlign: 'center', 
                  textDecoration: 'none', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  backgroundColor: '#25D366'
                }}
              >
                📱 WhatsApp
              </a>
            </div>
          )}
          
          {isOwnRide && (
            <div style={{
              marginTop: '1rem', 
              padding: '1rem', 
              backgroundColor: '#e8f5e9', 
              borderRadius: '8px',
              textAlign: 'center'
            }}>
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
      <div className="logo" onClick={() => setCurrentView('home')} style={{cursor: 'pointer'}}>
        <div className="logo-icon">♦</div> BitsPool
      </div>
      <div className="nav-links">
        {currentUser && (
          <>
            <span className="nav-item" onClick={() => setCurrentView('home')}>Home</span>
            <span className="nav-item" onClick={() => setCurrentView('browse')}>Browse Rides</span>
            <span className="nav-item" onClick={() => setCurrentView('post')}>Post a Ride</span>
          </>
        )}
        <button className="btn-login" onClick={currentUser ? handleLogout : handleLogin}>
          {currentUser ? `Logout` : 'Sign in with BITS Email'}
        </button>
      </div>
    </nav>
  );

  return (
    <div className="App">
      <Navbar />

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
            <h1>Find or Offer a Ride from Pilani</h1>
            <p style={{color: 'white', fontSize: '1.2rem', marginBottom: '2rem'}}>
              {currentUser ? `Welcome, ${currentUser.displayName || currentUser.email.split('@')[0]}!` : 'Sign in with your BITS email'}
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
                          <span>{new Date(ride.date).toLocaleDateString()}, {ride.time}</span>
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
          <h2 style={{textAlign: 'center', marginBottom: '2rem'}}>All Available Rides ({rides.length})</h2>

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
                      <span>{new Date(ride.date).toLocaleDateString()}, {ride.time}</span>
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

      {/* --- MODAL --- */}
      {selectedRide && <RideModal ride={selectedRide} onClose={() => setSelectedRide(null)} />}
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
