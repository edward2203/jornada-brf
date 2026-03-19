const CFG_DEF={jornada:7.333,maxExtra:2,interJornada:11,periodoDia:16,
  entradaHora:14,entradaMin:0,salidaHora:22,salidaMin:20,
  sabSalidaHora:21,sabSalidaMin:30,usaTaxi:true,usaBus:true,
  busVueltaHora:22,busVueltaMin:0};
const SAL_DEF={tipo:"horista",valorHora:0,extra1:50,extra2:100,noturno:20,hMes:220,
  insalub:0,trocaUnif:0,contribAssist:0,segVida:0,odonto:0,cesta:0,
  refeicoes:0,lanche:0,loja:0,outrosDesc:0};
let _cache=[],_user=null,_db=null,_fbOK=false;
export function initStorage(db,ok){_db=db;_fbOK=ok;}
export function setCurrentUser(u){_user=u;}
export function lsKey(){return _user?"j_regs_"+_user.uid:"j_regs";}
export function cfgKey(){return _user?"j_cfg_"+_user.uid:"j_cfg";}
export function getRegistros(){return[..._cache];}
export function saveRegistros(arr){
  _cache=[...arr];
  localStorage.setItem(lsKey(),JSON.stringify(arr));
  if(_user&&_fbOK&&_db) _db.collection("usuarios").doc(_user.uid).collection("data").doc("registros")
    .set({items:arr,updatedAt:firebase.firestore.FieldValue.serverTimestamp()}).catch(console.error);
}
export function loadRegistros(uid){
  return new Promise(resolve=>{
    if(!_fbOK||!_db){const l=_loadLocal();_cache=l;resolve(l);return;}
    _db.collection("usuarios").doc(uid).collection("data").doc("registros").get()
      .then(doc=>{
        if(doc.exists&&doc.data().items?.length>0){
          _cache=doc.data().items;localStorage.setItem(lsKey(),JSON.stringify(_cache));resolve(_cache);
        } else {const l=_loadLocal();_cache=l;if(l.length)saveRegistros(l);resolve(l);}
      }).catch(()=>{const l=_loadLocal();_cache=l;resolve(l);});
  });
}
function _loadLocal(){try{return JSON.parse(localStorage.getItem(lsKey())||"[]");}catch{return[];}}
export function getCfg(){try{return Object.assign({},CFG_DEF,JSON.parse(localStorage.getItem(cfgKey())||"{}"));}catch{return{...CFG_DEF};}}
export function saveCfg(p){localStorage.setItem(cfgKey(),JSON.stringify(Object.assign(getCfg(),p)));}
export function getCfgSal(){try{return Object.assign({},SAL_DEF,JSON.parse(localStorage.getItem(cfgKey()+"_sal")||"{}"));}catch{return{...SAL_DEF};}}
export function saveCfgSal(p){localStorage.setItem(cfgKey()+"_sal",JSON.stringify(Object.assign(getCfgSal(),p)));}
export const getTheme=()=>localStorage.getItem("app_theme")||"dark";
export const saveTheme=t=>localStorage.setItem("app_theme",t);
export const getFontSizeIdx=()=>parseInt(localStorage.getItem("font_size_idx")||"1");
export const saveFontSizeIdx=i=>localStorage.setItem("font_size_idx",String(i));
export const getSabadoTipo=()=>localStorage.getItem("sabado_tipo")||"abate";
export const saveSabadoTipo=t=>localStorage.setItem("sabado_tipo",t);
export const getIAProvider=()=>localStorage.getItem("ia_provider")||"claude";
export const saveIAProvider=p=>localStorage.setItem("ia_provider",p);
export const getClaudeKey=()=>localStorage.getItem("brf_key")||"";
export const saveClaudeKey=k=>localStorage.setItem("brf_key",k);
export const getGeminiKey=()=>localStorage.getItem("gemini_key")||"";
export const saveGeminiKey=k=>localStorage.setItem("gemini_key",k);
export const isWizardDone=uid=>!!localStorage.getItem("wizard_done_"+uid);
export const markWizardDone=uid=>localStorage.setItem("wizard_done_"+uid,"1");
