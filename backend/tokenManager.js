const jwt = require('jsonwebtoken');

/**
 * Token management for Lorapok Communicator
 * Handles JWT token generation and validation
 */

class TokenManager {
  constructor(secret = null) {
    // Use environment variable or fallback
    this.secret = secret || process.env.JWT_SECRET || 'lorapok-local-network-secret-key-change-in-production';
    this.tokenExpiration = '30d'; // 30 days
    this.refreshTokenExpiration = '90d'; // 90 days
  }

  /**
   * Generate access token
   */
  generateAccessToken(userId, userData) {
    const payload = {
      userId,
      name: userData.name,
      dp: userData.dp,
      type: 'access'
    };

    return jwt.sign(payload, this.secret, {
      expiresIn: this.tokenExpiration,
      issuer: 'lorapok-communicator'
    });
  }

  /**
   * Generate refresh token
   */
  generateRefreshToken(userId) {
    const payload = {
      userId,
      type: 'refresh'
    };

    return jwt.sign(payload, this.secret, {
      expiresIn: this.refreshTokenExpiration,
      issuer: 'lorapok-communicator'
    });
  }

  /**
   * Verify access token
   */
  verifyAccessToken(token) {
    try {
      const decoded = jwt.verify(token, this.secret, {
        issuer: 'lorapok-communicator'
      });

      if (decoded.type !== 'access') {
        throw new Error('Invalid token type');
      }

      return decoded;
    } catch (error) {
      console.error('Token verification error:', error.message);
      return null;
    }
  }

  /**
   * Verify refresh token
   */
  verifyRefreshToken(token) {
    try {
      const decoded = jwt.verify(token, this.secret, {
        issuer: 'lorapok-communicator'
      });

      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      return decoded;
    } catch (error) {
      console.error('Refresh token verification error:', error.message);
      return null;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  refreshAccessToken(refreshToken, userData) {
    const decoded = this.verifyRefreshToken(refreshToken);
    if (!decoded) {
      return null;
    }

    return this.generateAccessToken(decoded.userId, userData);
  }

  /**
   * Decode token without verification (for debugging)
   */
  decodeToken(token) {
    try {
      return jwt.decode(token);
    } catch (error) {
      console.error('Token decode error:', error.message);
      return null;
    }
  }

  /**
   * Get token expiration time
   */
  getTokenExpiration(token) {
    const decoded = jwt.decode(token);
    if (!decoded || !decoded.exp) {
      return null;
    }

    return new Date(decoded.exp * 1000);
  }

  /**
   * Check if token is expired
   */
  isTokenExpired(token) {
    const expiration = this.getTokenExpiration(token);
    if (!expiration) {
      return true;
    }

    return expiration < new Date();
  }

  /**
   * Check if token expires within N days
   */
  expiresWithin(token, days) {
    const expiration = this.getTokenExpiration(token);
    if (!expiration) {
      return true;
    }

    const now = new Date();
    const thresholdTime = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    return expiration < thresholdTime;
  }
}

module.exports = TokenManager;
