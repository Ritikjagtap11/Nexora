import { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail,
  onAuthStateChanged,
  sendEmailVerification,
  getAuth
} from 'firebase/auth';
import { auth, googleProvider } from '../services/firebase';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setTokenState] = useState(() => localStorage.getItem('nexora_token') || null);

  const setToken = (newToken) => {
    setTokenState(newToken);
    if (newToken) {
      localStorage.setItem('nexora_token', newToken);
      axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    } else {
      localStorage.removeItem('nexora_token');
      delete axios.defaults.headers.common['Authorization'];
    }
  };
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getAuth()
    
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        try {
          // Always get fresh token on auth state change
          const freshToken = await user.getIdToken(true)
          setToken(freshToken)
          localStorage.setItem('nexora_token', freshToken)
          
          // Auto-refresh every 50 minutes
          const intervalId = setInterval(async () => {
            try {
              const newToken = await user.getIdToken(true)
              setToken(newToken)
              localStorage.setItem('nexora_token', newToken)
              console.log('Token auto-refreshed')
            } catch (e) {
              console.error('Auto-refresh failed:', e)
            }
          }, 50 * 60 * 1000)
          
          // Store interval ID for cleanup
          window._tokenRefreshInterval = intervalId
          
        } catch (e) {
          console.error('Token fetch failed:', e)
        }
      } else {
        setToken(null)
        localStorage.removeItem('nexora_token')
        if (window._tokenRefreshInterval) {
          clearInterval(window._tokenRefreshInterval)
        }
      }
      setLoading(false);
    })
    
    return () => {
      unsubscribe()
      if (window._tokenRefreshInterval) {
        clearInterval(window._tokenRefreshInterval)
      }
    }
  }, [])

  const login = async (email, password) => {
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message || "Login failed" };
    } finally {
      setLoading(false);
    }
  };

  const signup = async (name, email, password) => {
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await sendEmailVerification(userCredential.user);
      return { success: true, message: "Please check your email to verify your account." };
    } catch (error) {
      return { success: false, message: error.message || "Signup failed" };
    } finally {
      setLoading(false);
    }
  };

  const loginWithGoogle = async () => {
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message || "Google sign in failed" };
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (email) => {
    try {
      await sendPasswordResetEmail(auth, email);
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message || "Failed to reset password" };
    }
  };

  const logout = async () => {
    try {
      await auth.signOut();
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, setToken, login, signup, loginWithGoogle, resetPassword, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
