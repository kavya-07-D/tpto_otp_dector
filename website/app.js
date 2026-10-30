
/**
 * SecureOTP — ESP32 Time-Based OTP Authentication System
 * Frontend Controller
 * Backend: Render Flask
 * Theme: Light Blue & White / Black Text
 */

(function () {
  'use strict';

  // ==========================================
  // 1. BACKEND CONFIGURATION
  // ==========================================

  const API_BASE = 'https://tpto-otp-dector.onrender.com';

  async function apiRequest(endpoint, options = {}) {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });

    return response;
  }

  // ==========================================
  // 2. APPLICATION STATE
  // ==========================================

  const state = {
    isAuthenticated: false,
    isRevealed: false,
    realOtp: null,
    timeRemaining: 30,
    countdownInterval: null,
    activeTab: 'auth'
  };

  // ==========================================
  // 3. DOM ELEMENTS
  // ==========================================

  const el = {
    loginScreen: document.getElementById('loginScreen'),
    appScreen: document.getElementById('appScreen'),

    loginForm: document.getElementById('loginForm'),
    loginKeyInput: document.getElementById('loginKeyInput'),
    loginSubmitBtn: document.getElementById('loginSubmitBtn'),
    loginErrorAlert: document.getElementById('loginErrorAlert'),
    loginErrorText: document.getElementById('loginErrorText'),
    toggleLoginKeyVis: document.getElementById('toggleLoginKeyVis'),

    tabAuthBtn: document.getElementById('tabAuthBtn'),
    tabHistoryBtn: document.getElementById('tabHistoryBtn'),
    logoutBtn: document.getElementById('logoutBtn'),
    authView: document.getElementById('authView'),
    historyView: document.getElementById('historyView'),

    otpValueDisplay: document.getElementById('otpValueDisplay'),
    otpModeBadge: document.getElementById('otpModeBadge'),
    eyeToggleBtn: document.getElementById('eyeToggleBtn'),
    eyeSvg: document.getElementById('eyeSvg'),
    discreetNotice: document.getElementById('discreetNotice'),
    discreetNoticeText: document.getElementById('discreetNoticeText'),

    countdownPanel: document.getElementById('countdownPanel'),
    secondsLeftText: document.getElementById('secondsLeftText'),
    progressFill: document.getElementById('progressFill'),

    verifyForm: document.getElementById('verifyForm'),
    otpVerifyInput: document.getElementById('otpVerifyInput'),
    verifySubmitBtn: document.getElementById('verifySubmitBtn'),
    verifyResultAlert: document.getElementById('verifyResultAlert'),
    verifyResultIcon: document.getElementById('verifyResultIcon'),
    verifyResultText: document.getElementById('verifyResultText'),

    historyCount: document.getElementById('historyCount'),
    historyTableBody: document.getElementById('historyTableBody'),
    openClearHistoryModalBtn: document.getElementById('openClearHistoryModalBtn'),
    clearHistoryModal: document.getElementById('clearHistoryModal'),
    cancelClearBtn: document.getElementById('cancelClearBtn'),
    cancelClearActionBtn: document.getElementById('cancelClearActionBtn'),
    confirmClearActionBtn: document.getElementById('confirmClearActionBtn')
  };

  // ==========================================
  // 4. ICONS
  // ==========================================

  const ICON_EYE_OPEN = `
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
    <circle cx="12" cy="12" r="3"></circle>
  `;

  const ICON_EYE_CLOSED = `
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"></path>
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"></path>
    <line x1="1" y1="1" x2="23" y2="23"></line>
  `;

  // ==========================================
  // 5. SESSION MANAGEMENT
  // ==========================================

  async function checkSession() {
    try {
      const res = await apiRequest('/api/session');

      if (res.ok) {
        const data = await res.json();

        if (data.authenticated) {
          showAppScreen();
          return;
        }
      }
    } catch (error) {
      console.error('Session error:', error);
    }

    showLoginScreen();
  }

  function showLoginScreen() {
    state.isAuthenticated = false;

    el.loginScreen.style.display = 'flex';
    el.appScreen.style.display = 'none';

    el.loginKeyInput.value = '';
    el.loginErrorAlert.style.display = 'none';

    stopCountdown();
  }

  function showAppScreen() {
    state.isAuthenticated = true;

    el.loginScreen.style.display = 'none';
    el.appScreen.style.display = 'flex';

    switchTab('auth');
    fetchDemoOtp();
  }

  // ==========================================
  // 6. LOGIN
  // ==========================================

  async function handleLogin(event) {
    if (event) event.preventDefault();

    const key = el.loginKeyInput.value.trim();

    if (!key) {
      el.loginErrorText.textContent = 'Please enter your login key.';
      el.loginErrorAlert.style.display = 'flex';
      return;
    }

    el.loginSubmitBtn.disabled = true;
    el.loginErrorAlert.style.display = 'none';

    try {
      const res = await apiRequest('/api/login', {
        method: 'POST',
        body: JSON.stringify({ login_key: key })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        showAppScreen();
      } else {
        el.loginErrorText.textContent =
          data.error || 'Incorrect login key.';
        el.loginErrorAlert.style.display = 'flex';
      }

    } catch (error) {
      console.error('Login error:', error);

      el.loginErrorText.textContent =
        'Cannot connect to Render backend. Check server and CORS settings.';

      el.loginErrorAlert.style.display = 'flex';

    } finally {
      el.loginSubmitBtn.disabled = false;
    }
  }

  // ==========================================
  // 7. LOGOUT
  // ==========================================

  async function handleLogout() {
    try {
      await apiRequest('/api/logout', {
        method: 'POST'
      });
    } catch (error) {
      console.error('Logout error:', error);
    }

    state.realOtp = null;
    state.isRevealed = false;

    showLoginScreen();
  }

  // ==========================================
  // 8. NAVIGATION
  // ==========================================

  function switchTab(tab) {
    state.activeTab = tab;

    if (tab === 'auth') {
      el.tabAuthBtn.classList.add('active');
      el.tabHistoryBtn.classList.remove('active');

      el.tabAuthBtn.setAttribute('aria-selected', 'true');
      el.tabHistoryBtn.setAttribute('aria-selected', 'false');

      el.authView.style.display = 'block';
      el.historyView.style.display = 'none';

    } else {
      el.tabHistoryBtn.classList.add('active');
      el.tabAuthBtn.classList.remove('active');

      el.tabHistoryBtn.setAttribute('aria-selected', 'true');
      el.tabAuthBtn.setAttribute('aria-selected', 'false');

      el.authView.style.display = 'none';
      el.historyView.style.display = 'block';

      loadHistory();
    }
  }

  // ==========================================
  // 9. DEMO OTP
  // ==========================================

  async function fetchDemoOtp() {
    state.isRevealed = false;
    state.realOtp = null;

    stopCountdown();

    el.eyeSvg.innerHTML = ICON_EYE_OPEN;
    el.countdownPanel.style.display = 'none';
    el.discreetNotice.style.display = 'none';

    try {
      const res = await apiRequest('/api/demo-otp');

      if (!res.ok) throw new Error('Demo OTP request failed');

      const data = await res.json();

      el.otpValueDisplay.textContent = data.fake_otp;
      el.otpModeBadge.textContent = 'DEMO OTP — NOT VALID';
      el.otpModeBadge.className = 'badge badge-warning';

    } catch (error) {
      console.error('Demo OTP error:', error);
      el.otpValueDisplay.textContent = '------';
      el.otpModeBadge.textContent = 'SERVER UNAVAILABLE';
    }
  }

  // ==========================================
  // 10. REAL OTP REVEAL
  // ==========================================

  async function toggleEyeReveal() {

    if (state.isRevealed) {
      state.isRevealed = false;

      stopCountdown();

      el.otpValueDisplay.textContent = '••••••';
      el.eyeSvg.innerHTML = ICON_EYE_OPEN;
      el.otpModeBadge.textContent = 'HIDDEN';
      el.otpModeBadge.className = 'badge badge-info';
      el.countdownPanel.style.display = 'none';

      return;
    }

    state.isRevealed = true;

    el.eyeSvg.innerHTML = ICON_EYE_CLOSED;
    el.otpValueDisplay.textContent = '......';
    el.eyeToggleBtn.style.opacity = '0.7';

    try {
      const res = await apiRequest('/api/real-otp');

      if (!res.ok) {
        throw new Error('OTP request failed: ' + res.status);
      }

      const data = await res.json();

      if (!/^\d{6}$/.test(String(data.otp))) {
        throw new Error('Invalid OTP response from backend');
      }

      state.realOtp = String(data.otp);
      state.timeRemaining = Number(data.time_remaining) || 30;

      el.otpValueDisplay.textContent = state.realOtp;

      if (data.online === true && data.mode === 'hardware') {
        el.discreetNotice.style.display = 'none';

        el.otpModeBadge.textContent = 'ESP32 HARDWARE OTP';
        el.otpModeBadge.className = 'badge badge-success';

      } else {
        el.discreetNoticeText.textContent =
          data.message || 'Device unavailable';

        el.discreetNotice.style.display = 'block';

        el.otpModeBadge.textContent = 'REAL OTP (DEMO MODE)';
        el.otpModeBadge.className = 'badge badge-success';
      }

      startCountdown();

    } catch (error) {
      console.error('Real OTP error:', error);

      state.realOtp = null;

      el.otpValueDisplay.textContent = '------';
      el.discreetNoticeText.textContent =
        'Unable to retrieve OTP from backend.';

      el.discreetNotice.style.display = 'block';
      el.otpModeBadge.textContent = 'OTP UNAVAILABLE';
      el.otpModeBadge.className = 'badge badge-warning';

      state.isRevealed = false;
      el.eyeSvg.innerHTML = ICON_EYE_OPEN;

    } finally {
      el.eyeToggleBtn.style.opacity = '1';
    }
  }

  // ==========================================
  // 11. OTP COUNTDOWN
  // ==========================================

  function startCountdown() {
    stopCountdown();

    el.countdownPanel.style.display = 'block';

    updateProgressUI();

    state.countdownInterval = setInterval(() => {

      if (!state.isRevealed) {
        stopCountdown();
        return;
      }

      state.timeRemaining--;

      if (state.timeRemaining <= 0) {
        fetchRealOtpSilently();
      } else {
        updateProgressUI();
      }

    }, 1000);
  }

  function stopCountdown() {
    if (state.countdownInterval) {
      clearInterval(state.countdownInterval);
      state.countdownInterval = null;
    }
  }

  function updateProgressUI() {
    el.secondsLeftText.textContent = state.timeRemaining;

    const percentage =
      Math.max(0, Math.min(100, (state.timeRemaining / 30) * 100));

    el.progressFill.style.width = `${percentage}%`;
  }

  async function fetchRealOtpSilently() {
    try {
      const res = await apiRequest('/api/real-otp');

      if (!res.ok) {
        throw new Error('OTP refresh failed');
      }

      const data = await res.json();

      if (!/^\d{6}$/.test(String(data.otp))) {
        throw new Error('Invalid OTP response');
      }

      state.realOtp = String(data.otp);
      state.timeRemaining = Number(data.time_remaining) || 30;

      el.otpValueDisplay.textContent = state.realOtp;

      updateProgressUI();

    } catch (error) {
      console.error('OTP refresh error:', error);
      stopCountdown();

      el.otpValueDisplay.textContent = '------';
      el.discreetNoticeText.textContent = 'OTP refresh failed.';
      el.discreetNotice.style.display = 'block';
    }
  }

  // ==========================================
  // 12. OTP VERIFICATION
  // ==========================================

  async function handleVerify(event) {
    if (event) event.preventDefault();

    const candidate = el.otpVerifyInput.value.trim();

    if (!/^\d{6}$/.test(candidate)) {
      showVerifyResult(false, 'Enter a valid 6-digit OTP.');
      return;
    }

    el.verifySubmitBtn.disabled = true;
    el.verifySubmitBtn.textContent = 'Verifying...';

    try {
      const res = await apiRequest('/api/verify', {
        method: 'POST',
        body: JSON.stringify({ otp: candidate })
      });

      const data = await res.json();

      if (res.ok && data.valid) {
        showVerifyResult(true, 'Authentication Successful');
        el.otpVerifyInput.value = '';
      } else {
        showVerifyResult(false, data.message || 'Invalid OTP');
      }

    } catch (error) {
      console.error('Verification error:', error);

      showVerifyResult(
        false,
        'Backend connection failed. Please try again.'
      );

    } finally {
      el.verifySubmitBtn.disabled = false;
      el.verifySubmitBtn.textContent = 'Verify OTP';
    }
  }

  function showVerifyResult(isSuccess, message) {
    el.verifyResultAlert.style.display = 'flex';

    if (isSuccess) {
      el.verifyResultAlert.className =
        'alert-banner alert-success';

      el.verifyResultIcon.textContent = '✓';

    } else {
      el.verifyResultAlert.className =
        'alert-banner alert-danger';

      el.verifyResultIcon.textContent = '✕';
    }

    el.verifyResultText.textContent = message;
  }

  // ==========================================
  // 13. OTP HISTORY
  // ==========================================

  async function loadHistory() {
    try {
      const res = await apiRequest('/api/history');

      if (!res.ok) throw new Error('History request failed');

      const data = await res.json();

      renderHistoryTable(data.history || []);

    } catch (error) {
      console.error('History error:', error);

      el.historyTableBody.innerHTML = `
        <tr>
          <td colspan="5">Unable to load history. Check backend connection.</td>
        </tr>
      `;
    }
  }

  function renderHistoryTable(records) {
    el.historyCount.textContent = records.length;

    if (!records.length) {
      el.historyTableBody.innerHTML = `
        <tr class="empty-row">
          <td colspan="5">No authentication attempts recorded yet.</td>
        </tr>
      `;
      return;
    }

    el.historyTableBody.innerHTML = '';

    records.forEach((item, index) => {
      const row = document.createElement('tr');

      const values = [
        index + 1,
        item.date,
        item.time,
        item.result,
        item.status
      ];

      values.forEach((value, i) => {
        const cell = document.createElement('td');

        if (i === 4) {
          const badge = document.createElement('span');
          const success = item.status === 'Success';

          badge.className = success
            ? 'badge badge-success'
            : 'badge badge-danger';

          badge.textContent = success ? 'Success' : 'Failed';
          cell.appendChild(badge);

        } else {
          cell.textContent = String(value ?? '');
        }

        row.appendChild(cell);
      });

      el.historyTableBody.appendChild(row);
    });
  }

  // ==========================================
  // 14. CLEAR HISTORY
  // ==========================================

  function openClearModal() {
    el.clearHistoryModal.style.display = 'flex';
  }

  function closeClearModal() {
    el.clearHistoryModal.style.display = 'none';
  }

  async function clearHistory() {
    try {
      const res = await apiRequest('/api/clear-history', {
        method: 'POST'
      });

      if (!res.ok) throw new Error('Clear history failed');

      closeClearModal();
      loadHistory();

    } catch (error) {
      alert('Unable to clear history: ' + error.message);
    }
  }

  // ==========================================
  // 15. EVENT LISTENERS
  // ==========================================

  function initListeners() {

    // Login: form submit handles both Enter and button click.
    el.loginForm.addEventListener('submit', handleLogin);

    el.toggleLoginKeyVis.addEventListener('click', () => {
      el.loginKeyInput.type =
        el.loginKeyInput.type === 'password' ? 'text' : 'password';
    });

    // Logout
    el.logoutBtn.addEventListener('click', handleLogout);

    // Navigation
    el.tabAuthBtn.addEventListener('click', () => switchTab('auth'));
    el.tabHistoryBtn.addEventListener('click', () => switchTab('history'));

    // OTP reveal
    el.eyeToggleBtn.addEventListener('click', toggleEyeReveal);

    // OTP autofill
    el.otpValueDisplay.addEventListener('click', () => {
      const code = el.otpValueDisplay.textContent.trim();

      if (/^\d{6}$/.test(code)) {
        el.otpVerifyInput.value = code;
        el.otpVerifyInput.focus();
      }
    });

    // Verification: form submit handles button and Enter.
    el.verifyForm.addEventListener('submit', handleVerify);

    // History
    el.openClearHistoryModalBtn.addEventListener('click', openClearModal);

    el.cancelClearBtn.addEventListener('click', closeClearModal);
    el.cancelClearActionBtn.addEventListener('click', closeClearModal);
    el.confirmClearActionBtn.addEventListener('click', clearHistory);

    // Modal backdrop
    el.clearHistoryModal.addEventListener('click', (event) => {
      if (event.target === el.clearHistoryModal) {
        closeClearModal();
      }
    });
  }

  // ==========================================
  // 16. INITIALIZATION
  // ==========================================

  function init() {
    initListeners();
    checkSession();

    console.log('SecureOTP frontend initialized');
    console.log('Backend:', API_BASE);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
