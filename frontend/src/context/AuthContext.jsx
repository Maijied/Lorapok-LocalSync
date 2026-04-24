import React, { createContext, useContext, useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { getCurrentUser, saveCurrentUser } from '../utils/db';
import { encryption } from '../utils/crypto';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

const REMEMBER_TOKEN_KEY = 'lorapok_remember_token';
const REMEMBER_TOKEN_EXPIRY_KEY = 'lorapok_token_expiry';
const REMEMBER_TOKEN_EXPIRY_DAYS = 30;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [rememberToken, setRememberToken] = useState(null);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const storedUser = await getCurrentUser();
        if (storedUser) {
          setUser(storedUser);
          setIsRegistered(true);

          // Try to auto-unlock with remember token
          const token = localStorage.getItem(REMEMBER_TOKEN_KEY);
          const expiry = localStorage.getItem(REMEMBER_TOKEN_EXPIRY_KEY);

          if (token && expiry && parseInt(expiry) > Date.now()) {
            // Token is valid - auto-unlock
            setRememberToken(token);
            setIsUnlocked(true);
            console.log('User auto-unlocked with remember token');
          }
        }
      } catch (error) {
        console.error("Failed to load user from DB", error);
      } finally {
        setLoading(false);
      }
    };
    loadUser();
  }, []);

  const generateRememberToken = (pin) => {
    // Create a token using user ID and PIN hash
    const tokenData = `${user?.id || uuidv4()}_${Date.now()}_${Math.random()}`;
    const encryptedToken = encryption.hashData(tokenData + pin);
    return encryptedToken;
  };

  const saveRememberToken = (token) => {
    try {
      const expiryTime = Date.now() + REMEMBER_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
      localStorage.setItem(REMEMBER_TOKEN_KEY, token);
      localStorage.setItem(REMEMBER_TOKEN_EXPIRY_KEY, expiryTime.toString());
      setRememberToken(token);
    } catch (error) {
      console.error('Failed to save remember token:', error);
    }
  };

  const clearRememberToken = () => {
    try {
      localStorage.removeItem(REMEMBER_TOKEN_KEY);
      localStorage.removeItem(REMEMBER_TOKEN_EXPIRY_KEY);
      setRememberToken(null);
    } catch (error) {
      console.error('Failed to clear remember token:', error);
    }
  };

  const register = async (name, pin, dp) => {
    const newUser = {
      id: uuidv4(),
      name,
      pin,
      dp,
      createdAt: Date.now()
    };
    await saveCurrentUser(newUser);
    setUser(newUser);
    setIsRegistered(true);
    setIsUnlocked(true);

    // Generate and save remember token
    const token = generateRememberToken(pin);
    saveRememberToken(token);

    return newUser;
  };

  const unlock = async (pin, shouldRemember = false) => {
    if (user && user.pin === pin) {
      setIsUnlocked(true);

      // Save remember token if requested
      if (shouldRemember) {
        const token = generateRememberToken(pin);
        saveRememberToken(token);
      }

      return true;
    }
    return false;
  };

  const logout = () => {
    setIsUnlocked(false);
    clearRememberToken();
  };

  const logoutCompletely = async () => {
    // Complete logout - also clear user data
    setIsUnlocked(false);
    setUser(null);
    setIsRegistered(false);
    clearRememberToken();
    // In real app, also delete user from IndexedDB if needed
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      isRegistered,
      isUnlocked,
      rememberToken,
      register,
      unlock,
      logout,
      logoutCompletely,
      saveRememberToken,
      clearRememberToken
    }}>
      {children}
    </AuthContext.Provider>
  );
};

