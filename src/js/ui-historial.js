import { fmMin, fmDate, getPeriod } from './jornada.js';
import { getRegistros } from './storage.js';

function fmTime(t, pending) {
  if (!t) return pending ? '<span style="color:var(--amb);font-size:10px">⏳ pendiente</span>' : '--';
  const [hStr, m] = t.split(':');
  let h = parseInt(hStr);
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return t + ' / ' + h + ':' + m + ' ' + ap;
}

function withSaldo(registros) {
  let acum = 0;
  return [...registros]
    .sort((a, b) => a.fecha > b.fecha ? 1 : -1)
    .map(r => { acum += (r.delta || 0); return { ...r, saldoAc: acum }; });
}

export function renderHist() {
  const data = getRegistros().sort((a, b) => a.fecha > b.fecha ? 1 : -1);
  const filtro = document.getElementById('filtroMes')?.value;
  let fd = data;
  if (filtro && filtro !== 'all') {
    try { const p = JSON.parse(filtro); fd = data.filter(r => r.fecha >= p.start && r.fecha <= p.end); } catch {}
  }
  const ws = withSaldo(fd);
  const tb = document.getElementById('histTbl');
  if (!tb) return;
  if (!ws.length) {
    tb.innerHTML = '<tr><td colspan="9"><div class="empty"><div class="empty-icon">📋</div><div class="empty-text">Sin registros</div></div></td></tr>';
    return;
  }
  tb.innerHTML = ws.map(r => {
    const dc = r.delta > 0 ? 'pos' : r.delta < 0 ? 'neg' : '';
    const sc = r.saldoAc >= 0 ? 'pos' : 'neg';
    return '<tr>'
      + '<td>' + fmDate(r.fecha) + '</td>'
      + '<td>' + fmTime(r.entrada) + '</td>'
      + '<td>' + fmTime(r.salida, !r.salida) + '</td>'
      + '<td>' + fmMin(r.ef) + '</td>'
      + '<td class="' + dc + '">' + (r.delta >= 0 ? '+' : '') + fmMin(r.delta) + '</td>'
      + '<td class="' + sc + '">' + (r.saldoAc >= 0 ? '+' : '') + fmMin(r.saldoAc) + '</td>'
      + '<td style="font-size:10px;color:var(--tx2)">' + (r.nota || '') + '</td>'
      + '<td><div style="display:flex;gap:5px">'
      + '<button class="bxs bxs-e" onclick="editReg(\'' + r.id + '\')">Ed</button>'
      + '<button class="bxs bxs-d" onclick="delReg(\'' + r.id + '\')">X</button>'
      + '</div></td></tr>';
  }).join('');
}

export function populateFiltro() {
  const periods = new Map();
  getRegistros().forEach(r => {
    const p = getPeriod(r.fecha);
    const k = JSON.stringify(p);
    if (!periods.has(k)) periods.set(k, p);
  });
  const sel = document.getElementById('filtroMes');
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="all">Todos los períodos</option>';
  [...periods.values()]
    .sort((a, b) => a.start > b.start ? -1 : 1)
    .forEach(p => {
      sel.innerHTML += '<option value=\'' + JSON.stringify(p) + '\'>' + fmDate(p.start) + ' → ' + fmDate(p.end) + '</option>';
    });
  sel.value = cur || 'all';
}

window.renderHist    = renderHist;
window.populateFiltro = populateFiltro;