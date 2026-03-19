/**
 * app.js — Entry point principal
 * Conecta todos los módulos y arranca la app.
 */
import { todayStr, fmDate, getPeriod, enrichReg, withSaldo } from './jornada.js';
import { initStorage, setCurrentUser, loadRegistros, getCfg, saveCfg,
         getTheme, getFontSizeIdx, getSabadoTipo, saveSabadoTipo,
         isWizardDone, markWizardDone } from './storage.js';
import { initAuth, onLogin, onLogout, login, register, logout,
         changePassword, getAuthErrorMsg } from './auth.js';
import { renderDash }       from './ui-dashboard.js';
import { renderHist, populateFiltro } from './ui-historial.js';
import { renderRes }        from './ui-resumen.js';
import { renderSalario, fillSalarioCfg, updateSalCfgResumen } from './ui-salario.js';
import { renderIA }         from './ui-ia.js';
import { initSimulador, simSetDay } from './ui-simulador.js';
import { setTheme, applyFontSize, fillAdminPanel, fillTurnoCfg } from './ui-cuenta.js';

// ── FIREBASE CONFIG ──
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyBSraBbA1rofAFHHxJGUoVyJUHvtLyoc0I",
  authDomain:        "controlepontobrf.firebaseapp.com",
  projectId:         "controlepontobrf",
  storageBucket:     "controlepontobrf.appspot.com",
  messagingSenderId: "571982992219",
  appId:             "1:571982992219:web:abc123"
};

// ── ESTADO GLOBAL ──
let _currentUser = null;
let _db   = null;
let _auth = null;

// ── RENDER ALL ──
function renderAll() {
  renderDash();
  renderHist();
  populateFiltro();
  renderRes();
}
window._renderAll = renderAll;

// ── NAV ──
window.nav = function(id) {
  document.querySelectorAll('.panel').forEach(p => p.style.display = 'none');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const panel = document.getElementById('panel-' + id);
  if (panel) panel.style.display = '';
  const navBtn = document.querySelector('[data-nav="' + id + '"]');
  if (navBtn) navBtn.classList.add('active');
  if (id === 'salario')   { renderSalario(); }
  if (id === 'ia')        { renderIA(); }
  if (id === 'historial') { populateFiltro(); renderHist(); }
  if (id === 'resumen')   { renderRes(); }
  if (id === 'admin')     { fillAdminPanel(_currentUser); fillTurnoCfg(); fillSalarioCfg(); updateSalCfgResumen(); }
  if (id === 'dashboard') { renderDash(); }
};
window._nav = window.nav;

// ── LOGIN / LOGOUT ──
function showLoginOverlay() {
  const ov = document.getElementById('loginOverlay');
  if (ov) ov.style.display = 'flex';
}
function hideLoginOverlay() {
  const ov = document.getElementById('loginOverlay');
  if (ov) ov.style.display = 'none';
}

window.loginSubmit = async function(isRegister) {
  const email = document.getElementById('loginEmail')?.value.trim();
  const pass  = document.getElementById('loginPass')?.value;
  const err   = document.getElementById('loginErr');
  if (!email || !pass) { if (err) err.textContent = 'Completá email y contraseña.'; return; }
  setLoginLoading(true);
  try {
    if (isRegister) await register(email, pass);
    else            await login(email, pass);
  } catch(e) {
    if (err) err.textContent = getAuthErrorMsg(e.code);
    setLoginLoading(false);
  }
};

function setLoginLoading(on) {
  const btn = document.getElementById('btnLogin');
  if (btn) { btn.disabled = on; btn.textContent = on ? '⟳ Entrando...' : 'Entrar'; }
}

window.logoutConfirm = async function() {
  document.getElementById('logoutModal').style.display = 'none';
  await logout();
};
window.logoutCancel = function() {
  document.getElementById('logoutModal').style.display = 'none';
};

window.cambiarPassword = function() {
  const p1  = document.getElementById('newPwd')?.value;
  const p2  = document.getElementById('newPwd2')?.value;
  const msg = document.getElementById('pwdMsg');
  const show = (txt, ok) => {
    if (!msg) return;
    msg.textContent = txt; msg.style.display = '';
    msg.style.background = ok ? 'rgba(0,230,118,.1)' : 'rgba(255,68,68,.1)';
    msg.style.color = ok ? 'var(--green)' : 'var(--red)';
  };
  if (!p1 || p1.length < 6) { show('Mínimo 6 caracteres.', false); return; }
  if (p1 !== p2) { show('Las contraseñas no coinciden.', false); return; }
  _currentUser?.updatePassword(p1)
    .then(() => { show('✓ Contraseña actualizada.', true); })
    .catch(e => show(e.message, false));
};

// ── SÁBADO TIPO ──
window.setSabadoTipo = function(tipo) {
  saveSabadoTipo(tipo);
  document.querySelectorAll('.sab-btn').forEach(b => b.classList.toggle('active', b.dataset.tipo === tipo));
  renderDash();
};

// ── SYNC BADGE ──
function setSyncBadge(estado) {
  const el = document.getElementById('syncBadge');
  if (!el) return;
  const estados = { sync: ['⟳ Sincronizando', 'var(--tx3)'], ok: ['● Sincronizado', 'var(--green)'], error: ['⚠ Sin conexión', 'var(--red)'] };
  const [txt, col] = estados[estado] || estados.ok;
  el.textContent = txt; el.style.color = col;
}

// ── TEMAS Y FUENTES ──
function applyStoredTheme() {
  setTheme(getTheme());
  applyFontSize(getFontSizeIdx());
}

// ── INIT ──
window.addEventListener('load', function() {
  // Mostrar loading
  const loading = document.getElementById('loadingOverlay');
  if (loading) loading.style.display = 'flex';

  // Aplicar tema guardado
  applyStoredTheme();

  // Init simulador
  initSimulador();
  window.simSetDay = simSetDay;

  // Firebase init
  let firebaseOK = false;
  try {
    if (typeof firebase !== 'undefined') {
      if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
      _db   = firebase.firestore();
      _auth = firebase.auth();
      _db.enablePersistence().catch(() => {});
      firebaseOK = true;
    }
  } catch(e) { console.warn('Firebase no disponible:', e); }

  initStorage(_db, firebaseOK);

  // Auth callbacks
  onLogin(async user => {
    _currentUser = user;
    setCurrentUser(user);
    await loadRegistros(user.uid);
    hideLoginOverlay();
    if (loading) loading.style.display = 'none';
    setSyncBadge('ok');

    // Actualizar UI usuario
    const btn = document.getElementById('userBtn');
    if (btn) btn.textContent = '👤 ' + (user.email?.split('@')[0] || '--');

    // Período
    const p = getPeriod(todayStr());
    const pEl = document.getElementById('periodoLabel');
    if (pEl) pEl.textContent = 'Período ' + fmDate(p.start) + ' → ' + fmDate(p.end);

    renderAll();
    simSetDay(0);

    // Sábado tipo
    const sabTipo = getSabadoTipo();
    document.querySelectorAll('.sab-btn').forEach(b => b.classList.toggle('active', b.dataset.tipo === sabTipo));

    // Wizard si es primera vez
    if (!isWizardDone(user.uid)) {
      showWizard(user.uid);
    }
  });

  onLogout(() => {
    _currentUser = null;
    if (loading) loading.style.display = 'none';
    showLoginOverlay();
  });

  // Iniciar listener de auth
  if (firebaseOK && _auth) {
    initAuth(_auth);
    const { startAuthListener } = await import('./auth.js');
    startAuthListener(() => { if (loading) loading.style.display = 'none'; });
  } else {
    if (loading) loading.style.display = 'none';
    showLoginOverlay();
  }

  // Clock
  setInterval(() => {
    const el = document.getElementById('clock');
    if (el) el.textContent = new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }, 1000);
});

// ── WIZARD ──
function showWizard(uid) {
  const wiz = document.getElementById('wizardOverlay');
  if (!wiz) return;
  wiz.style.display = 'flex';
  window.wizardDone = function() {
    wiz.style.display = 'none';
    markWizardDone(uid);
  };
}