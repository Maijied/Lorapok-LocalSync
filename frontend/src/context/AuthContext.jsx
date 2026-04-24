/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { clearCurrentUser, getCurrentUser, saveCurrentUser } from '../utils/db';
import { apiFetch } from '../utils/network';

const AuthContext = createContext(null);

const REFRESH_TOKEN_KEY = 'lorapok_refresh_token';
const REMEMBER_ME_KEY = 'lorapok_remember_me';

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [refreshToken, setRefreshToken] = useState(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');

  const persistRefreshToken = (token, remember) => {
    if (remember) {
      localStorage.setItem(REFRESH_TOKEN_KEY, token);
      localStorage.setItem(REMEMBER_ME_KEY, 'true');
    } else {
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      localStorage.removeItem(REMEMBER_ME_KEY);
    }
    setRefreshToken(token);
  };

  const clearSessionState = async (clearUser = false) => {
    setAccessToken(null);
    setRefreshToken(null);
    setIsUnlocked(false);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(REMEMBER_ME_KEY);
    if (clearUser) {
      setUser(null);
      setIsRegistered(false);
      await clearCurrentUser();
    }
  };

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const storedUser = await getCurrentUser();
        if (!storedUser) {
          return;
        }

        setUser(storedUser);
        setIsRegistered(true);

        const storedRefreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
        const rememberMe = localStorage.getItem(REMEMBER_ME_KEY) === 'true';
        if (!storedRefreshToken || !rememberMe) {
          return;
        }

        const response = await apiFetch('/auth/refresh', {
          method: 'POST',
          body: JSON.stringify({ refreshToken: storedRefreshToken }),
        });

        setUser(response.user);
        setAccessToken(response.accessToken);
        setRefreshToken(storedRefreshToken);
        setIsUnlocked(true);
        await saveCurrentUser(response.user);
      } catch (error) {
        console.error('Auto unlock failed:', error);
        await clearSessionState(false);
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, []);

  const register = async (name, pin, dp, shouldRemember = true) => {
    setAuthError('');
    const payload = {
      id: user?.id || uuidv4(),
      name,
      pin,
      dp,
    };

    const response = await apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    setUser(response.user);
    setAccessToken(response.accessToken);
    setIsRegistered(true);
    setIsUnlocked(true);
    persistRefreshToken(response.refreshToken, shouldRemember);
    await saveCurrentUser(response.user);

    return response.user;
  };

  const unlock = async (pin, shouldRemember = false) => {
    if (!user?.id) {
      setAuthError('No local account found');
      return false;
    }

    setAuthError('');

    try {
      const response = await apiFetch('/auth/unlock', {
        method: 'POST',
        body: JSON.stringify({ id: user.id, pin }),
      });

      setUser(response.user);
      setAccessToken(response.accessToken);
      setIsUnlocked(true);
      persistRefreshToken(response.refreshToken, shouldRemember);
      await saveCurrentUser(response.user);
      return true;
    } catch (error) {
      setAuthError(error.message);
      return false;
    }
  };

  const refreshAccessToken = async () => {
    const token = refreshToken || localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!token) {
      throw new Error('No refresh token available');
    }

    const response = await apiFetch('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: token }),
    });

    setUser(response.user);
    setAccessToken(response.accessToken);
    setRefreshToken(token);
    setIsUnlocked(true);
    await saveCurrentUser(response.user);
    return response.accessToken;
  };

  const logout = async () => {
    await clearSessionState(false);
  };

  const logoutCompletely = async () => {
    await clearSessionState(true);
  };

  const handleSessionExpired = async () => {
    await clearSessionState(false);
  };

  const value = {
    user,
    accessToken,
    refreshToken,
    loading,
    isRegistered,
    isUnlocked,
    authError,
    register,
    unlock,
    logout,
    logoutCompletely,
    refreshAccessToken,
    handleSessionExpired,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
