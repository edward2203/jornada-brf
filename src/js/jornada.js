/**
 * jornada.js — Equipo de Agentes de Lógica BRF
 * Pipeline Secuencial y Acumulativo
 */

export const JORNADA_MIN = 480; // Ajustado a 8h estándar, cámbialo si es 7:20h (440)
export const FIXED_BREAK = 60;

// --- UTILIDADES (Herramientas de los Agentes) ---
export const toMin = (t) => {
  if (!t) return null;
  const [h, m] = t.split(':');
  return parseInt(h) * 60 + parseInt(m);
};

export const fmMin = (m) => {
  if (m === null || m === undefined) return '--';
  const neg = m < 0;
  const absM = Math.abs(m);
  return `${neg ? '-' : ''}${Math.floor(absM / 60)}h${String(absM % 60).padStart(2, '0')}`;
};

// --- EL EQUIPO DE AGENTES ---

// 1. SCANNER: Extrae y limpia los datos de entrada
const agenteScanner = (contexto) => {
  const { entrada, salida } = contexto.input;
  const em = toMin(entrada);
  const sm = toMin(salida);
  
  let bruto = 0;
  if (em !== null && sm !== null) {
    bruto = sm - em;
    if (bruto < 0) bruto += 1440; // Manejo de virada de turno
  }
  
  contexto.analisis.scanner = { em, sm, bruto };
  return contexto;
};

// 2. CLT_CHECK: Aplica leyes brasileñas (Descansos)
const agenteCLT = (contexto) => {
  const { bruto } = contexto.analisis.scanner;
  // Regla: Si trabajó más de 6h, el descanso es 60min, sino 15min (ejemplo)
  const descansoEfectivo = bruto > 360 ? FIXED_BREAK : 15;
  const tiempoEfectivo = Math.max(0, bruto - descansoEfectivo);
  
  contexto.analisis.clt = { 
    efectivo: tiempoEfectivo, 
    descanso: descansoEfectivo 
  };
  return contexto;
};

// 3. BRF_RULES: Calcula el Banco de Horas (Delta)
const agenteBRF = (contexto) => {
  const { efectivo } = contexto.analisis.clt;
  const delta = efectivo > 0 ? efectivo - JORNADA_MIN : 0;
  
  contexto.analisis.brf = { 
    delta,
    esExtra: delta > 0,
    esDebito: delta < 0
  };
  return contexto;
};

// 4. MODEL: El veredicto final que unifica todo
export function analizarJornadaAgentes(entrada, salida) {
  // Inicializamos el pipeline
  let contexto = {
    input: { entrada, salida },
    analisis: {}
  };

  // Ejecución del Pipeline Secuencial
  contexto = agenteScanner(contexto);
  contexto = agenteCLT(contexto);
  contexto = agenteBRF(contexto);

  // Retorno del veredicto final enriquecido
  const { scanner, clt, brf } = contexto.analisis;
  
  return {
    tot: scanner.bruto,
    desc: clt.descanso,
    ef: clt.efectivo,
    delta: brf.delta,
    resumen: `Trabajaste ${fmMin(clt.efectivo)}. Saldo: ${fmMin(brf.delta)}`
  };
}

// --- FUNCIONES DE SOPORTE PARA LA UI ---

export function withSaldo(registros) {
  let acum = 0;
  return [...registros]
    .sort((a, b) => a.fecha > b.fecha ? 1 : -1)
    .map(r => {
      const v = analizarJornadaAgentes(r.entrada, r.salida);
      acum += v.delta;
      return { ...r, ...v, _saldo: acum };
    });
}

export function todayStr() { return new Date().toISOString().slice(0, 10); }
export function fmDate(s) {
  if (!s) return '--';
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
}