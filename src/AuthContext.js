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

// Detect if we're in a problematic in-app browser
const isInAppBrowser = () => {
  const ua = navigator.userAgent || navigator.vendor || window.opera;
  // Detect Instagram, Facebook, LinkedIn, Twitter in-app browsers
  return /FBAN|FBAV|Instagram|LinkedIn|Twitter|Snapchat/i.test(ua);
};

// Detect mobile device
const isMobile = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
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
      
      // Check if in-app browser - always use popup (redirect won't work)
      // Also use popup for mobile since redirect has many issues
      const usePopup = isInAppBrowser() || !isMobile();
      
      if (usePopup) {
        // Use popup for desktop AND in-app browsers
        try {
          const result = await signInWithPopup(auth, provider);
          const user = result.user;
          
          if (!verifyBitsEmail(user.email)) {
            await signOut(auth);
            throw new Error('Please use your BITS email to sign in');
          }
          
          return user;
        } catch (popupErr) {
          // If popup blocked on mobile, try redirect as fallback
          if (popupErr.code === 'auth/popup-blocked' && isMobile()) {
            console.log('Popup blocked, trying redirect...');
            localStorage.setItem('authRedirectPending', 'true');
            await signInWithRedirect(auth, provider);
            return null;
          }
          throw popupErr;
        }
      } else {
        // Mobile native browser - try popup first, fallback to redirect
        try {
          const result = await signInWithPopup(auth, provider);
          const user = result.user;
          
          if (!verifyBitsEmail(user.email)) {
            await signOut(auth);
            throw new Error('Please use your BITS email to sign in');
          }
          
          return user;
        } catch (popupErr) {
          // Popup failed/blocked, use redirect
          if (popupErr.code === 'auth/popup-blocked' || popupErr.code === 'auth/popup-closed-by-user') {
            console.log('Popup failed, using redirect...');
            localStorage.setItem('authRedirectPending', 'true');
            await signInWithRedirect(auth, provider);
            return null;
          }
          throw popupErr;
        }
      }
    } catch (err) {
      console.error('Login error:', err);
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
    
    // Handle redirect result for mobile login (fallback case)
    const handleRedirectResult = async () => {
      try {
        // Check if we're returning from a redirect (use localStorage - survives page reload)
        const isPending = localStorage.getItem('authRedirectPending');
        
        if (isPending) {
          console.log('Checking redirect result...');
          const result = await getRedirectResult(auth);
          
          // Clear the pending flag
          localStorage.removeItem('authRedirectPending');
          
          if (result && result.user) {
            const user = result.user;
            console.log('Redirect login successful:', user.email);
            
            if (!verifyBitsEmail(user.email)) {
              await signOut(auth);
              if (isMounted) setError('Please use your BITS email to sign in');
            }
          } else {
            console.log('Redirect completed but no user - may have been cancelled');
          }
        }
      } catch (err) {
        console.error('Redirect result error:', err);
        localStorage.removeItem('authRedirectPending');
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
            // Clear any pending redirect flag on successful auth
            localStorage.removeItem('authRedirectPending');
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