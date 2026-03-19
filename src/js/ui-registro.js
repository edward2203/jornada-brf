import { calcJ, fmMin, todayStr, fmDate } from './jornada.js';
import { getRegistros, saveRegistros, getCfg } from './storage.js';

export function saveReg(forzar = false) {
  const fecha = document.getElementById('rFecha')?.value;
  const e     = document.getElementById('rE')?.value;
  const s     = document.getElementById('rS')?.value;
  const nota  = document.getElementById('rNota')?.value || '';
  const eid   = document.getElementById('editId')?.value || '';
  if (!fecha || !e) { alert('Completá fecha y entrada.'); return; }
  const r = s ? calcJ(e, s) : null;
  const reg = { id: eid || Date.now().toString(), fecha, entrada: e, salida: s || '', nota,
    tot: r?.tot||0, desc: s?60:0, ef: r?.ef||0, delta: r?.delta||0 };
  let data = getRegistros();
  if (eid) {
    data = data.map(x => x.id === eid ? reg : x);
  } else {
    const existe = data.find(x => x.fecha === fecha);
    if (existe && !forzar) {
      const m = document.getElementById('replaceModal');
      if (m) {
        m.style.display = 'flex';
        document.getElementById('replaceFecha').textContent = fmDate(fecha);
        document.getElementById('replaceOld').textContent = (existe.entrada||'--') + ' → ' + (existe.salida||'--');
        document.getElementById('replaceNew').textContent = e + ' → ' + (s || 'pendiente');
      }
      return;
    }
    data = data.filter(x => x.fecha !== fecha);
    data.push(reg);
  }
  data.sort((a, b) => a.fecha > b.fecha ? 1 : -1);
  saveRegistros(data);
  window._clearReg?.();
  window._renderAll?.();
  window._nav?.('dashboard');
}

export function clearReg() {
  const s = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
  s('rFecha', todayStr()); s('rE', ''); s('rS', ''); s('rNota', ''); s('editId', '');
  const p = document.getElementById('regPrev'); if (p) p.style.display = 'none';
  const a = document.getElementById('regAlerts'); if (a) a.innerHTML = '';
}

export function editReg(id) {
  const r = getRegistros().find(x => x.id === id); if (!r) return;
  const s = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
  s('rFecha', r.fecha); s('rE', r.entrada); s('rS', r.salida); s('rNota', r.nota); s('editId', r.id);
  window._nav?.('registro');
}

export function delReg(id) {
  window._pendingDeleteId = id;
  const m = document.getElementById('deleteModal'); if (m) m.style.display = 'flex';
}

window.saveReg  = saveReg;
window.clearReg = clearReg;
window.editReg  = editReg;
window.delReg   = delReg;