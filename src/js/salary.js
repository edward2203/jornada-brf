import { JORNADA_MIN } from "./jornada.js";

/**
 * salary.js — AGENTE BANK (Finanzas BRF)
 * Pipeline: Recibe el análisis de JORNADA y aplica el impacto financiero.
 */

export const MAX_EF = 720;

export const fmBRL = (v) => {
  if (isNaN(v) || v === null) return "R$ --";
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
};

const FAIXAS_INSS = [
  { ate: 1518.00, aliq: 0.075 },
  { ate: 2793.88, aliq: 0.09 },
  { ate: 4190.83, aliq: 0.12 },
  { ate: 8157.41, aliq: 0.14 }
];

// AGENTE FISCAL: Calcula deducciones legales
export function agenteFiscalINSS(base) {
  let inss = 0, ant = 0;
  for (const f of FAIXAS_INSS) {
    if (base <= ant) break;
    inss += (Math.min(base, f.ate) - ant) * f.aliq;
    ant = f.ate;
    if (base <= f.ate) break;
  }
  return Math.min(inss, 1142.04); // Techo aproximado 2026
}

// AGENTE BANK: El orquestador financiero del Pipeline
export function calcularSalario(registros, config) {
  const vh = config.valorHora || 0;
  if (!vh) return null;

  // Filtro de datos para el pipeline
  const validos = registros.filter(r => r.ef > 0 && r.ef <= MAX_EF);
  const corrompidos = registros.filter(r => r.ef > MAX_EF);

  // Acumuladores del Pipeline
  let minNorm = 0, minExtra = 0;
  
  validos.forEach(r => {
    // Aquí el agente usa la JORNADA_MIN que definimos en el equipo anterior
    minNorm += Math.min(r.ef, JORNADA_MIN);
    minExtra += Math.max(0, r.ef - JORNADA_MIN);
  });

  const hNorm = minNorm / 60;
  const hExtra = minExtra / 60;
  const diasReg = validos.length;
  const diasDSR = Math.floor(diasReg / 6);

  // Factores de Multiplicación (Configuración del Agente)
  const vHExtra = vh * (1 + (config.extra1 || 50) / 100);
  const vInsalub = config.insalub || 0;
  const vTroca = (config.trocaUnif || 0) * vHExtra;
  
  // Cálculo de Brutos
  const vHorasNorm = config.tipo === "horista" ? hNorm * vh : config.valorHora;
  const vExtras = hExtra * vHExtra;
  const vDSR = config.tipo === "horista" && diasReg > 0 ? (hNorm / diasReg) * diasDSR * vh : 0;
  
  const totalBruto = vHorasNorm + vExtras + vInsalub + vTroca + vDSR;

  // El Agente BANK llama al Agente FISCAL
  const vINSS = agenteFiscalINSS(totalBruto);

  // Deducciones del sistema BRF (Cesta, Seguros, etc.)
  const vDescuentosFijos = (config.contribAssist || 0) + (config.segVida || 0) + (config.odonto || 0) + (config.cesta || 0);
  const vDescuentosVar = (config.refeicoes || 0) + (config.lanche || 0) + (config.loja || 0) + (config.outrosDesc || 0);
  
  const totalDesc = vINSS + vDescuentosFijos + vDescuentosVar;
  const liquido = totalBruto - totalDesc;

  // VERDICTO FINAL DEL EQUIPO
  return {
    minNorm, minExtra, hNorm, hExtra, diasReg,
    totalBruto, liquido, 
    vINSS, totalDesc,
    fgts: totalBruto * 0.08,
    corrompidos,
    resumenFinanciero: `Líquido estimado: ${fmBRL(liquido)} (Bruto: ${fmBRL(totalBruto)})`
  };
}

// AGENTE PREDICTOR: Proyecta el futuro basado en el momentum actual
export function calcularProyeccion(r, diasRestantes) {
  const diasLabRestantes = Math.round(diasRestantes * 6 / 7);
  const valorPorDia = r.diasReg >= 5 
    ? r.liquido / r.diasReg 
    : (JORNADA_MIN / 60) * (r.totalBruto / Math.max(r.hNorm, 1));

  return {
    proyLiq: r.liquido + (valorPorDia * diasLabRestantes),
    diasLabRest: diasLabRestantes,
    metodo: r.diasReg >= 5 ? "Pipeline Real (Promedio)" : "Estimativa Base"
  };
}