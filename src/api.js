const API_URL = (process.env.REACT_APP_API_URL || '').replace(/\/$/, '');
const TOKEN_KEY = 'storyAppToken';
const EMAIL_KEY = 'storyAppEmail';
const ROLE_KEY = 'storyAppRole';

let authToken = null;
try {
  authToken = localStorage.getItem(TOKEN_KEY);
} catch {}

export const setSession = (token, email, role) => {
  authToken = token;
  try {
    localStorage.setItem(TOKEN_KEY, token);
    if (email) localStorage.setItem(EMAIL_KEY, email);
    if (role) localStorage.setItem(ROLE_KEY, role);
  } catch {}
};

export const clearSession = () => {
  authToken = null;
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(EMAIL_KEY);
    localStorage.removeItem(ROLE_KEY);
  } catch {}
};

export const getStoredEmail = () => {
  try { return localStorage.getItem(EMAIL_KEY); } catch { return null; }
};

export const getStoredRole = () => {
  try { return localStorage.getItem(ROLE_KEY) || 'user'; } catch { return 'user'; }
};

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
      body: body !== undefined ? JSON.stringify(body) : undefined,
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
  me: () => request('/api/me', { auth: true }),
  getVault: () => request('/api/vault', { auth: true }),
  putVault: (stories) => request('/api/vault', { method: 'PUT', auth: true, body: stories }),
  deleteAccount: () => request('/api/account', { method: 'DELETE', auth: true }),
  health: () => request('/api/health'),
  adminListUsers: () => request('/api/admin/users', { auth: true }),
  adminUpdateRole: (id, role) =>
    request(`/api/admin/users/${encodeURIComponent(id)}/role`, { method: 'PATCH', auth: true, body: { role } }),
  adminDeleteUser: (id) =>
    request(`/api/admin/users/${encodeURIComponent(id)}`, { method: 'DELETE', auth: true }),
};
