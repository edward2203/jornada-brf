import { fmMin, fmDate, todayStr, getPeriod, enrichReg, withSaldo, JORNADA_MIN } from './jornada.js';
import { getRegistros, getCfg, getSabadoTipo } from './storage.js';

function fmTime(t, pending) {
  if (!t) return pending ? '<span style="color:var(--amb);font-size:10px">⏳ pendiente</span>' : '--';
  const [hStr, m] = t.split(':');
  let h = parseInt(hStr); const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12;
  return t + ' / ' + h + ':' + m + ' ' + ap;
}

function to12(t) {
  if (!t || t === '--') return '--';
  const [hStr, m] = t.split(':'); let h = parseInt(hStr);
  const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return h + ':' + m + ' ' + ap;
}

export function renderDash() {
  const t = todayStr();
  const dateEl = document.getElementById('dashDate');
  if (dateEl) dateEl.textContent = fmDate(t) + ' · ' + new Date().toLocaleDateString('es', { weekday: 'long' });

  const p = getPeriod(t);
  const data = getRegistros()
    .filter(r => r.fecha >= p.start && r.fecha <= p.end)
    .sort((a, b) => a.fecha > b.fecha ? 1 : -1);
  const ws = withSaldo(data.map(enrichReg));
  const sal = ws.length ? ws[ws.length - 1].saldoAc : 0;

  // Saldo principal
  const se = document.getElementById('dashSaldo');
  if (se) { se.textContent = (sal >= 0 ? '+' : '') + fmMin(sal); se.className = 'saldo-value ' + (sal >= 0 ? 'pos' : 'neg'); }

  const maxBar = 300, pct = Math.min(Math.abs(sal) / maxBar * 100, 100);
  const bar = document.getElementById('dashSaldoBar');
  if (bar) { bar.style.width = pct + '%'; bar.className = 'saldo-bar ' + (sal >= 0 ? 'pos' : 'neg'); }

  const tag = document.getElementById('dashSaldoTag');
  const det = document.getElementById('dashSaldoDetail');
  if (tag && det) {
    if (sal > 0) { tag.textContent = '✓ A FAVOR'; tag.className = 'saldo-tag pos'; det.textContent = 'Tenés ' + fmMin(sal) + ' de extra acumuladas'; }
    else if (sal < 0) { tag.textContent = '⚠ DEBÉS'; tag.className = 'saldo-tag neg'; det.textContent = 'Faltan ' + fmMin(Math.abs(sal)) + ' para equilibrar'; }
    else { tag.textContent = '= EQUILIBRADO'; tag.className = 'saldo-tag pos'; det.textContent = 'Saldo exacto en cero'; }
  }

  // Barra día libre
  _renderBarraDiaLibre(sal, p, t);

  // Stats
  const totEf  = data.reduce((a, b) => a + (b.ef || 0), 0);
  const totEx  = data.reduce((a, b) => b.delta > 0 ? a + b.delta : a, 0);
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('dDias',  data.length);
  set('dTrab',  fmMin(totEf));
  set('dNorm',  fmMin(data.length * JORNADA_MIN));
  set('dExtra', fmMin(totEx));
  set('dashPeriod', 'Del ' + fmDate(p.start) + ' al ' + fmDate(p.end));

  // Tabla últimos 5
  const last = ws.slice().reverse().slice(0, 5);
  const tb = document.getElementById('dashTbl');
  if (tb) {
    if (!last.length) {
      tb.innerHTML = '<tr><td colspan="5"><div class="empty"><div class="empty-icon">📋</div><div class="empty-text">Sin registros en el período actual</div></div></td></tr>';
    } else {
      tb.innerHTML = last.map(r => {
        const c = r.delta > 0 ? 'pos' : r.delta < 0 ? 'neg' : '';
        return '<tr><td>' + fmDate(r.fecha) + '</td><td>' + fmTime(r.entrada) + '</td>'
          + '<td>' + fmTime(r.salida, !r.salida) + '</td><td>' + fmMin(r.ef) + '</td>'
          + '<td class="' + c + '">' + (r.delta >= 0 ? '+' : '') + fmMin(r.delta) + '</td></tr>';
      }).join('');
    }
  }

  // Sugerencias
  _renderResumen(sal, p, t);
}

function _renderBarraDiaLibre(sal, p, t) {
  const pct = sal <= 0 ? 0 : Math.min(Math.round(sal / JORNADA_MIN * 100), 100);
  const diasLibres = Math.floor(sal / JORNADA_MIN);
  const resto = sal % JORNADA_MIN;
  const SAB_REF = [{hora:'19:00',min:150},{hora:'18:00',min:210},{hora:'17:00',min:270},{hora:'16:00',min:330}];

  const barEl  = document.getElementById('diaLibreBar');
  const pctEl  = document.getElementById('diaLibrePct');
  const msgEl  = document.getElementById('diaLibreMsg');

  if (barEl) {
    barEl.style.width = pct + '%';
    if (sal < 0) { barEl.style.background = 'var(--red)'; barEl.style.width = Math.min(Math.abs(sal)/JORNADA_MIN*100,100)+'%'; }
    else if (pct >= 100) { barEl.style.background = 'linear-gradient(90deg,var(--green),#00ff88)'; barEl.style.boxShadow = '0 0 12px var(--gg)'; }
    else if (pct >= 50) { barEl.style.background = 'linear-gradient(90deg,#00b050,var(--green))'; barEl.style.boxShadow = 'none'; }
    else { barEl.style.background = 'linear-gradient(90deg,var(--amb),#ffd040)'; barEl.style.boxShadow = 'none'; }
  }
  if (pctEl) { pctEl.textContent = (sal < 0 ? '-' : '') + pct + '%'; pctEl.style.color = sal < 0 ? 'var(--red)' : pct >= 100 ? 'var(--green)' : 'var(--tx)'; }

  if (msgEl) {
    if (sal < 0) { msgEl.innerHTML = '<span style="color:var(--red)">Necesitás ' + fmMin(Math.abs(sal)) + ' para equilibrar</span>'; }
    else if (sal === 0) { msgEl.innerHTML = '<span style="color:var(--tx3)">Saldo en cero</span>'; }
    else {
      const lines = [];
      if (diasLibres >= 1) {
        let msg = diasLibres === 1 ? '🏖 1 día libre completo' : '🏖 ' + diasLibres + ' días libres';
        if (resto > 0) msg += ' + ' + fmMin(resto);
        lines.push('<span style="color:var(--green);font-weight:700">' + msg + '</span>');
      } else {
        lines.push('<span style="color:var(--tx2)">Faltan ' + fmMin(JORNADA_MIN - sal) + ' para un día libre</span>');
      }
      const sabOpc = SAB_REF.filter(r => sal >= r.min);
      if (sabOpc.length) {
        const mejor = sabOpc[sabOpc.length - 1];
        lines.push('<span style="color:#ffb400">🚕 Sáb sin abate: podés salir a las ' + mejor.hora + ' (usás ' + fmMin(mejor.min) + ')</span>');
      } else if (sal > 0) {
        lines.push('<span style="color:var(--tx3)">🚕 Sáb: faltan ' + fmMin(SAB_REF[0].min - sal) + ' para salir a las 19:00</span>');
      }
      msgEl.innerHTML = lines.join('<br>');
    }
  }
}

function _renderResumen(sal, p, t) {
  const resEl = document.getElementById('dashResumen');
  if (!resEl) return;
  resEl.style.display = '';
  const diasRest = Math.max(0, Math.ceil((new Date(p.end + 'T00:00:00') - new Date(t + 'T00:00:00')) / 86400000));
  const absSal = Math.abs(sal);
  const _c = getCfg();
  const ENTRADA_NORMAL = _c.entradaHora * 60 + _c.entradaMin;
  const SALIDA_NORMAL  = _c.salidaHora  * 60 + _c.salidaMin;
  const fmH = m => String(Math.floor(m/60)).padStart(2,'0') + ':' + String(m%60).padStart(2,'0');
  const sabTipo = getSabadoTipo();
  const BUS_TARDE = [
    {bus:14*60+15, tardeMin:50, label:'Bus 14:15 → llega ~14:50 (+50min)'},
    {bus:14*60+30, tardeMin:60, label:'Bus 14:30 → llega ~15:00 (+1h)'}
  ];

  const row = (icon, label, val, color) =>
    '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.05)">'
    + '<span style="color:var(--tx2);font-size:11px">' + icon + ' ' + label + '</span>'
    + '<strong style="color:' + color + ';font-size:13px">' + val + '</strong></div>';

  if (sal >= 0) {
    resEl.style.background = 'rgba(0,230,118,.05)';
    resEl.style.border = '1px solid rgba(0,230,118,.2)';
    resEl.style.padding = '14px 16px';
    let opts = '';
    if (diasRest === 0) {
      opts = '<div style="color:var(--tx2);font-size:11px;padding:6px 0">Período cerrado con <strong style="color:var(--green)">+' + fmMin(sal) + '</strong> a favor ✓</div>';
    } else {
      const SAB_SALIDA = sabTipo === 'sin' ? (_c.sabSalidaHora*60+_c.sabSalidaMin) : SALIDA_NORMAL;
      const sabLabel = sabTipo === 'sin' ? '🚕 Sábado sin abate (taxi)' : '🐔 Sábado con abate (bus 22:00)';
      let sabOpts = '';
      if (sabTipo === 'sin') {
        [{hora:19*60,label:'Salir 19:00'},{hora:18*60,label:'Salir 18:00'},{hora:17*60,label:'Salir 17:00'},{hora:16*60,label:'Salir 16:00'}]
          .forEach(op => { const uso = SAB_SALIDA - op.hora; if (uso > 0 && uso <= sal) sabOpts += row(op.hora<=17*60?'🌞':'🌆', op.label, 'Usa '+fmMin(uso)+' · sobran '+fmMin(sal-uso), '#ffb400'); });
        if (!sabOpts) sabOpts = '<div style="font-family:var(--mono);font-size:11px;color:var(--tx3);padding:4px 0">Saldo insuficiente para salir antes</div>';
      } else {
        sabOpts = '<div style="font-family:var(--mono);font-size:11px;color:var(--tx3);padding:4px 0">Bus 22:00 fijo</div>';
        BUS_TARDE.forEach(bt => { if (bt.tardeMin <= sal) sabOpts += row('⏰', bt.label, '−'+fmMin(bt.tardeMin)+' · sobran '+fmMin(sal-bt.tardeMin), 'var(--green)'); });
      }
      opts += '<div style="background:rgba(255,180,0,.08);border:1px solid rgba(255,180,0,.2);border-radius:8px;padding:10px 12px;margin-bottom:6px">'
        + '<div style="font-family:var(--mono);font-size:10px;color:#ffb400;font-weight:700;margin-bottom:8px;text-transform:uppercase">' + sabLabel + '</div>'
        + sabOpts + '</div>';
      BUS_TARDE.forEach(bt => { if (bt.tardeMin <= sal) opts += row('⏰', bt.label, '−'+fmMin(bt.tardeMin)+' · sobran '+fmMin(sal-bt.tardeMin), 'var(--green)'); });
      const diasLibres = Math.floor(sal / JORNADA_MIN);
      if (diasLibres >= 1) opts += row('🏖', 'Días completos libres', diasLibres + ' día' + (diasLibres > 1 ? 's' : '') + ' libre' + (diasLibres > 1 ? 's' : ''), '#ffb400');
    }
    resEl.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">'
      + '<span style="color:var(--green);font-size:14px;font-weight:700">✓ Estás al día</span>'
      + '<span style="font-family:var(--mono);font-size:11px;background:rgba(0,230,118,.15);color:var(--green);padding:3px 10px;border-radius:12px">+' + fmMin(sal) + '</span></div>'
      + '<div style="font-family:var(--mono);font-size:10px;color:var(--tx3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px">' + diasRest + ' días restantes · opciones</div>' + opts;
  } else {
    resEl.style.background = 'rgba(255,68,68,.05)';
    resEl.style.border = '1px solid rgba(255,68,68,.2)';
    resEl.style.padding = '14px 16px';
    const xDiaNeg = Math.ceil(absSal / Math.max(diasRest, 1));
    let opts2 = diasRest === 0
      ? '<div style="color:var(--red);font-size:11px;padding:6px 0">Período cerrado con <strong>−' + fmMin(absSal) + '</strong> negativo.</div>'
      : row('🌅', 'Entrar antes cada día', fmH(ENTRADA_NORMAL - xDiaNeg) + ' (−' + fmMin(xDiaNeg) + ' por día)', '#ffb400')
        + row('🚌', 'Bus 12:30 → llega ~13:05', 'Entrar 13:05 · gana 55min/día', '#7eb8ff')
        + '<div style="margin-top:8px;padding:8px 10px;background:rgba(255,180,0,.07);border:1px solid rgba(255,180,0,.2);border-radius:6px;font-family:var(--mono);font-size:10px;color:#ffb400">⚠ No se sugiere salir después de 22:00 — bus fijo</div>';
    resEl.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">'
      + '<span style="color:var(--red);font-size:14px;font-weight:700">⚠ Horas pendientes</span>'
      + '<span style="font-family:var(--mono);font-size:11px;background:rgba(255,68,68,.15);color:var(--red);padding:3px 10px;border-radius:12px">−' + fmMin(absSal) + '</span></div>'
      + '<div style="font-family:var(--mono);font-size:10px;color:var(--tx3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px">' + diasRest + ' días restantes</div>' + opts2;
  }
}

window.renderDash = renderDash;