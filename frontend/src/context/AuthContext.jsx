import React, { createContext, useContext, useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { getCurrentUser, saveCurrentUser } from '../utils/db';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const storedUser = await getCurrentUser();
        if (storedUser) {
          setUser(storedUser);
          setIsRegistered(true);
        }
      } catch (error) {
        console.error("Failed to load user from DB", error);
      } finally {
        setLoading(false);
      }
    };
    loadUser();
  }, []);

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
    return newUser;
  };

  const unlock = async (pin) => {
    if (user && user.pin === pin) {
      setIsUnlocked(true);
      return true;
    }
    return false;
  };

  const logout = () => {
    setIsUnlocked(false);
  };

  return (
    <AuthContext.Provider value={{ user, loading, isRegistered, isUnlocked, register, unlock, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
