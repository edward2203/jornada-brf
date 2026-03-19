import {getIAProvider,getClaudeKey,getGeminiKey} from "./storage.js";
const GM="gemini-1.5-flash",CM="claude-sonnet-4-20250514";
export async function callIA(p){return getIAProvider()==="gemini"?_gem(p):_cla(p);}
export async function callIAWithImage(p,b64,mime="image/jpeg"){return getIAProvider()==="gemini"?_gemImg(p,b64,mime):_claImg(p,b64,mime);}
async function _cla(p){
  const k=getClaudeKey();if(!k)throw new Error("Guardá tu API Key de Claude");
  const r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",
    headers:{"Content-Type":"application/json","x-api-key":k,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
    body:JSON.stringify({model:CM,max_tokens:1000,messages:[{role:"user",content:p}]})});
  const d=await r.json();if(d.error)throw new Error(d.error.message);return d.content[0].text;
}
async function _claImg(p,b64,mime){
  const k=getClaudeKey();if(!k)throw new Error("Guardá tu API Key de Claude");
  const r=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",
    headers:{"Content-Type":"application/json","x-api-key":k,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
    body:JSON.stringify({model:CM,max_tokens:4000,messages:[{role:"user",content:[
      {type:"image",source:{type:"base64",media_type:mime,data:b64}},{type:"text",text:p}]}]})});
  const d=await r.json();if(d.error)throw new Error(d.error.message);return d.content.map(b=>b.text||"").join("");
}
async function _gem(p){
  const k=getGeminiKey();if(!k)throw new Error("Guardá tu API Key de Gemini");
  const r=await fetch(`https://generativelanguage.googleapis.com/v1/models/${GM}:generateContent?key=${k}`,
    {method:"POST",headers:{"Content-Type":"application/json"},
     body:JSON.stringify({contents:[{parts:[{text:p}]}],generationConfig:{maxOutputTokens:1000}})});
  const d=await r.json();if(d.error)throw new Error(d.error.message);return d.candidates[0].content.parts[0].text;
}
async function _gemImg(p,b64,mime){
  const k=getGeminiKey();if(!k)throw new Error("Guardá tu API Key de Gemini");
  const r=await fetch(`https://generativelanguage.googleapis.com/v1/models/${GM}:generateContent?key=${k}`,
    {method:"POST",headers:{"Content-Type":"application/json"},
     body:JSON.stringify({contents:[{parts:[{inline_data:{mime_type:mime,data:b64}},{text:p}]}],generationConfig:{maxOutputTokens:4000}})});
  const d=await r.json();if(d.error)throw new Error(d.error.message);return d.candidates[0].content.parts[0].text;
}
export function parseJSONResponse(t){return JSON.parse(t.replace(/\`\`\`json|\`\`\`/g,"").trim());}
export function fileToBase64(f){return new Promise((res,rej)=>{const r=new FileReader();r.onload=e=>res(e.target.result.split(",")[1]);r.onerror=rej;r.readAsDataURL(f);});}
