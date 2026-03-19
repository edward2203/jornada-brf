import { fmMin, fmDate, todayStr, getPeriod, enrichReg, withSaldo } from './jornada.js';
import { getRegistros, getCfgSal, saveCfgSal, getIAProvider, getClaudeKey, getGeminiKey } from './storage.js';
import { calcularSalario, calcularProyeccion, calcINSS, fmBRL, MAX_EF } from './salary.js';
import { callIAWithImage, parseJSONResponse, fileToBase64 } from './ia.js';

let _holFile = null;

function rowSal(label, val, color) {
  return '<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.05)">'
    + '<span style="font-family:var(--mono);font-size:11px;color:var(--tx2)">' + label + '</span>'
    + '<strong style="color:' + (color || 'var(--tx)') + '">' + fmBRL(val) + '</strong></div>';
}

export function renderSalario() {
  const c  = getCfgSal();
  const vh = c.valorHora || 0;
  const set  = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  const setH = (id, v) => { const el = document.getElementById(id); if (el) el.innerHTML = v; };

  if (!vh) {
    set('salTotal', 'R$ --');
    set('salObs', 'Subí tu holerite en ⚙ Cuenta → Configuração Salarial');
    return;
  }

  const p    = getPeriod(todayStr());
  const regs = getRegistros()
    .filter(r => r.fecha >= p.start && r.fecha <= p.end)
    .map(enrichReg);

  const sal = calcularSalario(regs, c);
  if (!sal) return;

  set('salHNorm',    fmMin(sal.minNorm));
  set('salHExtra',   sal.minExtra > 0 ? '+' + fmMin(sal.minExtra) : '0h00');
  set('salDias',     sal.diasReg + 'd');
  set('salBruto',    fmBRL(sal.totalBruto));
  set('salDescTotal','- ' + fmBRL(sal.totalDesc));
  set('salTotal',    fmBRL(sal.liquido));
  set('salObs',      sal.diasReg + ' días registrados · período actual · estimativa');

  // Aviso corrompidos
  const av = document.getElementById('rCorrompidos');
  if (av) {
    if (sal.corrompidos.length > 0) {
      av.textContent = '⚠ ' + sal.corrompidos.length + ' registro(s) ignorados por ef > 12h';
      av.style.display = '';
    } else { av.style.display = 'none'; }
  }

  // Proventos
  let pv = '';
  if (sal.corrompidos.length > 0) pv += '<div style="background:rgba(255,68,68,.08);border:1px solid rgba(255,68,68,.2);border-radius:7px;padding:8px 10px;font-family:var(--mono);font-size:10px;color:var(--red);margin-bottom:10px">⚠ ' + sal.corrompidos.length + ' días ignorados (ef>12h)</div>';
  pv += rowSal('Horas normais (' + fmMin(sal.minNorm) + ')', sal.vHorasNorm, 'var(--tx)');
  if (sal.vExtras  > 0) pv += rowSal('H. extra ' + c.extra1 + '% (' + fmMin(sal.minExtra) + ')', sal.vExtras, 'var(--amb)');
  if (sal.vInsalub > 0) pv += rowSal('Insalubridade', sal.vInsalub, 'var(--amb)');
  if (sal.vTroca   > 0) pv += rowSal('Troca Uniforme extra 50%', sal.vTroca, 'var(--tx2)');
  if (sal.vDSR     > 0) pv += rowSal('DSR ~' + sal.diasDSR + 'd', sal.vDSR, 'var(--tx2)');
  pv += '<div style="display:flex;justify-content:space-between;padding:9px 0;margin-top:4px"><strong>Total Proventos</strong><strong style="color:var(--amb)">' + fmBRL(sal.totalBruto) + '</strong></div>';
  setH('salProventos', pv);

  // Descontos
  let dv = '';
  dv += rowSal('INSS progressivo 2026', sal.vINSS, 'var(--red)');
  if (c.contribAssist > 0) dv += rowSal('Contrib. Assistencial', c.contribAssist, 'var(--red)');
  if (c.segVida       > 0) dv += rowSal('Seguro de Vida', c.segVida, 'var(--red)');
  if (c.odonto        > 0) dv += rowSal('Odontológico', c.odonto, 'var(--red)');
  if (c.cesta         > 0) dv += rowSal('Cesta Básica', c.cesta, 'var(--red)');
  if (c.refeicoes     > 0) dv += rowSal('Refeições', c.refeicoes, 'var(--red)');
  if (c.lanche        > 0) dv += rowSal('Lanche', c.lanche, 'var(--red)');
  if (c.loja          > 0) dv += rowSal('Loja BRF', c.loja, 'var(--red)');
  if (c.outrosDesc    > 0) dv += rowSal('Outros', c.outrosDesc, 'var(--red)');
  dv += '<div style="display:flex;justify-content:space-between;padding:9px 0;margin-top:4px"><strong>Total Descontos</strong><strong style="color:var(--red)">' + fmBRL(sal.totalDesc) + '</strong></div>';
  setH('salDescontos', dv);

  // Desglose por dia
  const des = document.getElementById('salDesglose');
  if (des) {
    const rows = regs.filter(r => r.ef > 0 && r.ef <= MAX_EF).map(r => {
      const norm = Math.min(r.ef, 440), ext = Math.max(0, r.ef - 440);
      const vd = (norm / 60 * sal.vh) + (ext / 60 * sal.vHExtra);
      return '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.05)">'
        + '<span style="color:var(--tx2)">' + fmDate(r.fecha) + '</span>'
        + '<span>' + fmMin(norm) + '<span style="color:var(--tx3)"> n</span>' + (ext > 0 ? '+<span style="color:var(--amb)">' + fmMin(ext) + '</span>e' : '') + '</span>'
        + '<span style="color:var(--amb)">' + fmBRL(vd) + '</span></div>';
    }).join('');
    des.innerHTML = rows || '<span style="color:var(--tx3)">Sin días registrados en este período</span>';
  }

  // Referencia
  const ref = document.getElementById('salReferencia');
  if (ref) ref.innerHTML = [
    ['Hora normal', fmBRL(sal.vh), 'var(--tx)'],
    ['Hora extra +' + c.extra1 + '%', fmBRL(sal.vHExtra), 'var(--amb)'],
    ['Hora extra +' + c.extra2 + '% (dom)', fmBRL(sal.vHExtra2), '#ff9800'],
    ['Hora noturna +' + c.noturno + '%', fmBRL(sal.vHNot), 'var(--blu)'],
    ['FGTS (8% bruto)', fmBRL(sal.fgts), 'var(--tx3)']
  ].map(r => rowSal(r[0], r[1], r[2]).replace(fmBRL(r[1]), r[1])).join('');

  // Proyección
  const proy = document.getElementById('salProyeccion');
  if (proy) {
    const diasCal = Math.max(0, Math.ceil((new Date(p.end + 'T00:00:00') - new Date(todayStr() + 'T00:00:00')) / 86400000));
    const proj = calcularProyeccion(sal, diasCal);
    proy.innerHTML = rowSal('Acumulado bruto', sal.totalBruto, 'var(--amb)')
      + rowSal('Acumulado líquido', sal.liquido, 'var(--green)')
      + '<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.05)"><span style="font-family:var(--mono);font-size:11px;color:var(--tx2)">Días laborables restantes</span><span>~' + proj.diasLabRest + '</span></div>'
      + '<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.05)"><span style="font-family:var(--mono);font-size:11px;color:var(--tx2)">Valor estimado/día</span><span>' + fmBRL(proj.vPorDia) + '</span></div>'
      + '<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0"><strong>Proyección líquida al cierre</strong><strong style="color:var(--green);font-size:18px">' + fmBRL(proj.proyLiq) + '</strong></div>'
      + '<div style="font-family:var(--mono);font-size:9px;color:var(--tx3)">* ' + proj.metodo + '</div>';
  }
}

export function saveSalarioCfg() {
  const gv = id => { const el = document.getElementById(id); return el ? el.value : ''; };
  const pf = (id, def) => parseFloat(gv(id)) || def || 0;
  saveCfgSal({
    tipo: gv('cfgTipoSal') || 'horista',
    valorHora: pf('cfgValorHora', 9.35),
    extra1: pf('cfgExtra1', 50), extra2: pf('cfgExtra2', 100),
    noturno: pf('cfgNoturno', 20), hMes: pf('cfgHMes', 220),
    insalub: pf('cfgInsalub', 0), trocaUnif: pf('cfgTrocaUnif', 0),
    contribAssist: pf('cfgContribAssist', 0), segVida: pf('cfgSegVida', 0),
    odonto: pf('cfgOdonto', 0), cesta: pf('cfgCesta', 0),
    refeicoes: pf('cfgRefeicoes', 0), lanche: pf('cfgLanche', 0),
    loja: pf('cfgLoja', 0), outrosDesc: pf('cfgOutrosDesc', 0)
  });
  const msg = document.getElementById('cfgSalMsg');
  if (msg) { msg.textContent = '✓ Configuração salva'; msg.style.color = 'var(--green)'; msg.style.display = ''; setTimeout(() => msg.style.display = 'none', 3000); }
  updateSalCfgResumen();
  renderSalario();
}

export function fillSalarioCfg() {
  const c = getCfgSal();
  const sv = (id, v) => { const el = document.getElementById(id); if (el && v !== undefined) el.value = v; };
  sv('cfgTipoSal', c.tipo); sv('cfgValorHora', c.valorHora);
  sv('cfgExtra1', c.extra1); sv('cfgExtra2', c.extra2);
  sv('cfgNoturno', c.noturno); sv('cfgHMes', c.hMes);
  sv('cfgInsalub', c.insalub); sv('cfgTrocaUnif', c.trocaUnif);
  sv('cfgContribAssist', c.contribAssist); sv('cfgSegVida', c.segVida);
  sv('cfgOdonto', c.odonto); sv('cfgCesta', c.cesta);
  sv('cfgRefeicoes', c.refeicoes); sv('cfgLanche', c.lanche);
  sv('cfgLoja', c.loja); sv('cfgOutrosDesc', c.outrosDesc);
  updateSalCfgResumen();
}

export function updateSalCfgResumen() {
  const c = getCfgSal();
  const el = document.getElementById('salCfgResumen');
  const txt = document.getElementById('salCfgResumenTxt');
  if (!c.valorHora) { if (el) el.style.display = 'none'; return; }
  if (el) el.style.display = '';
  if (txt) txt.innerHTML = 'Tipo: <strong>' + c.tipo + '</strong> · '
    + (c.tipo === 'horista' ? 'R$/h: <strong>' + c.valorHora.toFixed(2) + '</strong>' : 'Salário: <strong>R$ ' + c.valorHora.toFixed(2) + '</strong>') + '<br>'
    + 'Extra: <strong>+' + c.extra1 + '%</strong> · Insalubridade: <strong>R$ ' + (c.insalub || 0).toFixed(2) + '</strong><br>'
    + 'Descontos fixos: <strong>R$ ' + ((c.contribAssist||0)+(c.segVida||0)+(c.odonto||0)+(c.cesta||0)).toFixed(2) + '</strong>'
    + ' · Variáveis: <strong>R$ ' + ((c.refeicoes||0)+(c.lanche||0)+(c.loja||0)+(c.outrosDesc||0)).toFixed(2) + '</strong>';
}

export async function lerHolerite() {
  if (!_holFile) { alert('Seleciona um arquivo primeiro.'); return; }
  const btn = document.getElementById('btnLerHol');
  if (btn) { btn.disabled = true; btn.textContent = '⟳ Analizando...'; }

  const prompt = `Analisa este holerite BRF e extrai os dados em JSON.
Responde SOMENTE com JSON válido, sem texto nem backticks.
{"tipo":"horista","valorHora":0,"extra1":50,"extra2":100,"noturno":20,"hMes":220,
"insalub":0,"trocaUnif":0,"contribAssist":0,"segVida":0,"odonto":0,"cesta":0,
"refeicoes":0,"lanche":0,"loja":0,"outrosDesc":0}
Se um valor não aparecer, usa 0.`;

  try {
    const b64  = await fileToBase64(_holFile);
    const mime = _holFile.type || 'image/jpeg';
    const result = await callIAWithImage(prompt, b64, mime);
    const parsed = parseJSONResponse(result);
    saveCfgSal(parsed);
    fillSalarioCfg();
    updateSalCfgResumen();
    _stHol('✓ Datos extraídos y guardados correctamente.', 'ok');
    renderSalario();
  } catch (e) {
    _stHol('Error: ' + e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '✦ Extraer datos con IA'; }
  }
}

function _stHol(msg, tipo) {
  const el = document.getElementById('holStatus');
  if (!el) return;
  const cols = { ok: 'rgba(0,230,118,.1)', warn: 'rgba(255,171,64,.1)', error: 'rgba(255,68,68,.1)', info: 'rgba(64,196,255,.1)' };
  const txc  = { ok: 'var(--green)', warn: 'var(--amb)', error: 'var(--red)', info: 'var(--blu)' };
  el.style.display = ''; el.style.background = cols[tipo]; el.style.color = txc[tipo]; el.innerHTML = msg;
}

window.onHolFile = function(e) {
  const file = e.target.files[0]; if (!file) return;
  _holFile = file;
  const thumb = document.getElementById('holThumb');
  const fname = document.getElementById('holFileName');
  const btn   = document.getElementById('btnLerHol');
  if (fname) fname.textContent = file.name + ' (' + Math.round(file.size / 1024) + 'KB)';
  if (file.type.indexOf('image/') === 0 && thumb) {
    const reader = new FileReader();
    reader.onload = ev => { thumb.src = ev.target.result; document.getElementById('holPreview').style.display = ''; };
    reader.readAsDataURL(file);
  } else if (document.getElementById('holPreview')) { document.getElementById('holPreview').style.display = ''; }
  if (btn) btn.style.display = '';
};

window.toggleSalCfgEdit = function() {
  const m = document.getElementById('salCfgManual');
  if (m) m.style.display = m.style.display === 'none' ? '' : 'none';
};

window.saveSalarioCfg    = saveSalarioCfg;
window.fillSalarioCfg    = fillSalarioCfg;
window.updateSalCfgResumen = updateSalCfgResumen;
window.lerHolerite       = lerHolerite;
window.renderSalario     = renderSalario;