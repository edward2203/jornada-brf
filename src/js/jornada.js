/**
 * jornada.js — Lógica de negocio BRF
 * Funciones puras sin dependencia de DOM ni Firebase.
 */

export const JORNADA_MIN = 440;
export const FIXED_BREAK = 60;

export function toMin(t) {
  if (!t) return null;
  const [h, m] = t.split(':');
  return parseInt(h) * 60 + parseInt(m);
}

export function fmMin(m) {
  if (m === null || m === undefined) return '--';
  const neg = m < 0;
  m = Math.abs(m);
  return (neg ? '-' : '') + Math.floor(m / 60) + 'h' + String(m % 60).padStart(2, '0');
}

export function to12(t) {
  if (!t || t === '--') return '--';
  const [hStr, min] = t.split(':');
  let h = parseInt(hStr);
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${min} ${ap}`;
}

export function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function fmDate(s) {
  if (!s) return '--';
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
}

export function getPeriod(date, periodoDia = 16) {
  const d = new Date(date + 'T00:00:00');
  let start, end;
  if (d.getDate() >= periodoDia) {
    start = new Date(d.getFullYear(), d.getMonth(), periodoDia);
    end   = new Date(d.getFullYear(), d.getMonth() + 1, periodoDia - 1);
  } else {
    start = new Date(d.getFullYear(), d.getMonth() - 1, periodoDia);
    end   = new Date(d.getFullYear(), d.getMonth(), periodoDia - 1);
  }
  return {
    start: start.toISOString().slice(0, 10),
    end:   end.toISOString().slice(0, 10)
  };
}

export function calcJ(entrada, salida) {
  const em = toMin(entrada);
  const sm = toMin(salida);
  if (em === null || sm === null) return null;
  let tot = sm - em;
  if (tot < 0) tot += 1440;
  const ef = tot - FIXED_BREAK;
  return { tot, desc: FIXED_BREAK, ef, delta: ef - JORNADA_MIN };
}

export function enrichReg(r) {
  if (r.entrada && r.salida) {
    const j = calcJ(r.entrada, r.salida);
    if (j) return { ...r, ef: j.ef, delta: j.delta };
  }
  return { ...r, ef: r.ef || 0, delta: r.delta || 0 };
}

export function withSaldo(registros) {
  let acum = 0;
  return [...registros]
    .sort((a, b) => a.fecha > b.fecha ? 1 : -1)
    .map(r => {
      acum += (r.delta || 0);
      return { ...r, _saldo: acum, saldoAc: acum };
    });
}

export function isEfValido(ef) {
  return ef > 0 && ef <= 720;
}
