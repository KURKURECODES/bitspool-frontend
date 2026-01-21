// AuthContext.js
import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  GoogleAuthProvider, 
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
  browserLocalPersistence,
  setPersistence
} from 'firebase/auth';
import { auth } from './firebase.config';

const provider = new GoogleAuthProvider();
provider.setCustomParameters({
  prompt: 'select_account',
  hd: 'bits-pilani.ac.in'
});

const AuthContext = createContext();

// Detect mobile device
const isMobile = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    (window.innerWidth <= 768);
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const verifyBitsEmail = (email) => {
    const allowedDomains = [
      'pilani.bits-pilani.ac.in',
      'goa.bits-pilani.ac.in',
      'hyderabad.bits-pilani.ac.in',
      'bits-pilani.ac.in'
    ];
    
    if (!email) return false;
    const domain = email.split('@')[1];
    return allowedDomains.includes(domain);
  };

  const loginWithGoogle = async () => {
    try {
      setError(null);
      
      // Ensure persistence is set before login
      await setPersistence(auth, browserLocalPersistence);
      
      // Use redirect for mobile, popup for desktop
      if (isMobile()) {
        // Store a flag to indicate we're in the middle of redirect login
        sessionStorage.setItem('authRedirectPending', 'true');
        await signInWithRedirect(auth, provider);
        return null; // Redirect will handle the rest
      } else {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        
        if (!verifyBitsEmail(user.email)) {
          await signOut(auth);
          throw new Error('Please use your BITS email to sign in');
        }
        
        return user;
      }
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };

  const getIdToken = async () => {
    if (currentUser) {
      return await currentUser.getIdToken();
    }
    return null;
  };

  useEffect(() => {
    let isMounted = true;
    
    // Handle redirect result for mobile login
    const handleRedirectResult = async () => {
      try {
        // Check if we're returning from a redirect
        const isPending = sessionStorage.getItem('authRedirectPending');
        
        const result = await getRedirectResult(auth);
        
        // Clear the pending flag
        sessionStorage.removeItem('authRedirectPending');
        
        if (result && result.user) {
          const user = result.user;
          console.log('Redirect result received for:', user.email);
          
          if (!verifyBitsEmail(user.email)) {
            await signOut(auth);
            if (isMounted) setError('Please use your BITS email to sign in');
          }
        } else if (isPending) {
          // Redirect was initiated but no result - user may have cancelled
          console.log('Redirect was pending but no result received');
        }
      } catch (err) {
        console.error('Redirect result error:', err);
        sessionStorage.removeItem('authRedirectPending');
        if (isMounted) setError(err.message);
      }
    };
    
    handleRedirectResult();
    
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('Auth state changed:', user?.email || 'no user');
      
      if (user) {
        if (!verifyBitsEmail(user.email)) {
          await signOut(auth);
          if (isMounted) {
            setError('Only BITS email addresses are allowed');
            setCurrentUser(null);
          }
        } else {
          if (isMounted) {
            setCurrentUser(user);
            setError(null);
          }
        }
      } else {
        if (isMounted) {
          setCurrentUser(null);
        }
      }
      if (isMounted) {
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const value = {
    currentUser,
    loginWithGoogle,
    logout,
    getIdToken,
    loading,
    error
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};