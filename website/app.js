
/**
 * SecureOTP — ESP32 Time-Based OTP Authentication System
 * Frontend Application Controller
 * Connected to Render Flask Backend
 */

(function () {
  'use strict';

  // RENDER BACKEND CONNECTION
  const API_BASE = "https://tpto-otp-dector.onrender.com";

  async function api(path, options = {}) {
    return fetch(`${API_BASE}${path}`, {
      ...options,
      credentials: "include"
    });
  }

  // State Management
  const state = {
    isAuthenticated: false,
    isRevealed: false,
    realOtp: null,
    fakeOtp: null,
    timeRemaining: 30,
    countdownInterval: null,
    activeTab: 'auth'
  };

  // DOM Elements Cache
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

  const ICON_EYE_OPEN = `
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
    <circle cx="12" cy="12" r="3"></circle>
  `;

  const ICON_EYE_CLOSED = `
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
    <line x1="1" y1="1" x2="23" y2="23"></line>
  `;

  // 1. Session & Login Flow

  async function checkSession() {
    try {
      const res = await api('/api/session');

      if (res.ok) {
        const data = await res.json();

        if (data.authenticated) {
          showAppScreen();
          return;
        }
      }
    } catch (err) {
      console.error('Session error:', err);
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

  async function handleLogin() {
    const key = el.loginKeyInput.value.trim();
    if (!key) return;

    el.loginSubmitBtn.disabled = true;
    el.loginErrorAlert.style.display = 'none';

    try {
      const res = await api('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login_key: key })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        showAppScreen();
      } else {
        el.loginErrorText.textContent =
          data.error || 'Incorrect login key. Please try again.';

        el.loginErrorAlert.style.display = 'flex';
        el.loginKeyInput.focus();
      }

    } catch (err) {
      console.error(err);
      el.loginErrorText.textContent =
        'Server connection error. Please verify backend is running.';

      el.loginErrorAlert.style.display = 'flex';

    } finally {
      el.loginSubmitBtn.disabled = false;
    }
  }

  async function handleLogout() {
    try {
      await api('/api/logout', { method: 'POST' });
    } catch (err) {
      console.error(err);
    }

    showLoginScreen();
  }

  // 2. Navigation Tabs

  function switchTab(tab) {
    state.activeTab = tab;

    if (tab === 'auth') {
      el.tabAuthBtn.classList.add('active');
      el.tabAuthBtn.setAttribute('aria-selected', 'true');

      el.tabHistoryBtn.classList.remove('active');
      el.tabHistoryBtn.setAttribute('aria-selected', 'false');

      el.authView.style.display = 'block';
      el.historyView.style.display = 'none';

    } else {
      el.tabHistoryBtn.classList.add('active');
      el.tabHistoryBtn.setAttribute('aria-selected', 'true');

      el.tabAuthBtn.classList.remove('active');
      el.tabAuthBtn.setAttribute('aria-selected', 'false');

      el.authView.style.display = 'none';
      el.historyView.style.display = 'block';

      loadHistory();
    }
  }

  // 3. Demo OTP

  async function fetchDemoOtp() {
    state.isRevealed = false;
    state.realOtp = null;

    stopCountdown();

    el.eyeSvg.innerHTML = ICON_EYE_OPEN;
    el.countdownPanel.style.display = 'none';
    el.discreetNotice.style.display = 'none';

    try {
      const res = await api('/api/demo-otp');

      if (res.ok) {
        const data = await res.json();

        state.fakeOtp = data.fake_otp;
        el.otpValueDisplay.textContent = data.fake_otp;

        el.otpModeBadge.textContent = 'DEMO OTP — NOT VALID';
        el.otpModeBadge.className = 'badge badge-warning';
      }

    } catch (err) {
      console.error(err);

      el.otpValueDisplay.textContent = '849201';
      el.otpModeBadge.textContent = 'DEMO OTP — NOT VALID';
      el.otpModeBadge.className = 'badge badge-warning';
    }
  }

  // 4. Real OTP Reveal

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

    if (state.realOtp) {
      el.otpValueDisplay.textContent = state.realOtp;
      startCountdown();
    } else {
      el.otpValueDisplay.textContent = '......';
    }

    try {
      el.eyeToggleBtn.style.opacity = '0.7';

      const res = await api('/api/real-otp');

      if (res.ok) {
        const data = await res.json();

        state.realOtp = data.otp;
        state.timeRemaining = data.time_remaining || 30;

        el.otpValueDisplay.textContent = data.otp;

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

      } else {
        if (!state.realOtp) {
          state.realOtp = generateClientTotp();
        }

        el.otpValueDisplay.textContent = state.realOtp;

        el.discreetNoticeText.textContent = 'Device unavailable';
        el.discreetNotice.style.display = 'block';

        el.otpModeBadge.textContent = 'REAL OTP (DEMO MODE)';
        el.otpModeBadge.className = 'badge badge-success';

        startCountdown();
      }

    } catch (err) {
      console.error(err);

      if (!state.realOtp) {
        state.realOtp = generateClientTotp();
      }

      el.otpValueDisplay.textContent = state.realOtp;

      el.discreetNoticeText.textContent = 'Device unavailable';
      el.discreetNotice.style.display = 'block';

      el.otpModeBadge.textContent = 'REAL OTP (DEMO MODE)';
      el.otpModeBadge.className = 'badge badge-success';

      startCountdown();

    } finally {
      el.eyeToggleBtn.style.opacity = '1';
    }
  }

  // Client-side fallback

  function generateClientTotp() {
    const epoch = Math.floor(Date.now() / 1000);
    const counter = Math.floor(epoch / 30);

    let hash = 0;
    const str = 'JBSWY3DPEHPK3PXP' + counter;

    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }

    const code = Math.abs(hash) % 1000000;

    return String(code).padStart(6, '0');
  }

  // 5. OTP Countdown

  function startCountdown() {
    stopCountdown();

    el.countdownPanel.style.display = 'block';

    updateProgressUI();

    state.countdownInterval = setInterval(() => {

      state.timeRemaining--;

      if (state.timeRemaining <= 0) {

        if (state.isRevealed) {
          fetchRealOtpSilently();
        } else {
          stopCountdown();
        }

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

    const pct = Math.max(
      0,
      Math.min(100, (state.timeRemaining / 30) * 100)
    );

    el.progressFill.style.width = `${pct}%`;
  }

  async function fetchRealOtpSilently() {
    try {
      const res = await api('/api/real-otp');

      if (res.ok) {
        const data = await res.json();

        state.realOtp = data.otp;
        state.timeRemaining = data.time_remaining || 30;

        el.otpValueDisplay.textContent = data.otp;

        updateProgressUI();

      } else {
        stopCountdown();

        el.discreetNoticeText.textContent = 'Device unavailable';
        el.discreetNotice.style.display = 'block';
      }

    } catch (err) {
      console.error(err);
      stopCountdown();
    }
  }

  // 6. OTP Verification

  async function handleVerify() {
    const candidate = el.otpVerifyInput.value.trim();

    if (!candidate || candidate.length !== 6) {
      showVerifyResult(false, 'Please enter a valid 6-digit OTP code.');
      return;
    }

    el.verifySubmitBtn.disabled = true;
    el.verifySubmitBtn.textContent = 'Verifying...';

    try {
      const res = await api('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp: candidate })
      });

      const data = await res.json();

      if (res.ok && data.valid) {
        showVerifyResult(true, 'Authentication Successful');
        el.otpVerifyInput.value = '';
      } else {
        showVerifyResult(false, data.message || 'Invalid OTP');
      }

    } catch (err) {
      console.error(err);

      showVerifyResult(
        false,
        'Verification request failed. Server connection error.'
      );

    } finally {
      el.verifySubmitBtn.disabled = false;

      el.verifySubmitBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
        Verify OTP
      `;
    }
  }

  function showVerifyResult(isSuccess, message) {
    el.verifyResultAlert.style.display = 'flex';

    if (isSuccess) {
      el.verifyResultAlert.className = 'alert-banner alert-success';

      el.verifyResultIcon.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
          <polyline points="22 4 12 14.01 9 11.01"></polyline>
        </svg>
      `;

    } else {
      el.verifyResultAlert.className = 'alert-banner alert-danger';

      el.verifyResultIcon.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="15" y1="9" x2="9" y2="15"></line>
          <line x1="9" y1="9" x2="15" y2="15"></line>
        </svg>
      `;
    }

    el.verifyResultText.textContent = message;
  }

  // 7. OTP History

  async function loadHistory() {
    try {
      const res = await api('/api/history');

      if (res.ok) {
        const data = await res.json();

        renderHistoryTable(data.history || []);
      }

    } catch (err) {
      console.error('Failed to load history:', err);
    }
  }

  function renderHistoryTable(records) {
    el.historyCount.textContent = records.length;

    if (!records || records.length === 0) {
      el.historyTableBody.innerHTML = `
        <tr class="empty-row">
          <td colspan="5">
            No authentication attempts recorded yet.
          </td>
        </tr>
      `;

      return;
    }

    let html = '';

    records.forEach((item, index) => {
      const isSuccess = item.status === 'Success';

      const statusBadge = isSuccess
        ? '<span class="badge badge-success">Success</span>'
        : '<span class="badge badge-danger">Failed</span>';

      html += `
        <tr>
          <td>${index + 1}</td>
          <td>${item.date}</td>
          <td><code>${item.time}</code></td>
          <td>${item.result}</td>
          <td>${statusBadge}</td>
        </tr>
      `;
    });

    el.historyTableBody.innerHTML = html;
  }

  async function clearHistory() {
    try {
      const res = await api('/api/clear-history', {
        method: 'POST'
      });

      if (res.ok) {
        closeClearModal();
        loadHistory();
      }

    } catch (err) {
      alert('Failed to clear history: ' + err.message);
    }
  }

  function openClearModal() {
    el.clearHistoryModal.style.display = 'flex';
  }

  function closeClearModal() {
    el.clearHistoryModal.style.display = 'none';
  }

  // 8. Event Listeners

  function initListeners() {

    el.loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      handleLogin();
    });

    el.loginSubmitBtn.addEventListener('click', (e) => {
      e.preventDefault();
      handleLogin();
    });

    el.toggleLoginKeyVis.addEventListener('click', () => {
      const isPass = el.loginKeyInput.type === 'password';

      el.loginKeyInput.type = isPass ? 'text' : 'password';
    });

    el.logoutBtn.addEventListener('click', handleLogout);

    el.tabAuthBtn.addEventListener('click', () => switchTab('auth'));

    el.tabHistoryBtn.addEventListener('click', () => switchTab('history'));

    el.eyeToggleBtn.addEventListener('click', toggleEyeReveal);

    el.otpValueDisplay.addEventListener('click', () => {
      const text = el.otpValueDisplay.textContent.trim();

      if (/^\d{6}$/.test(text)) {
        el.otpVerifyInput.value = text;
        el.otpVerifyInput.focus();
      }
    });

    el.verifyForm.addEventListener('submit', (e) => {
      e.preventDefault();
      handleVerify();
    });

    el.verifySubmitBtn.addEventListener('click', (e) => {
      e.preventDefault();
      handleVerify();
    });

    el.openClearHistoryModalBtn.addEventListener(
      'click',
      openClearModal
    );

    el.cancelClearBtn.addEventListener('click', closeClearModal);

    el.cancelClearActionBtn.addEventListener('click', closeClearModal);

    el.confirmClearActionBtn.addEventListener('click', clearHistory);

    el.clearHistoryModal.addEventListener('click', (e) => {
      if (e.target === el.clearHistoryModal) {
        closeClearModal();
      }
    });
  }

  // 9. Initialization

  function init() {
    initListeners();
    checkSession();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
