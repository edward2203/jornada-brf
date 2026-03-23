import { fmMin, fmDate, todayStr, getPeriod, withSaldo, enrichReg, analizarJornadaAgentes } from './jornada.js';
import { getRegistros, getCfg } from './storage.js';
import { calcularSalario, fmBRL } from './salary.js';

/**
 * ui-resumen.js — AGENTE VISUAL (UI)
 * Renderiza el veredicto final del Pipeline de Agentes.
 */

function fmTime(t) {
  if (!t) return '--';
  const [hStr, m] = t.split(':');
  let h = parseInt(hStr);
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${t} (${h}:${m} ${ap})`;
}

export function renderRes() {
  const tipo = document.getElementById('resTipo')?.value;
  let start, end;
  
  if (tipo === 'cur') {
    const p = getPeriod(todayStr()); 
    start = p.start; 
    end = p.end;
  } else {
    start = document.getElementById('resDe')?.value;
    end   = document.getElementById('resHa')?.value;
    if (!start || !end) return;
  }

  const c = getCfg();
  const rawData = getRegistros()
    .filter(r => r.fecha >= start && r.fecha <= end)
    .sort((a, b) => a.fecha > b.fecha ? 1 : -1);

  // El equipo de agentes procesa cada registro
  const data = rawData.map(r => {
    const veredicto = analizarJornadaAgentes(r.entrada, r.salida);
    return { ...r, ...veredicto };
  });

  const ws = withSaldo(data);
  const resSalario = calcularSalario(ws, c);
  
  // 1. RENDER DE ESTADÍSTICAS (Tarjetas de Agentes)
  const stats = document.getElementById('resStats');
  if (stats && resSalario) {
    const sf = ws.length ? ws[ws.length - 1]._saldo : 0;
    
    stats.innerHTML = [
      ['Días Lab', resSalario.diasReg, ''],
      ['Banco Horas', (sf >= 0 ? '+' : '') + fmMin(sf), sf >= 0 ? 'pos' : 'neg'],
      ['Total Bruto', fmBRL(resSalario.totalBruto), 'pos'],
      ['Sueldo Líquido', fmBRL(resSalario.liquido), 'highlight'], // Nueva clase highlight
      ['FGTS (8%)', fmBRL(resSalario.fgts), ''],
      ['Descuentos', '-' + fmBRL(resSalario.totalDesc), 'neg']
    ].map(([l, v, cl]) => `
      <div class="stat-box ${cl}">
        <div class="stat-label">${l}</div>
        <div class="stat-value">${v}</div>
      </div>
    `).join('');
  }

  // 2. RENDER DE TABLA DETALLADA
  const tb = document.getElementById('resTbl');
  if (tb) {
    if (!ws.length) {
      tb.innerHTML = '<tr><td colspan="6"><div class="empty">📋 Sin datos en este periodo</div></td></tr>';
    } else {
      tb.innerHTML = ws.map(r => {
        const dc = r.delta > 0 ? 'pos' : r.delta < 0 ? 'neg' : '';
        const sc = r._saldo >= 0 ? 'pos' : 'neg';
        return `
          <tr>
            <td>${fmDate(r.fecha)}</td>
            <td>${fmTime(r.entrada)}</td>
            <td>${fmTime(r.salida)}</td>
            <td>${fmMin(r.ef)}</td>
            <td class="${dc}">${r.delta >= 0 ? '+' : ''}${fmMin(r.delta)}</td>
            <td class="${sc}">${r._saldo >= 0 ? '+' : ''}${fmMin(r._saldo)}</td>
          </tr>`;
      }).join('');
    }
  }

  // 3. EXPORTACIÓN CSV (Actualizada con Veredicto)
  const expPre = document.getElementById('exportPre');
  if (expPre && resSalario) {
    let csv = `RESUMEN JORNADA BRF (${start} al ${end})\n`;
    csv += `Líquido Estimado: ${fmBRL(resSalario.liquido)}\n\n`;
    csv += 'FECHA\tENTRADA\tSALIDA\tEFECTIVO\tDELTA\tSALDO\n';
    csv += ws.map(r => 
      `${fmDate(r.fecha)}\t${r.entrada||'--'}\t${r.salida||'--'}\t${fmMin(r.ef)}\t${r.delta >= 0 ? '+' : ''}${fmMin(r.delta)}\t${r._saldo >= 0 ? '+' : ''}${fmMin(r._saldo)}`
    ).join('\n');
    expPre.textContent = csv;
  }
}

// Globales para botones
window.toggleResCustom = () => {
  const v = document.getElementById('resTipo')?.value === 'custom';
  const dw = document.getElementById('resDW'); if (dw) dw.style.display = v ? '' : 'none';
  const hw = document.getElementById('resHW'); if (hw) hw.style.display = v ? '' : 'none';
};

window.copyText = () => {
  const txt = document.getElementById('exportPre')?.textContent;
  if (txt) navigator.clipboard.writeText(txt).then(() => alert('¡Resumen copiado!'));
};

window.exportCSV = () => {
  const txt = document.getElementById('exportPre')?.textContent;
  if (!txt) return;
  const b = new Blob([txt.replace(/\t/g, ',')], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(b);
  a.download = `jornada_brf_${todayStr()}.csv`;
  a.click();
};

window.renderRes = renderRes;