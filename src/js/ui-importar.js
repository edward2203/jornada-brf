import { calcJ, fmMin, fmDate, toMin, to12, getPeriod, todayStr, withSaldo } from './jornada.js';
import { getRegistros, saveRegistros, getClaudeKey, getGeminiKey, getIAProvider } from './storage.js';
import { callIAWithImage, parseJSONResponse, fileToBase64 } from './ia.js';

let impImgs   = [];
let impParsed = [];

function stImp(html, t) {
  const co = { ok:'var(--green)', warn:'var(--amb)', error:'var(--red)', info:'var(--blu)' };
  const el = document.getElementById('impStatus');
  const txt = document.getElementById('impStatusTxt');
  if (el)  el.style.display = '';
  if (txt) txt.innerHTML = '<span style="font-family:var(--mono);font-size:12px;color:' + (co[t]||'var(--tx)') + '">' + html + '</span>';
}

function renderThumbs() {
  const el = document.getElementById('impThumbs');
  if (!el) return;
  el.innerHTML = impImgs.map((img, i) =>
    '<div style="position:relative;display:inline-block;margin:4px">'
    + '<img src="' + img.url + '" style="width:80px;height:80px;object-fit:cover;border-radius:6px;border:1px solid var(--bdr)">'
    + '<button onclick="removeImpImg(' + i + ')" style="position:absolute;top:-4px;right:-4px;background:var(--red);border:none;color:#fff;border-radius:50%;width:18px;height:18px;font-size:10px;cursor:pointer;line-height:1">×</button>'
    + '</div>'
  ).join('');
}

function buildFecha(r) {
  if (!r.fecha) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(r.fecha)) return r.fecha;
  const m = r.fecha.match(/(\d{2})[\/\-](\d{2})[\/\-](\d{2,4})/);
  if (m) { const y = m[3].length === 2 ? '20' + m[3] : m[3]; return y + '-' + m[2] + '-' + m[1]; }
  return null;
}

function parseSaldo(s) {
  if (!s) return 0;
  const neg = s.includes('-');
  const m = s.match(/(\d+):(\d+)/);
  if (!m) return 0;
  const min = parseInt(m[1]) * 60 + parseInt(m[2]);
  return neg ? -min : min;
}

export function renderImpPreview() {
  const exDates = new Set(getRegistros().map(r => r.fecha));
  const tb = document.getElementById('impTbl');
  if (!tb) return;
  tb.innerHTML = impParsed.map((r, i) => {
    const fecha = buildFecha(r);
    const exist = exDates.has(fecha);
    const sm    = parseSaldo(r.saldoDia);
    const sc    = sm >= 0 ? 'pos' : 'neg';
    const tag   = exist ? '<span class="tag tag-a">Reemplaza</span>' : '<span class="tag tag-g">Nuevo</span>';
    const chk   = '<input type="checkbox" class="imp-chk" data-i="' + i + '" ' + (exist ? '' : 'checked') + ' style="accent-color:var(--green)">';
    if (!r.temDados) return '<tr class="' + (exist ? 'imp-exists' : 'imp-new') + '" data-i="' + i + '"><td>' + chk + '</td><td>' + fmDate(fecha) + '</td><td colspan="4" style="color:var(--tx2);font-size:10px">' + (r.ocorrencia || 'Sin marcacion') + '</td><td>' + (r.saldoDia || '00:00') + '</td><td></td><td>' + tag + '</td></tr>';
    return '<tr class="' + (exist ? 'imp-exists' : 'imp-new') + '" data-i="' + i + '"><td>' + chk + '</td><td>' + fmDate(fecha) + '</td>'
      + '<td class="pos">' + (r.e1 || '--') + '</td><td>' + (r.s1 || '--') + '</td>'
      + '<td style="font-size:10px;color:var(--tx2)">' + (r.e2||'17:00') + '-' + (r.s2||'18:00') + '</td>'
      + '<td>' + (r.jornadaTotal || '--') + '</td>'
      + '<td class="' + sc + '">' + (sm >= 0 ? '+' : '') + fmMin(Math.abs(sm)) + '</td>'
      + '<td style="font-size:10px;color:var(--tx2)">' + (r.ocorrencia || '') + '</td><td>' + tag + '</td></tr>';
  }).join('');
  const prev = document.getElementById('impPreview');
  if (prev) prev.style.display = '';
  const chkAll = document.getElementById('chkAll');
  if (chkAll) chkAll.checked = true;
}

window.readImages = function() {
  if (!impImgs.length) { stImp('Selecciona al menos una imagen primero.', 'warn'); return; }
  const btn = document.getElementById('btnRead');
  if (btn) { btn.disabled = true; btn.textContent = 'Procesando...'; }
  stImp('⟳ Leyendo imágenes...', 'info');

  const prompt = `Analizá este Espelho de Ponto BRF y extraé los registros en JSON.
Responde SOLO con JSON array, sin texto ni backticks.
Cada elemento: {"fecha":"DD/MM/AA","dia":"SEG","e1":"HH:MM","s1":"HH:MM","e2":"HH:MM","s2":"HH:MM","jornadaTotal":"HH:MM","saldoDia":"+/-HH:MM","ocorrencia":"texto","temDados":true/false}
Si el día no tiene marcación, temDados=false. Incluí TODOS los días del espelho.`;

  Promise.all(impImgs.map(async img => {
    const b64 = img.b64;
    const mime = img.mime || 'image/jpeg';
    const provider = getIAProvider();
    let result;
    if (provider === 'gemini') {
      const key = getGeminiKey();
      const res = await fetch('https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=' + key, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ inline_data: { mime_type: mime, data: b64 } }, { text: prompt }] }], generationConfig: { maxOutputTokens: 4000 } })
      });
      const d = await res.json(); if (d.error) throw new Error(d.error.message);
      result = d.candidates[0].content.parts[0].text;
    } else {
      const key = getClaudeKey();
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 4000, messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: mime, data: b64 } }, { type: 'text', text: prompt }] }] })
      });
      const d = await res.json(); if (d.error) throw new Error(d.error.message);
      result = d.content.map(b => b.text || '').join('');
    }
    return parseJSONResponse(result);
  }))
  .then(results => {
    impParsed = results.flat();
    renderImpPreview();
    stImp('✓ ' + impParsed.length + ' registros encontrados. Revisá y confirmá.', 'ok');
  })
  .catch(e => stImp('Error: ' + e.message, 'error'))
  .finally(() => { if (btn) { btn.disabled = false; btn.textContent = 'Leer con IA'; } });
};

window.doImport = function() {
  let data = getRegistros(), added = 0, replaced = 0;
  document.querySelectorAll('.imp-chk').forEach(chk => {
    if (!chk.checked) return;
    const i = parseInt(chk.dataset.i), r = impParsed[i]; if (!r) return;
    const fecha = buildFecha(r); if (!fecha) return;
    const jc = r.temDados && r.e1 && r.s1 ? calcJ(r.e1, r.s1) : null;
    const reg = { id: Date.now().toString() + '_' + i, fecha, entrada: r.e1||null, salida: r.s1||null,
      nota: r.ocorrencia||'Importado BRF', tot: jc?.tot||0, desc: 60, ef: jc?.ef||0, delta: jc?.delta||0 };
    const idx = data.findIndex(d => d.fecha === fecha);
    if (idx >= 0) { reg.id = data[idx].id; data[idx] = reg; replaced++; } else { data.push(reg); added++; }
  });
  data.sort((a, b) => a.fecha > b.fecha ? 1 : -1);
  saveRegistros(data);
  const res = document.getElementById('impResult');
  if (res) { res.style.display = ''; res.innerHTML = '<div class="alert alert-ok"><span>✓</span><span><strong>Importación completada</strong><br>' + added + ' nuevos, ' + replaced + ' reemplazados.<br><button class="btn btn-p" style="margin-top:10px" onclick="window._nav?.(\'historial\')">Ver Historial</button></span></div>'; }
  document.getElementById('impPreview').style.display = 'none';
  window._renderAll?.();
};

window.clearImport = function() {
  impImgs = []; impParsed = []; renderThumbs();
  ['impPreview', 'impStatus', 'impResult'].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
};

window.addImpImg = function(e) {
  Array.from(e.target.files).forEach(file => {
    const reader = new FileReader();
    reader.onload = ev => {
      impImgs.push({ url: ev.target.result, b64: ev.target.result.split(',')[1], mime: file.type });
      renderThumbs();
    };
    reader.readAsDataURL(file);
  });
};

window.removeImpImg = function(i) {
  impImgs.splice(i, 1);
  renderThumbs();
};

window.toggleAll = function(v) {
  document.querySelectorAll('.imp-chk').forEach(c => c.checked = v);
};

window.renderImpPreview = renderImpPreview;