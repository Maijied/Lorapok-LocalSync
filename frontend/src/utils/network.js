const trimTrailingSlash = (value) => value.replace(/\/+$/, '');

export const getBackendBaseUrl = () => {
  const configured = import.meta.env.VITE_BACKEND_URL;
  if (configured) {
    return trimTrailingSlash(configured);
  }

  if (typeof window === 'undefined') {
    return 'http://127.0.0.1:4000';
  }

  const { protocol, hostname } = window.location;
  return `${protocol}//${hostname}:4000`;
};

export const apiFetch = async (path, options = {}) => {
  const response = await fetch(`${getBackendBaseUrl()}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    const message = data?.error || 'Request failed';
    throw new Error(message);
  }

  return data;
};
