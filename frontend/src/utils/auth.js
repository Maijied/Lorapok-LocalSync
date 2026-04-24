/**
 * Auth Utility for Lorapok Communicator
 */

const TOKEN_KEY = 'lorapok_access_token';
const USER_KEY = 'lorapok_user_data';

export const auth = {
  /**
   * Save token and user data to localStorage
   */
  login(token, userData) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(userData));
  },

  /**
   * Clear auth data
   */
  logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },

  /**
   * Get the current access token
   */
  getToken() {
    return localStorage.getItem(TOKEN_KEY);
  },

  /**
   * Get the current user data
   */
  getUser() {
    const data = localStorage.getItem(USER_KEY);
    if (!data) return null;
    try {
      return JSON.parse(data);
    } catch (e) {
      return null;
    }
  },

  /**
   * Check if user is logged in
   */
  isAuthenticated() {
    return !!this.getToken() && !!this.getUser();
  }
};
