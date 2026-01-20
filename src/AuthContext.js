// AuthContext.js
import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  GoogleAuthProvider, 
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged 
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
      
      // Use redirect for mobile, popup for desktop
      if (isMobile()) {
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
    // Handle redirect result for mobile login
    const handleRedirectResult = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result) {
          const user = result.user;
          if (!verifyBitsEmail(user.email)) {
            await signOut(auth);
            setError('Please use your BITS email to sign in');
          }
        }
      } catch (err) {
        setError(err.message);
      }
    };
    
    handleRedirectResult();
    
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        if (!verifyBitsEmail(user.email)) {
          await signOut(auth);
          setError('Only BITS email addresses are allowed');
          setCurrentUser(null);
        } else {
          setCurrentUser(user);
          setError(null);
        }
      } else {
        setCurrentUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
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