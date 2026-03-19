import { fmMin, fmDate, todayStr, getPeriod, withSaldo, enrichReg } from './jornada.js';
import { getRegistros, getCfg } from './storage.js';

function fmTime(t) {
  if (!t) return '--';
  const [hStr, m] = t.split(':');
  let h = parseInt(hStr);
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return t + ' / ' + h + ':' + m + ' ' + ap;
}

export function renderRes() {
  const tipo = document.getElementById('resTipo')?.value;
  let start, end;
  if (tipo === 'cur') {
    const p = getPeriod(todayStr()); start = p.start; end = p.end;
  } else {
    start = document.getElementById('resDe')?.value;
    end   = document.getElementById('resHa')?.value;
    if (!start || !end) return;
  }

  const data = getRegistros()
    .filter(r => r.fecha >= start && r.fecha <= end)
    .map(enrichReg)
    .sort((a, b) => a.fecha > b.fecha ? 1 : -1);
  const ws    = withSaldo(data);
  const c     = getCfg();
  const totEf = data.reduce((a, b) => a + (b.ef || 0), 0);
  const totN  = data.length * c.jornada * 60;
  const totEx = data.reduce((a, b) => b.delta > 0 ? a + b.delta : a, 0);
  const totF  = data.reduce((a, b) => b.delta < 0 ? a + Math.abs(b.delta) : a, 0);
  const sf    = ws.length ? ws[ws.length - 1].saldoAc : 0;

  const stats = document.getElementById('resStats');
  if (stats) stats.innerHTML = [
    ['Días', data.length, ''],
    ['Trabajado', fmMin(totEf), ''],
    ['Normal', fmMin(totN), ''],
    ['Extras', '+' + fmMin(totEx), 'pos'],
    ['Faltas', '-' + fmMin(totF), 'neg'],
    ['Saldo Final', (sf >= 0 ? '+' : '') + fmMin(sf), sf >= 0 ? 'pos' : 'neg']
  ].map(([l, v, c]) => `<div class="stat-box"><div class="stat-label">${l}</div><div class="stat-value ${c}">${v}</div></div>`).join('');

  const tb = document.getElementById('resTbl');
  if (tb) {
    if (!ws.length) {
      tb.innerHTML = '<tr><td colspan="7"><div class="empty"><div class="empty-icon">📋</div><div class="empty-text">Sin datos</div></div></td></tr>';
    } else {
      tb.innerHTML = ws.map(r => {
        const dc = r.delta > 0 ? 'pos' : r.delta < 0 ? 'neg' : '';
        const sc = r.saldoAc >= 0 ? 'pos' : 'neg';
        return '<tr><td>' + fmDate(r.fecha) + '</td><td>' + fmTime(r.entrada) + '</td>'
          + '<td>' + fmTime(r.salida) + '</td><td>' + fmMin(r.ef) + '</td>'
          + '<td class="' + dc + '">' + (r.delta >= 0 ? '+' : '') + fmMin(r.delta) + '</td>'
          + '<td class="' + sc + '">' + (r.saldoAc >= 0 ? '+' : '') + fmMin(r.saldoAc) + '</td></tr>';
      }).join('');
    }
  }

  // CSV export
  let csv = 'FECHA\tENTRADA\tSALIDA\tTRABAJADO\tEXTRA/FALTA\tSALDO\n';
  csv += ws.map(r =>
    fmDate(r.fecha) + '\t' + (r.entrada||'--') + '\t' + (r.salida||'--') + '\t'
    + fmMin(r.ef) + '\t' + (r.delta >= 0 ? '+' : '') + fmMin(r.delta) + '\t'
    + (r.saldoAc >= 0 ? '+' : '') + fmMin(r.saldoAc)
  ).join('\n');
  csv += '\n\nDías: ' + data.length + '\nExtras: +' + fmMin(totEx) + '\nFaltas: -' + fmMin(totF) + '\nSaldo: ' + (sf >= 0 ? '+' : '') + fmMin(sf);
  const expPre = document.getElementById('exportPre');
  if (expPre) expPre.textContent = csv;
}

window.toggleResCustom = function() {
  const v = document.getElementById('resTipo')?.value === 'custom';
  const dw = document.getElementById('resDW'); if (dw) dw.style.display = v ? '' : 'none';
  const hw = document.getElementById('resHW'); if (hw) hw.style.display = v ? '' : 'none';
};

window.copyText = function() {
  const txt = document.getElementById('exportPre')?.textContent;
  if (txt) navigator.clipboard.writeText(txt).then(() => alert('Copiado!'));
};

window.exportCSV = function() {
  const txt = document.getElementById('exportPre')?.textContent;
  if (!txt) return;
  const b = new Blob([txt.replace(/\t/g, ',')], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(b);
  a.download = 'jornada_brf_' + todayStr() + '.csv';
  a.click();
};

window.renderRes = renderRes;