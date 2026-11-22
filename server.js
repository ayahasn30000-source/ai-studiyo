const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const port=Number(process.env.PORT||3000);
const accessPassword=process.env.APP_ACCESS_PASSWORD||'';
const adminPassword=process.env.APP_ADMIN_PASSWORD||'';
const cookieName='aistudio_access',adminCookieName='aistudio_admin',adminPath='/aistudio-yonetim-8b6f2d';
const token=(secret,label)=>crypto.createHmac('sha256',secret).update(label).digest('hex');
const accessToken=()=>token(accessPassword,'aistudio-auth-v1'),adminToken=()=>token(adminPassword,'aistudio-admin-v1');
const cookies=req=>Object.fromEntries((req.headers.cookie||'').split(';').map(x=>x.trim().split('=').map(decodeURIComponent)).filter(x=>x.length===2));
const validCookie=(req,name,value)=>{const got=cookies(req)[name]||'';return value&&got.length===64&&crypto.timingSafeEqual(Buffer.from(got),Buffer.from(value()));};
const isAuthed=req=>!!accessPassword&&validCookie(req,cookieName,accessToken);
const isAdmin=req=>!!adminPassword&&validCookie(req,adminCookieName,adminToken);
const json=(res,status,data,headers={})=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8',...headers});res.end(JSON.stringify(data));};
async function readBody(req){let raw='';for await(const chunk of req)raw+=chunk;try{return JSON.parse(raw||'{}')}catch{return {}}}
async function ai(body){
  const messages=Array.isArray(body.messages)?body.messages:[];
  const r=await fetch(`${process.env.MANUS_API_URL}/v1/chat/completions`,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${process.env.MANUS_API_KEY}`},body:JSON.stringify({messages})});
  const data=await r.json().catch(()=>({}));
  if(!r.ok||data.error) throw new Error(data.error?.message||'AI servisi hata verdi.');
  const text=data.choices?.[0]?.message?.content||'';
  if(body.json){let value;try{value=JSON.parse(text.replace(/^```json\s*|\s*```$/g,''));}catch{throw new Error('AI geçerli JSON döndürmedi.')}return {text,value};}
  return {text};
}
function parseJsonText(text){return JSON.parse(String(text||'').replace(/^```(?:json)?\s*|\s*```$/gi,''))}
const externalProviders={
  openai:{label:'ChatGPT / OpenAI',key:'OPENAI_API_KEY'},
  anthropic:{label:'Claude / Anthropic',key:'ANTHROPIC_API_KEY'},
  gemini:{label:'Gemini / Google',key:'GEMINI_API_KEY'}
};
function providerStatus(){return Object.fromEntries(Object.entries(externalProviders).map(([id,p])=>[id,{id,label:p.label,status:process.env[p.key]?'READY':'INACTIVE'}]))}
function cleanMessages(messages){return (Array.isArray(messages)?messages:[]).slice(-16).map(m=>({role:m.role==='assistant'?'assistant':'user',content:String(m.content||'').slice(0,16000)})).filter(m=>m.content)}
async function callProvider(id,messages){
  const p=externalProviders[id],key=p&&process.env[p.key];if(!p)return {id,status:'INACTIVE',error:'Bilinmeyen sağlayıcı.'};if(!key)return {id,label:p.label,status:'INACTIVE',error:'API anahtarı tanımlı değil.'};
  try{
    let r,data,text;
    if(id==='openai'){
      r=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${key}`},body:JSON.stringify({model:'gpt-4o-mini',messages,temperature:.35})});data=await r.json().catch(()=>({}));text=data.choices?.[0]?.message?.content||'';
    }else if(id==='anthropic'){
      const system=messages.filter(m=>m.role==='system').map(m=>m.content).join('\n');const content=messages.filter(m=>m.role!=='system').map(m=>({role:m.role==='assistant'?'assistant':'user',content:m.content}));
      r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':key,'anthropic-version':'2026-10-21'},body:JSON.stringify({model:'claude-haiku-5-5',max_tokens:1800,system, messages:content})});data=await r.json().catch(()=>({}));text=data.content?.map(x=>x.text||'').join('')||'';
    }else{
      const contents=messages.filter(m=>m.role!=='system').map(m=>({role:m.role==='assistant'?'model':'user',parts:[{text:m.content}]}));
      r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${encodeURIComponent(key)}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents,generationConfig:{temperature:.35,maxOutputTokens:1800}})});data=await r.json().catch(()=>({}));text=data.candidates?.[0]?.content?.parts?.map(x=>x.text||'').join('')||'';
    }
    if(!r.ok||data.error||!text)throw new Error(data.error?.message||'Sağlayıcı yanıt vermedi.');return{id,label:p.label,status:'ACTIVE',text};
  }catch(e){return{id,label:p.label,status:'INACTIVE',error:String(e.message||'Bağlantı hatası').slice(0,220)}}
}
async function multiAi(body){const message=String(body.message||'').trim().slice(0,16000);if(!message)throw new Error('Mesaj boş olamaz.');const selected=(Array.isArray(body.providers)?body.providers:['openai','anthropic','gemini']).filter(id=>externalProviders[id]);const messages=[{role:'user',content:`Türkçe yanıt ver. Kullanıcı isteği:\n${message}`}];const results=await Promise.all(selected.map(id=>callProvider(id,messages)));return{results,available:providerStatus()}}
async function collaborativeAi(body){
  const messages=cleanMessages(body.messages);if(!messages.length)throw new Error('Mesaj boş olamaz.');
  const drafts=[];let manusError='';
  const [manusResult,externalResults]=await Promise.all([
    ai({...body,messages}).catch(e=>{manusError=String(e.message||'Manus yanıt vermedi.');return null}),
    Promise.all(Object.keys(externalProviders).map(id=>callProvider(id,messages)))
  ]);
  if(manusResult?.text)drafts.push({id:'manus',label:'Manus',status:'ACTIVE',text:manusResult.text});
  else drafts.push({id:'manus',label:'Manus',status:'INACTIVE',error:manusError||'Yanıt alınamadı.'});
  externalResults.forEach(r=>{if(r.status==='ACTIVE'&&r.text)drafts.push(r);});
  if(!drafts.some(d=>d.status==='ACTIVE'))throw new Error('Hiçbir yapay zekâ yanıt veremedi.');
  const dossier=drafts.filter(d=>d.status==='ACTIVE').map(d=>`### ${d.label}\n${d.text.slice(0,7000)}`).join('\n\n');
  const synthesis=[
    {role:'system',content:`Sen dört yapay zekânın ortak cevap editörüsün. Manus, ChatGPT/OpenAI, Claude ve Gemini taslaklarını karşılaştır. Çelişkileri fark et, hatalı veya uydurma bilgiyi ayıkla, ortak güçlü noktaları birleştir ve kullanıcıya Türkçe, tek ve uygulanabilir bir cevap ver. Kullanıcı araştırma istiyorsa kaynak uydurma; taslaklarda doğrulanmamış bilgi varsa bunu açıkça belirt. Sağlayıcıların adlarını ve taslak sürecini kullanıcıya anlatma. ${body.json?'Yalnızca geçerli JSON döndür; Markdown kod çiti kullanma.':'Yalnızca kullanıcıya teslim edilecek nihai ortak cevabı döndür.'}`},
    {role:'user',content:`KULLANICI İSTEĞİ VE KONUŞMA:\n${messages.map(m=>`${m.role}: ${m.content}`).join('\n').slice(-12000)}\n\nMODEL TASLAKLARI:\n${dossier}`}
  ];
  let final=null,synthesisError='';
  try{final=await ai({messages:synthesis,json:body.json});}catch(e){synthesisError=String(e.message||'Ortak cevap oluşturulamadı.');}
  if(!final){
    const fallback=externalResults.find(r=>r.status==='ACTIVE'&&r.text);
    if(fallback){
      const r=await callProvider(fallback.id,synthesis);
      if(r.status==='ACTIVE'&&r.text)final={text:r.text};
    }
  }
  if(!final)throw new Error(synthesisError||'Ortak cevap oluşturulamadı.');
  if(body.json){try{final.value=final.value??parseJsonText(final.text)}catch{throw new Error('Ortak yapay zekâlar geçerli JSON üretemedi.')}}
  return{...final,collaboration:{mode:' ortak cevap',providers:drafts.map(({id,label,status,error})=>({id,label,status,error}))}};
}
const settingsPath=path.join(__dirname,'admin-settings.json');
let siteSettings={announcement:'',modules:{prompt:true,chat:true,sheet:true,lab:true,generator:true,multi:true}};
try{const saved=JSON.parse(fs.readFileSync(settingsPath,'utf8'));siteSettings={...siteSettings,...saved,modules:{...siteSettings.modules,...(saved.modules&&typeof saved.modules==='object'?saved.modules:{})}};}catch{}
function publicSettings(){return {announcement:String(siteSettings.announcement||'').slice(0,500),modules:{...siteSettings.modules}}}
function adminCookie(value,maxAge=2592000){return `${adminCookieName}=${value}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=${maxAge}`}
const server=http.createServer(async(req,res)=>{
  res.setHeader('Access-Control-Allow-Origin','*');
  if(req.method==='GET'&&req.url==='/api/session')return json(res,200,{authenticated:isAuthed(req)});
  if(req.method==='POST'&&req.url==='/api/login'){
    const body=await readBody(req);
    if(!accessPassword||typeof body.password!=='string'||body.password.trim()!==accessPassword.trim())return json(res,401,{error:'Şifre yanlış.'});
    return json(res,200,{authenticated:true},{'Set-Cookie':`${cookieName}=${accessToken()}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=2592000`});
  }
  if(req.method==='POST'&&req.url==='/api/logout')return json(res,200,{ok:true},{'Set-Cookie':`${cookieName}=; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=0`});
  if(req.method==='GET'&&req.url==='/api/site-settings')return json(res,200,publicSettings());
  if(req.method==='GET'&&req.url==='/api/admin/session')return json(res,200,{authenticated:isAdmin(req)});
  if(req.method==='POST'&&req.url==='/api/admin/login'){
    const body=await readBody(req);
    if(!adminPassword||typeof body.password!=='string'||body.password.trim()!==adminPassword.trim())return json(res,401,{error:'Yönetici parolası yanlış.'});
    return json(res,200,{authenticated:true},{'Set-Cookie':adminCookie(adminToken())});
  }
  if(req.method==='POST'&&req.url==='/api/admin/logout')return json(res,200,{ok:true},{'Set-Cookie':adminCookie('',0)});
  if(req.method==='GET'&&req.url==='/api/admin/settings')return isAdmin(req)?json(res,200,siteSettings):json(res,401,{error:'Yönetici girişi gerekli.'});
  if(req.method==='POST'&&req.url==='/api/admin/settings'){
    if(!isAdmin(req))return json(res,401,{error:'Yönetici girişi gerekli.'});
    const body=await readBody(req),mods=body.modules&&typeof body.modules==='object'?body.modules:{};
    siteSettings={announcement:typeof body.announcement==='string'?body.announcement.slice(0,500):siteSettings.announcement,modules:{...siteSettings.modules,...Object.fromEntries(Object.keys(siteSettings.modules).map(k=>[k,mods[k]!==false]))}};
    try{fs.writeFileSync(settingsPath,JSON.stringify(siteSettings,null,2));}catch{}
    return json(res,200,{ok:true,settings:publicSettings()});
  }
  if(req.method==='GET'&&req.url==='/api/multi-ai/status')return isAuthed(req)?json(res,200,{providers:providerStatus()}):json(res,401,{error:'Önce uygulama şifresiyle giriş yapın.'});
  if(req.method==='POST'&&req.url==='/api/multi-ai'){
    if(!isAuthed(req))return json(res,401,{error:'Önce uygulama şifresiyle giriş yapın.'});
    try{return json(res,200,await multiAi(await readBody(req)))}catch(e){return json(res,400,{error:e.message});}
  }
  if(req.method==='POST'&&req.url==='/api/ai'){
    if(!isAuthed(req))return json(res,401,{error:'Önce uygulama şifresiyle giriş yapın.'});
    try{return json(res,200,await collaborativeAi(await readBody(req)))}catch(e){return json(res,500,{error:e.message});}
  }
  const requested=req.url.split('?')[0];let file=requested===adminPath?'/admin.html':(requested==='/'?'/index.html':requested);file=path.join(__dirname,'public',path.normalize(file));
  if(!file.startsWith(path.join(__dirname,'public'))){res.writeHead(403);return res.end('Forbidden');}
  fs.readFile(file,(e,d)=>{if(e&&!path.extname(requested)){file=path.join(__dirname,'public','index.html');fs.readFile(file,(fallbackErr,fallbackData)=>{if(fallbackErr){res.writeHead(404);return res.end('Not found');}res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(fallbackData)});return}if(e){res.writeHead(404);return res.end('Not found');}const ext=path.extname(file);const type={'.html':'text/html; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css','.js':'text/javascript'}[ext]||'application/octet-stream';res.writeHead(200,{'Content-Type':type});res.end(d);});
});
server.listen(port,'0.0.0.0',()=>console.log(`AI Studio Atölyesi listening on ${port}`));
