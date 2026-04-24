import CryptoJS from 'crypto-js';

/**
 * Client-side encryption utility for Lorapok Communicator
 * Uses AES encryption from crypto-js
 */

export class ClientEncryption {
  constructor() {
    this.defaultKeySize = 256;
  }

  /**
   * Derive encryption key from PIN
   * Used for local storage encryption
   */
  deriveKeyFromPIN(pin) {
    // Hash PIN multiple times to create a stronger key
    let hash = pin;
    for (let i = 0; i < 10000; i++) {
      hash = CryptoJS.SHA256(hash).toString();
    }
    return hash;
  }

  /**
   * Encrypt message
   * @param {string} message - Message to encrypt
   * @param {string} pin - User PIN for key derivation
   * @returns {object} - Encrypted message object
   */
  encryptMessage(message, pin) {
    try {
      const key = this.deriveKeyFromPIN(pin);
      const encrypted = CryptoJS.AES.encrypt(message, key).toString();
      return {
        encrypted: encrypted,
        keyDerivation: 'pbkdf2-sha256'
      };
    } catch (error) {
      console.error('Encryption error:', error);
      throw error;
    }
  }

  /**
   * Decrypt message
   * @param {object} encryptedData - Encrypted message object
   * @param {string} pin - User PIN for key derivation
   * @returns {string} - Decrypted message
   */
  decryptMessage(encryptedData, pin) {
    try {
      const key = this.deriveKeyFromPIN(pin);
      const decrypted = CryptoJS.AES.decrypt(encryptedData, key);
      const message = decrypted.toString(CryptoJS.enc.Utf8);
      return message;
    } catch (error) {
      console.error('Decryption error:', error);
      throw error;
    }
  }

  /**
   * Encrypt local storage data
   * @param {object} data - Data to encrypt
   * @param {string} pin - User PIN
   * @returns {string} - Encrypted JSON string
   */
  encryptData(data, pin) {
    try {
      const jsonString = JSON.stringify(data);
      const key = this.deriveKeyFromPIN(pin);
      const encrypted = CryptoJS.AES.encrypt(jsonString, key).toString();
      return encrypted;
    } catch (error) {
      console.error('Data encryption error:', error);
      throw error;
    }
  }

  /**
   * Decrypt local storage data
   * @param {string} encryptedData - Encrypted data
   * @param {string} pin - User PIN
   * @returns {object} - Decrypted data object
   */
  decryptData(encryptedData, pin) {
    try {
      const key = this.deriveKeyFromPIN(pin);
      const decrypted = CryptoJS.AES.decrypt(encryptedData, key);
      const jsonString = decrypted.toString(CryptoJS.enc.Utf8);
      return JSON.parse(jsonString);
    } catch (error) {
      console.error('Data decryption error:', error);
      throw error;
    }
  }

  /**
   * Generate random encryption key for group chats
   * @returns {string} - Random key in hex
   */
  generateRandomKey() {
    return CryptoJS.lib.WordArray.random(32).toString();
  }

  /**
   * Hash data for verification
   * @param {string} data - Data to hash
   * @returns {string} - SHA256 hash
   */
  hashData(data) {
    return CryptoJS.SHA256(data).toString();
  }

  /**
   * Verify data integrity
   * @param {string} data - Original data
   * @param {string} hash - Hash to verify against
   * @returns {boolean} - True if data matches hash
   */
  verifyDataIntegrity(data, hash) {
    return this.hashData(data) === hash;
  }

  /**
   * Create a temporary encryption key for session
   * @returns {string} - Session key
   */
  createSessionKey() {
    const timestamp = Date.now().toString();
    const randomPart = CryptoJS.lib.WordArray.random(16).toString();
    return CryptoJS.SHA256(timestamp + randomPart).toString();
  }
}

// Export singleton instance
export const encryption = new ClientEncryption();
