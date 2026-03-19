import { JORNADA_MIN } from "./jornada.js";
export const MAX_EF = 720;
export function fmBRL(v) {
  if (isNaN(v) || v === null) return "R$ --";
  return "R$ " + v.toFixed(2).replace(".", ",");
}
const FAIXAS = [{ate:1518,aliq:.075},{ate:2793.88,aliq:.09},{ate:4190.83,aliq:.12},{ate:8157.41,aliq:.14}];
export function calcINSS(base) {
  let inss=0,ant=0;
  for(const f of FAIXAS){if(base<=ant)break;inss+=(Math.min(base,f.ate)-ant)*f.aliq;ant=f.ate;if(base<=f.ate)break;}
  return Math.min(inss,8157.41*.14);
}
export function calcularSalario(registros,c) {
  const vh=c.valorHora||0; if(!vh) return null;
  const data=registros.filter(r=>r.ef>0&&r.ef<=MAX_EF);
  const corrompidos=registros.filter(r=>r.ef>MAX_EF);
  let minNorm=0,minExtra=0;
  data.forEach(r=>{minNorm+=Math.min(r.ef,JORNADA_MIN);minExtra+=Math.max(0,r.ef-JORNADA_MIN);});
  const hNorm=minNorm/60,hExtra=minExtra/60,diasReg=data.length,diasDSR=Math.floor(diasReg/6);
  const vHExtra=vh*(1+c.extra1/100),vHExtra2=vh*(1+c.extra2/100),vHNot=vh*(1+c.noturno/100);
  const vHorasNorm=c.tipo==="horista"?hNorm*vh:c.valorHora;
  const vExtras=hExtra*vHExtra,vInsalub=c.insalub||0,vTroca=(c.trocaUnif||0)*vHExtra;
  const vDSR=c.tipo==="horista"&&diasReg>0?(hNorm/diasReg)*diasDSR*vh:0;
  const totalBruto=vHorasNorm+vExtras+vInsalub+vTroca+vDSR;
  const vINSS=calcINSS(totalBruto);
  const vFixos=(c.contribAssist||0)+(c.segVida||0)+(c.odonto||0)+(c.cesta||0);
  const vVariav=(c.refeicoes||0)+(c.lanche||0)+(c.loja||0)+(c.outrosDesc||0);
  const totalDesc=vINSS+vFixos+vVariav,liquido=totalBruto-totalDesc;
  return {minNorm,minExtra,hNorm,hExtra,diasReg,diasDSR,vh,vHExtra,vHExtra2,vHNot,
    vHorasNorm,vExtras,vInsalub,vTroca,vDSR,totalBruto,vINSS,vFixos,vVariav,totalDesc,
    liquido,fgts:totalBruto*.08,corrompidos,config:c};
}
export function calcularProyeccion(r,diasCal) {
  const diasLab=Math.round(diasCal*6/7);
  const vPorDia=r.diasReg>=5?r.liquido/r.diasReg:(JORNADA_MIN/60)*r.vh*(1-(r.totalDesc/Math.max(r.totalBruto,1)));
  return {proyLiq:r.liquido+vPorDia*diasLab,diasLabRest:diasLab,vPorDia,metodo:r.diasReg>=5?"Promedio real":"Estimativa"};
}
