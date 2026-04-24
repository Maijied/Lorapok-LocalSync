/**
 * Web Crypto API-based Encryption Utility for Lorapok Communicator
 */

const ENCRYPTION_ALGORITHM = 'AES-GCM';
const PBKDF2_ITERATIONS = 100000;
const SALT_SIZE = 16;
const IV_SIZE = 12;

// Convert string to ArrayBuffer
function str2ab(str) {
  const buf = new ArrayBuffer(str.length);
  const bufView = new Uint8Array(buf);
  for (let i = 0, strLen = str.length; i < strLen; i++) {
    bufView[i] = str.charCodeAt(i);
  }
  return buf;
}

// Convert ArrayBuffer to Base64 string
function ab2base64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

// Convert Base64 string to ArrayBuffer
function base642ab(base64) {
  const binary_string = window.atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Derive encryption key from PIN
 */
export async function deriveKey(pin, saltBuf) {
  const encoder = new TextEncoder();
  const pinKey = await window.crypto.subtle.importKey(
    'raw',
    encoder.encode(pin),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBuf,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    pinKey,
    { name: ENCRYPTION_ALGORITHM, length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt a message
 * @param {string} message The text to encrypt
 * @param {string} pin The user's PIN
 * @returns {Promise<object>} { encrypted: string, iv: string, salt: string }
 */
export async function encryptMessage(message, pin) {
  const saltBuf = window.crypto.getRandomValues(new Uint8Array(SALT_SIZE));
  const ivBuf = window.crypto.getRandomValues(new Uint8Array(IV_SIZE));

  const key = await deriveKey(pin, saltBuf);
  const encoder = new TextEncoder();

  const encryptedBuf = await window.crypto.subtle.encrypt(
    {
      name: ENCRYPTION_ALGORITHM,
      iv: ivBuf
    },
    key,
    encoder.encode(message)
  );

  return {
    encrypted: ab2base64(encryptedBuf),
    iv: ab2base64(ivBuf),
    salt: ab2base64(saltBuf)
  };
}

/**
 * Decrypt a message
 * @param {object} encryptedData { encrypted: string, iv: string, salt: string }
 * @param {string} pin The user's PIN
 * @returns {Promise<string>} The decrypted text
 */
export async function decryptMessage(encryptedData, pin) {
  const saltBuf = base642ab(encryptedData.salt);
  const ivBuf = base642ab(encryptedData.iv);
  const encryptedBuf = base642ab(encryptedData.encrypted);

  const key = await deriveKey(pin, saltBuf);

  const decryptedBuf = await window.crypto.subtle.decrypt(
    {
      name: ENCRYPTION_ALGORITHM,
      iv: ivBuf
    },
    key,
    encryptedBuf
  );

  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuf);
}
