/**
 * Centralized API configuration.
 * Determines the backend URL based on the runtime environment:
 * - Electron: Uses the discovered Hub IP from the main process.
 * - Web Browser: Uses the current page's hostname with the backend port.
 */

const BACKEND_PORT = 4000;

let _cachedBaseUrl = null;

export async function getBackendUrl() {
  if (_cachedBaseUrl !== null) return _cachedBaseUrl;

  // If we are on HTTPS, we MUST use relative paths to avoid Mixed Content blocks
  // especially when connecting to IP addresses which browsers won't auto-upgrade.
  if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
    _cachedBaseUrl = '';
    return _cachedBaseUrl;
  }

  // In Electron, ask the main process for the discovered Hub IP
  if (window.electronAPI?.getHubIp) {
    try {
      const hubIp = await window.electronAPI.getHubIp();
      if (hubIp) {
        _cachedBaseUrl = `http://${hubIp}:${BACKEND_PORT}`;
        return _cachedBaseUrl;
      }
    } catch (e) {
      console.warn('Failed to get Hub IP from Electron:', e);
    }
  }

  _cachedBaseUrl = '';
  return _cachedBaseUrl;
}

export function getBackendUrlSync() {
  if (_cachedBaseUrl !== null) return _cachedBaseUrl;
  return '';
}

export function getSocketUrl() {
  return getBackendUrlSync();
}

/**
 * Ensures an asset URL (like a profile picture or upload) is safe for the current environment.
 * Fixes Mixed Content errors on HTTPS by converting absolute HTTP URLs to relative paths.
 */
export function formatAssetUrl(url) {
  if (!url) return '';
  if (url.startsWith('data:')) return url; // Base64
  if (url.startsWith('blob:')) return url; // Blobs
  
  // If we are on HTTPS, strip the domain part if it's an absolute URL to 127.0.0.1 or similar
  if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
    if (url.startsWith('http://')) {
      // Find the start of the path (after the domain)
      const urlObj = new URL(url);
      return urlObj.pathname; // Returns "/uploads/..."
    }
  }
  
  return url;
}
