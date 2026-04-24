/**
 * Centralized API configuration.
 * Determines the backend URL based on the runtime environment:
 * - Electron: Uses the discovered Hub IP from the main process.
 * - Web Browser: Uses the current page's hostname with the backend port.
 */

const BACKEND_PORT = 4000;

let _cachedBaseUrl = null;

export async function getBackendUrl() {
  if (_cachedBaseUrl) return _cachedBaseUrl;

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

  // For web browsers: use the page's hostname (works for LAN access)
  const host = window.location.hostname || 'localhost';
  _cachedBaseUrl = `http://${host}:${BACKEND_PORT}`;
  return _cachedBaseUrl;
}

export function getBackendUrlSync() {
  if (_cachedBaseUrl) return _cachedBaseUrl;
  const host = window.location.hostname || 'localhost';
  return `http://${host}:${BACKEND_PORT}`;
}

export function getSocketUrl() {
  return getBackendUrlSync();
}
