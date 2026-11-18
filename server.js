const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const port=Number(process.env.PORT||3000);
const accessPassword=process.env.APP_ACCESS_PASSWORD||'';
const cookieName='aistudio_access';
const token=()=>crypto.createHmac('sha256',accessPassword).update('aistudio-auth-v1').digest('hex');
const cookies=req=>Object.fromEntries((req.headers.cookie||'').split(';').map(x=>x.trim().split('=').map(decodeURIComponent)).filter(x=>x.length===2));
const isAuthed=req=>{if(!accessPassword)return false;const got=cookies(req)[cookieName]||'';return got.length===64&&crypto.timingSafeEqual(Buffer.from(got),Buffer.from(token()));};
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
const server=http.createServer(async(req,res)=>{
  res.setHeader('Access-Control-Allow-Origin','*');
  if(req.method==='GET'&&req.url==='/api/session'){return json(res,200,{authenticated:isAuthed(req)});}
  if(req.method==='POST'&&req.url==='/api/login'){
    const body=await readBody(req);
    if(!accessPassword||typeof body.password!=='string'||body.password.trim()!==accessPassword.trim())return json(res,401,{error:'Şifre yanlış.'});
    return json(res,200,{authenticated:true},{'Set-Cookie':`${cookieName}=${token()}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`});
  }
  if(req.method==='POST'&&req.url==='/api/logout')return json(res,200,{ok:true},{'Set-Cookie':`${cookieName}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`});
  if(req.method==='POST'&&req.url==='/api/ai'){
    if(!isAuthed(req))return json(res,401,{error:'Önce uygulama şifresiyle giriş yapın.'});
    try{return json(res,200,await ai(await readBody(req)))}catch(e){return json(res,500,{error:e.message});}
  }
  const requested=req.url.split('?')[0];let file=requested==='/'?'/index.html':requested;file=path.join(__dirname,'public',path.normalize(file));
  if(!file.startsWith(path.join(__dirname,'public'))){res.writeHead(403);return res.end('Forbidden');}
  fs.readFile(file,(e,d)=>{if(e&&!path.extname(requested)){file=path.join(__dirname,'public','index.html');fs.readFile(file,(fallbackErr,fallbackData)=>{if(fallbackErr){res.writeHead(404);return res.end('Not found');}res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(fallbackData)});return}if(e){res.writeHead(404);return res.end('Not found');}const ext=path.extname(file);const type={'.html':'text/html; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css','.js':'text/javascript'}[ext]||'application/octet-stream';res.writeHead(200,{'Content-Type':type});res.end(d);});
});
server.listen(port,'0.0.0.0',()=>console.log(`AI Studio Atölyesi listening on ${port}`));
