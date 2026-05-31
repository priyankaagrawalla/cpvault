import { api, setToken, setStoredUser, getToken, getStoredUser } from './api.js';

window.api = api;
window.setAuthToken = setToken;
window.setAuthUser = setStoredUser;
window.getAuthToken = getToken;
window.getAuthUser = getStoredUser;

function showAuthError(msg) {
  const el = document.getElementById('auth-error');
  if (el) el.textContent = msg || '';
}

window.showLogin = function () {
  document.getElementById('auth-form-login')?.classList.remove('hidden');
  document.getElementById('auth-form-register')?.classList.add('hidden');
  document.getElementById('auth-sub').textContent = 'Sign in to sync your progress';
  showAuthError('');
};

window.showRegister = function () {
  document.getElementById('auth-form-login')?.classList.add('hidden');
  document.getElementById('auth-form-register')?.classList.remove('hidden');
  document.getElementById('auth-sub').textContent = 'Create your CP Vault account';
  showAuthError('');
};

window.submitLogin = async function () {
  showAuthError('');
  try {
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    const data = await api.login({ email, password });
    setToken(data.token);
    setStoredUser(data.user);
    await window.enterApp(data.user);
  } catch (e) {
    showAuthError(e.message);
  }
};

window.submitRegister = async function () {
  showAuthError('');
  try {
    const username = document.getElementById('reg-username').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const data = await api.register({ username, email, password });
    setToken(data.token);
    setStoredUser(data.user);
    await window.enterApp(data.user);
  } catch (e) {
    showAuthError(e.message);
  }
};

window.logoutUser = async function () {
  try {
    if (getToken()) await api.logout();
  } catch {
    /* ignore */
  }
  setToken('');
  setStoredUser(null);
  document.getElementById('app-root')?.classList.add('hidden');
  document.getElementById('auth-screen')?.classList.remove('hidden');
  window.showLogin();
};

window.importLegacyLocalStorage = async function () {
  if (!getToken()) {
    showAuthError('Sign in or register first, then import.');
    return;
  }
  try {
    const raw = localStorage.getItem('cpvault_v4');
    if (!raw) {
      showAuthError('No cpvault_v4 data found in this browser.');
      return;
    }
    const vault = JSON.parse(raw);
    const handles = {
      codeforces: localStorage.getItem('cpv_cf') || '',
      leetcode: localStorage.getItem('cpv_lc') || '',
      atcoder: localStorage.getItem('cpv_at') || '',
    };
    await api.importLocal(vault, handles);
    await window.loadStateFromServer();
    showAuthError('');
    alert('Local data imported successfully!');
    document.getElementById('auth-screen')?.classList.add('hidden');
    document.getElementById('app-root')?.classList.remove('hidden');
  } catch (e) {
    showAuthError(e.message);
  }
};

window.enterApp = async function (user) {
  document.getElementById('auth-screen')?.classList.add('hidden');
  document.getElementById('app-root')?.classList.remove('hidden');
  const display = user.displayName || user.username;
  const el = document.getElementById('user-display');
  if (el) el.textContent = display;
  const isAdmin = user.role === 'admin';
  document.getElementById('admin-nav-section')?.classList.toggle('hidden', !isAdmin);
  document.getElementById('admin-nav-item')?.classList.toggle('hidden', !isAdmin);
  if (typeof window.initTagClickDelegation === 'function') {
    window.initTagClickDelegation();
  }
  if (typeof window.loadStateFromServer === 'function') {
    try {
      await window.loadStateFromServer();
      populateTagSuggestions();
      updateBadges();
      startContestScheduler();
      renderDashboard();
    } catch (e) {
      console.error('Load failed:', e);
      showAuthError('Could not load data: ' + (e.message || 'server error') + '. Run: cd backend && npm run db:init');
      if (typeof window.renderDashboard === 'function') window.renderDashboard();
    }
  }
};

async function checkBackendStatus() {
  const el = document.getElementById('auth-backend-status');
  if (!el) return;
  try {
    const res = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/health`);
    if (res.ok) {
      el.innerHTML = '<span style="color:var(--green)">●</span> Server connected — register or sign in below';
      el.style.borderColor = 'rgba(29,201,160,0.3)';
      return true;
    }
    throw new Error('not ok');
  } catch {
    el.innerHTML =
      '<span style="color:var(--red)">●</span> Server not running. Open Terminal and run:<br><code style="font-size:10px;display:block;margin-top:6px;color:var(--amber)">cd backend && npm run dev</code><span style="display:block;margin-top:4px">Also need PostgreSQL — see SETUP_MAC.md</span>';
    el.style.borderColor = 'rgba(240,84,112,0.3)';
    return false;
  }
}

async function tryAutoLogin() {
  await checkBackendStatus();
  const token = getToken();
  if (!token) {
    window.showLogin();
    return;
  }
  try {
    const { user } = await api.me();
    setStoredUser(user);
    await window.enterApp(user);
  } catch {
    setToken('');
    setStoredUser(null);
    window.showLogin();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', tryAutoLogin);
} else {
  tryAutoLogin();
}
