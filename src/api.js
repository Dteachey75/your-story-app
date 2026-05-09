const API_URL = (process.env.REACT_APP_API_URL || '').replace(/\/$/, '');

let authToken = null;

export const setToken = (t) => { authToken = t; };
export const clearToken = () => { authToken = null; };
export const hasToken = () => Boolean(authToken);

async function request(path, { method = 'GET', body, auth = false } = {}) {
  if (!API_URL) {
    throw new Error('API URL not configured. Set REACT_APP_API_URL.');
  }
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    if (!authToken) throw new Error('Not authenticated');
    headers.Authorization = `Bearer ${authToken}`;
  }

  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Network error. Check your connection.');
  }

  let data = null;
  try { data = await res.json(); } catch {}

  if (!res.ok) {
    const err = new Error(data?.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  signup: (payload) => request('/api/auth/signup', { method: 'POST', body: payload }),
  login: (payload) => request('/api/auth/login', { method: 'POST', body: payload }),
  getVault: () => request('/api/vault', { auth: true }),
  putVault: (vault) => request('/api/vault', { method: 'PUT', auth: true, body: vault }),
  deleteAccount: () => request('/api/account', { method: 'DELETE', auth: true }),
  health: () => request('/api/health'),
};
