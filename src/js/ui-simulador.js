import { calcJ, fmMin, toMin, to12, JORNADA_MIN, FIXED_BREAK, getPeriod, todayStr, enrichReg, withSaldo } from './jornada.js';
import { getRegistros, getCfg } from './storage.js';

let simDayOffset = 0;

function getSaldoPeriodo() {
  const p = getPeriod(todayStr());
  const data = getRegistros()
    .filter(r => r.fecha >= p.start && r.fecha <= p.end)
    .map(enrichReg);
  return withSaldo(data).reduce((_, r) => r.saldoAc, 0);
}

function fmt(m) {
  return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
}

export function calcSim() {
  const e = document.getElementById('simE')?.value;
  const s = document.getElementById('simS')?.value;
  if (!e || !s) return;
  const r = calcJ(e, s); if (!r) return;
  const c = getCfg();

  const simDate = new Date();
  simDate.setDate(simDate.getDate() + (simDayOffset || 0));
  const simDateStr = simDate.toISOString().slice(0, 10);

  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('sr1', fmMin(r.ef));

  const d2 = document.getElementById('sr2');
  if (d2) { d2.textContent = (r.delta >= 0 ? '+' : '') + fmMin(r.delta); d2.className = 'sv ' + (r.delta > 0 ? 'pos' : r.delta < 0 ? 'neg' : ''); }

  const em = toMin(e);
  const s8  = (em + JORNADA_MIN + FIXED_BREAK) % 1440;
  const s10 = (em + JORNADA_MIN + c.maxExtra * 60 + FIXED_BREAK) % 1440;
  set('sr3', fmt(s8)  + ' / ' + to12(fmt(s8)));
  set('sr4', fmt(s10) + ' / ' + to12(fmt(s10)));

  const nSal = getSaldoPeriodo() + r.delta;
  const s5 = document.getElementById('sr5');
  if (s5) { s5.textContent = (nSal >= 0 ? '+' : '') + fmMin(nSal); s5.className = 'sv ' + (nSal >= 0 ? 'pos' : 'neg'); }

  const prevR = getRegistros()
    .filter(x => x.fecha < simDateStr && x.salida)
    .sort((a, b) => a.fecha > b.fecha ? 1 : -1)
    .slice(-1)[0];
  const s6 = document.getElementById('sr6');
  if (s6) {
    if (prevR?.salida) {
      const refTime = simDayOffset === 0 ? new Date() : new Date(simDateStr + 'T' + e);
      const dh = (refTime - new Date(prevR.fecha + 'T' + prevR.salida)) / 3600000;
      s6.textContent = dh < c.interJornada ? '!! ' + dh.toFixed(1) + 'h (min ' + c.interJornada + 'h)' : 'OK ' + dh.toFixed(1) + 'h';
      s6.className = 'sv ' + (dh < c.interJornada ? 'neg' : 'pos');
    } else { s6.textContent = '--'; s6.className = 'sv'; }
  }
}

export function calcOut() {
  const e    = document.getElementById('cE')?.value;
  const meta = parseFloat(document.getElementById('cMeta')?.value) || 8;
  if (!e) return;
  const em   = toMin(e);
  const sm   = (em + Math.round(meta * 60) + FIXED_BREAK) % 1440;
  const st   = fmt(sm);
  const set  = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('cOut',   st);
  set('cOut12', to12(st));
}

export function simSetDay(offset) {
  simDayOffset = offset;
  const simDate = new Date();
  simDate.setDate(simDate.getDate() + offset);
  const label = offset === 0 ? 'Hoy' : offset === 1 ? 'Mañana' : simDate.toLocaleDateString('es', { weekday: 'long' });
  document.querySelectorAll('.sim-day-btn').forEach((btn, i) => {
    btn.classList.toggle('active', i === offset);
  });
  const el = document.getElementById('simDayLabel');
  if (el) el.textContent = label;
  calcSim();
}

export function initSimulador() {
  document.getElementById('simE')?.addEventListener('input', calcSim);
  document.getElementById('simS')?.addEventListener('input', calcSim);
  document.getElementById('cE')?.addEventListener('input', calcOut);
  document.getElementById('cMeta')?.addEventListener('input', calcOut);
}

window.calcSim   = calcSim;
window.calcOut   = calcOut;
window.simSetDay = simSetDay;