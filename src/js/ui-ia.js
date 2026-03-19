import { fmMin, fmDate, toMin, to12, getPeriod, todayStr, enrichReg, withSaldo } from './jornada.js';
import { getRegistros, getIAProvider, getClaudeKey, getGeminiKey, saveIAProvider, saveClaudeKey, saveGeminiKey } from './storage.js';
import { callIA } from './ia.js';

function iaContexto() {
  const p    = getPeriod(todayStr());
  const data = getRegistros().filter(r => r.fecha >= p.start && r.fecha <= p.end).map(enrichReg);
  const ws   = withSaldo(data);
  const sal  = ws.length ? ws[ws.length - 1].saldoAc : 0;
  const totEx = data.reduce((a, b) => b.delta > 0 ? a + b.delta : a, 0);
  return 'CONTEXTO JORNADA:\nPeríodo: ' + p.start + ' → ' + p.end
    + '\nDías registrados: ' + data.length
    + '\nSaldo actual: ' + (sal >= 0 ? '+' : '') + fmMin(sal)
    + '\nExtras acumuladas: +' + fmMin(totEx)
    + '\nÚltimos 3 días: ' + data.slice(-3).map(r => fmDate(r.fecha) + ' ' + (r.entrada||'--') + '→' + (r.salida||'--') + ' ef:' + fmMin(r.ef)).join(', ');
}

window.iaChatEnviar = function() {
  const input = document.getElementById('iaChatInput');
  const msg   = input?.value.trim();
  if (!msg) return;
  if (input) input.value = '';
  const chat  = document.getElementById('iaChat');
  if (!chat) return;

  chat.innerHTML += '<div style="align-self:flex-end;background:var(--sur3);border-radius:10px 10px 2px 10px;padding:10px 14px;max-width:85%;font-family:var(--mono);font-size:12px;color:var(--tx)">' + msg + '</div>';
  chat.innerHTML += '<div id="iaChatTyping" style="align-self:flex-start;background:var(--sur2);border-radius:10px 10px 10px 2px;padding:10px 14px;font-family:var(--mono);font-size:11px;color:var(--tx2)">⟳ pensando...</div>';
  chat.scrollTop = chat.scrollHeight;
  const btn = document.getElementById('btnChat');
  if (btn) btn.disabled = true;

  const prompt = 'Eres un asistente experto en jornadas laborales CLT de Brasil para un trabajador de BRF S.A. Respondes en español, de forma directa y concisa. No uses markdown, solo texto plano.\n\n'
    + iaContexto() + '\n\nPREGUNTA: ' + msg;

  callIA(prompt)
    .then(resp => {
      document.getElementById('iaChatTyping')?.remove();
      chat.innerHTML += '<div style="align-self:flex-start;background:rgba(0,230,118,.07);border:1px solid rgba(0,230,118,.15);border-radius:10px 10px 10px 2px;padding:10px 14px;max-width:92%;font-family:var(--mono);font-size:12px;color:var(--tx);line-height:1.7">' + resp.replace(/\n/g, '<br>') + '</div>';
      chat.scrollTop = chat.scrollHeight;
    })
    .catch(e => { const t = document.getElementById('iaChatTyping'); if (t) t.textContent = 'Error: ' + e.message; })
    .finally(() => { if (btn) btn.disabled = false; });
};

window.iaAnalizar = function() {
  const btn = document.getElementById('btnAnalizar');
  const el  = document.getElementById('iaAnalisis');
  if (btn) { btn.disabled = true; btn.textContent = 'Analizando...'; }
  if (el)  el.textContent = '⟳ Generando análisis...';

  const prompt = 'Eres un asesor de jornada laboral CLT Brasil. Analizas datos de ponto y das recomendaciones concretas en español, sin markdown, texto plano.\n\n'
    + iaContexto() + '\n\nHaz un análisis completo: tendencias, días con más extras, promedio entrada/salida, proyección saldo al cierre y 3 recomendaciones concretas.';

  callIA(prompt)
    .then(resp => { if (el) el.textContent = resp; })
    .catch(e   => { if (el) el.textContent = 'Error: ' + e.message; })
    .finally(() => { if (btn) { btn.disabled = false; btn.textContent = 'Analizar con IA'; } });
};

export function iaPrediccion() {
  const data = getRegistros().filter(r => r.entrada && r.salida).sort((a, b) => a.fecha > b.fecha ? 1 : -1);
  const el   = document.getElementById('iaPredRes');
  if (!el) return;
  if (data.length < 3) { el.textContent = 'Se necesitan al menos 3 registros para predecir.'; return; }
  const ult  = data.slice(-10);
  const avgE = Math.round(ult.reduce((a, r) => a + toMin(r.entrada), 0) / ult.length);
  const avgS = Math.round(ult.reduce((a, r) => a + toMin(r.salida),  0) / ult.length);
  const avgEf = Math.round(ult.reduce((a, r) => a + (r.ef || 0),     0) / ult.length);
  const fmt  = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  el.style.whiteSpace = 'pre-wrap';
  el.innerHTML = '📊 Basado en los últimos ' + ult.length + ' días:\n\n'
    + '⏰ Entrada promedio: <span style="color:var(--tx)">' + fmt(avgE) + ' / ' + to12(fmt(avgE)) + '</span>\n'
    + '🏁 Salida promedio: <span style="color:var(--tx)">' + fmt(avgS) + ' / ' + to12(fmt(avgS)) + '</span>\n'
    + '⚡ Horas efectivas promedio: <span style="color:var(--green)">' + fmMin(avgEf) + '</span>\n'
    + '📈 Extra/falta promedio: <span style="color:' + (avgEf >= 440 ? 'var(--green)' : 'var(--red)') + '">' + (avgEf - 440 >= 0 ? '+' : '') + fmMin(avgEf - 440) + '</span>\n\n'
    + '🔮 Si mañana entrás a las <strong style="color:var(--tx)">' + fmt(avgE) + '</strong>, deberías salir a las <strong style="color:var(--green)">' + fmt(avgS) + '</strong>';
}

export function iaAnomalias() {
  const data = getRegistros().filter(r => r.entrada && r.salida).sort((a, b) => a.fecha > b.fecha ? 1 : -1);
  const el   = document.getElementById('iaAnomalias');
  if (!el) return;
  if (data.length < 5) { el.textContent = 'Se necesitan al menos 5 registros.'; return; }
  const efs = data.map(r => r.ef || 0);
  const avg = efs.reduce((a, b) => a + b, 0) / efs.length;
  const std = Math.sqrt(efs.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / efs.length);
  const anomalias = data.filter(r => Math.abs(((r.ef||0) - avg) / std) > 1.8)
    .map(r => ({ fecha: r.fecha, ef: r.ef, tipo: r.ef > avg ? 'muy largo' : 'muy corto', z: Math.abs(((r.ef||0)-avg)/std).toFixed(1) }));
  const sinMarca = getRegistros().filter(r => !r.entrada && !r.salida && r.nota && r.nota.toLowerCase().indexOf('repouso') < 0);
  if (!anomalias.length && !sinMarca.length) { el.innerHTML = '<span style="color:var(--green)">✓ Sin anomalías detectadas.</span>'; return; }
  el.innerHTML = anomalias.map(a =>
    '<div style="margin-bottom:8px;padding:8px 10px;background:var(--sur3);border-radius:6px;border-left:3px solid ' + (a.tipo === 'muy largo' ? 'var(--amb)' : 'var(--red)') + '">'
    + '<span style="color:var(--tx)">' + fmDate(a.fecha) + '</span> — '
    + '<span style="color:' + (a.tipo === 'muy largo' ? 'var(--amb)' : 'var(--red)') + '">' + a.tipo.toUpperCase() + ' (' + fmMin(a.ef) + ')</span>'
    + ' <span style="color:var(--tx3);font-size:10px">σ=' + a.z + '</span></div>'
  ).join('') + sinMarca.map(r =>
    '<div style="margin-bottom:8px;padding:8px 10px;background:var(--sur3);border-radius:6px;border-left:3px solid var(--tx3)">'
    + '<span style="color:var(--tx)">' + fmDate(r.fecha) + '</span> — <span style="color:var(--tx2)">SIN MARCACIÓN</span></div>'
  ).join('');
}

export function renderIA() {
  iaPrediccion();
  iaAnomalias();
}

window.saveKey = function() {
  const provider = document.getElementById('iaProvider')?.value || 'claude';
  const ckey = document.getElementById('claudeKey')?.value.trim();
  const gkey = document.getElementById('geminiKey')?.value.trim();
  saveIAProvider(provider);
  if (ckey) saveClaudeKey(ckey);
  if (gkey) saveGeminiKey(gkey);
  const msg = document.getElementById('keyMsg');
  if (msg) { msg.textContent = '✓ Configuración guardada'; msg.style.color = 'var(--green)'; msg.style.display = ''; setTimeout(() => msg.style.display = 'none', 2500); }
};

window.renderIA = renderIA;