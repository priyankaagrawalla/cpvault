const API_BASE = import.meta.env.VITE_API_URL || '/api';

let authToken = localStorage.getItem('cpvault_token') || '';

export function getToken() {
  return authToken;
}

export function setToken(token) {
  authToken = token || '';
  if (token) localStorage.setItem('cpvault_token', token);
  else localStorage.removeItem('cpvault_token');
}

export function getStoredUser() {
  try {
    const u = localStorage.getItem('cpvault_user');
    return u ? JSON.parse(u) : null;
  } catch {
    return null;
  }
}

export function setStoredUser(user) {
  if (user) localStorage.setItem('cpvault_user', JSON.stringify(user));
  else localStorage.removeItem('cpvault_user');
}

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText || 'Request failed');
  return data;
}

export const api = {
  register: (body) => request('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body) => request('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me'),
  getData: () => request('/data'),
  saveData: (state) => request('/data', { method: 'PUT', body: JSON.stringify(state) }),
  importLocal: (vault, handles) =>
    request('/data/import-local', {
      method: 'POST',
      body: JSON.stringify({ vault, handles }),
    }),
  getProfile: () => request('/profile'),
  updateProfile: (body) => request('/profile', { method: 'PUT', body: JSON.stringify(body) }),
  getHandles: () => request('/handles'),
  updateHandles: (body) => request('/handles', { method: 'PUT', body: JSON.stringify(body) }),
  adminUsers: () => request('/admin/users'),
  adminUser: (id) => request(`/admin/users/${id}`),
  contestAnalytics: () => request('/contests/analytics'),
  sendContestReminders: () =>
    request('/notifications/contest-reminders', { method: 'POST' }),
  forgotPassword: (email) =>
    request('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (token, password) =>
    request('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) }),
};
