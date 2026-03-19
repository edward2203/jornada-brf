import { fmMin, fmDate, todayStr, getPeriod, enrichReg, withSaldo } from './jornada.js';
import { getRegistros, getCfg, saveCfg, getTheme, saveTheme, getFontSizeIdx, saveFontSizeIdx } from './storage.js';

const FONT_SIZES = ['85%', '92%', '100%', '115%', '130%'];
const FONT_LABELS = ['Pequeño', 'Compacto', 'Normal', 'Grande', 'Extra'];

export function fillAdminPanel(currentUser) {
  if (!currentUser) return;
  const email = currentUser.email || '--';
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('adminAvatar', email[0].toUpperCase());
  set('adminEmail', email);
  set('adminUid', 'UID: ' + (currentUser.uid || '--'));

  const p      = getPeriod(todayStr());
  const data   = withSaldo(getRegistros().map(enrichReg));
  const periodo = data.filter(r => r.fecha >= p.start && r.fecha <= p.end);
  const sal    = periodo.length ? periodo[periodo.length - 1].saldoAc : 0;
  set('adminDias', periodo.length);
  set('adminPeriodo', fmDate(p.start).slice(0, 5) + '-' + fmDate(p.end).slice(0, 5));
  const salEl = document.getElementById('adminSaldo');
  if (salEl) { salEl.textContent = (sal >= 0 ? '+' : '') + fmMin(sal); salEl.style.color = sal >= 0 ? 'var(--green)' : 'var(--red)'; }
}

export function fillTurnoCfg() {
  const c = getCfg();
  const sv = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
  const fmT = (h, m) => String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0');
  sv('cfgEntrada', fmT(c.entradaHora, c.entradaMin));
  sv('cfgSalida',  fmT(c.salidaHora,  c.salidaMin));
  sv('cfgSabSalida', fmT(c.sabSalidaHora, c.sabSalidaMin));
  sv('cfgBusVuelta', fmT(c.busVueltaHora, c.busVueltaMin));
  const taxi = document.getElementById('cfgUsaTaxi'); if (taxi) taxi.checked = !!c.usaTaxi;
  const bus  = document.getElementById('cfgUsaBus');  if (bus)  bus.checked  = !!c.usaBus;
}

export function setTheme(t) {
  saveTheme(t);
  document.body.className = document.body.className
    .replace(/theme-\w+/g, '').trim();
  if (t !== 'dark') document.body.classList.add('theme-' + t);
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === t);
  });
}

export function changeFontSize(dir) {
  let idx = getFontSizeIdx() + dir;
  idx = Math.max(0, Math.min(FONT_SIZES.length - 1, idx));
  applyFontSize(idx);
}

export function applyFontSize(idx) {
  saveFontSizeIdx(idx);
  document.documentElement.style.fontSize = FONT_SIZES[idx];
  const bar   = document.getElementById('fontSizeBar');
  const thumb = document.getElementById('fontSizeThumb');
  const label = document.getElementById('fontSizeLabel');
  const pct   = (idx / (FONT_SIZES.length - 1)) * 100;
  if (bar)   bar.style.width = pct + '%';
  if (thumb) thumb.style.left = pct + '%';
  if (label) label.textContent = FONT_LABELS[idx];
  const p1 = document.getElementById('fontPreview');
  const p2 = document.getElementById('fontPreview2');
  if (p1) p1.style.fontSize = FONT_SIZES[idx];
  if (p2) p2.style.fontSize = FONT_SIZES[idx];
}

window.saveTurnoCfg = function() {
  const gv  = id => { const el = document.getElementById(id); return el ? el.value : ''; };
  const toH = t => { if (!t) return [0,0]; const [h,m] = t.split(':'); return [parseInt(h), parseInt(m)]; };
  const [eh, em2] = toH(gv('cfgEntrada'));
  const [sh, sm]  = toH(gv('cfgSalida'));
  const [sbh, sbm] = toH(gv('cfgSabSalida'));
  const [bvh, bvm] = toH(gv('cfgBusVuelta'));
  saveCfg({
    entradaHora: eh, entradaMin: em2, salidaHora: sh, salidaMin: sm,
    sabSalidaHora: sbh, sabSalidaMin: sbm, busVueltaHora: bvh, busVueltaMin: bvm,
    usaTaxi: document.getElementById('cfgUsaTaxi')?.checked || false,
    usaBus:  document.getElementById('cfgUsaBus')?.checked  || false,
  });
  const msg = document.getElementById('cfgTurnoMsg');
  if (msg) { msg.textContent = '✓ Turno guardado'; msg.style.color = 'var(--green)'; msg.style.display = ''; setTimeout(() => msg.style.display = 'none', 2500); }
};

window.cambiarPassword = function(currentUser) {
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
  if (!currentUser) { show('Sin sesión activa.', false); return; }
  currentUser.updatePassword(p1)
    .then(() => { show('✓ Contraseña actualizada.', true); document.getElementById('newPwd').value = ''; document.getElementById('newPwd2').value = ''; })
    .catch(e => show(e.message, false));
};

window.changeFontSize = changeFontSize;
window.setTheme       = setTheme;
window.fillTurnoCfg   = fillTurnoCfg;
window.fillAdminPanel = fillAdminPanel;