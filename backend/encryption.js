const crypto = require('crypto');

/**
 * PIN-based encryption utility for Lorapok Communicator
 * Uses AES-256-GCM for authenticated encryption
 */

class EncryptionManager {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    this.encoding = 'hex';
    this.authTagLength = 16; // 128 bits
  }

  /**
   * Derive encryption key from user PIN
   * Uses PBKDF2 with salt for key derivation
   */
  deriveKeyFromPIN(pin, salt = null) {
    if (!salt) {
      // Generate a random salt (16 bytes)
      salt = crypto.randomBytes(16);
    } else if (typeof salt === 'string') {
      salt = Buffer.from(salt, this.encoding);
    }

    const iterations = 100000;
    const keyLength = 32; // 256 bits for AES-256
    const digest = 'sha256';

    const key = crypto.pbkdf2Sync(pin, salt, iterations, keyLength, digest);

    return {
      key,
      salt: salt.toString(this.encoding)
    };
  }

  /**
   * Encrypt message content
   */
  encryptMessage(content, pin) {
    try {
      const { key, salt } = this.deriveKeyFromPIN(pin);

      // Generate random IV (16 bytes)
      const iv = crypto.randomBytes(16);

      // Create cipher
      const cipher = crypto.createCipheriv(this.algorithm, key, iv);

      // Encrypt content
      let encrypted = cipher.update(content, 'utf8', this.encoding);
      encrypted += cipher.final(this.encoding);

      // Get auth tag
      const authTag = cipher.getAuthTag();

      // Return combined data: salt + iv + authTag + encrypted
      const result = {
        encrypted: encrypted,
        iv: iv.toString(this.encoding),
        authTag: authTag.toString(this.encoding),
        salt: salt
      };

      return result;
    } catch (error) {
      console.error('Encryption error:', error);
      throw error;
    }
  }

  /**
   * Decrypt message content
   */
  decryptMessage(encryptedData, pin) {
    try {
      const { key } = this.deriveKeyFromPIN(pin, encryptedData.salt);

      const iv = Buffer.from(encryptedData.iv, this.encoding);
      const authTag = Buffer.from(encryptedData.authTag, this.encoding);
      const encrypted = encryptedData.encrypted;

      const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted, this.encoding, 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      console.error('Decryption error:', error);
      throw error;
    }
  }

  /**
   * Hash PIN for secure storage (don't hash in plaintext!)
   */
  hashPIN(pin) {
    return crypto.createHash('sha256').update(pin).digest(this.encoding);
  }

  /**
   * Verify PIN against hash
   */
  verifyPIN(pin, hash) {
    return this.hashPIN(pin) === hash;
  }

  /**
   * Generate random encryption key
   */
  generateRandomKey() {
    return crypto.randomBytes(32).toString(this.encoding);
  }

  /**
   * Encrypt group key for sharing
   */
  encryptGroupKey(groupKey, recipientPublicKey) {
    // This would use RSA or ECDH for public key encryption
    // For now, return a placeholder
    try {
      // In a real implementation, use:
      // crypto.publicEncrypt({ key: recipientPublicKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING }, ...)
      return groupKey; // Placeholder
    } catch (error) {
      console.error('Error encrypting group key:', error);
      throw error;
    }
  }
}

module.exports = EncryptionManager;
