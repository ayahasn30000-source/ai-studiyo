const http=require('http'),fs=require('fs'),path=require('path');
const port=Number(process.env.PORT||3000);
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
  if(req.method==='POST'&&req.url==='/api/ai'){
    let raw='';req.on('data',c=>raw+=c);req.on('end',async()=>{try{const out=await ai(JSON.parse(raw||'{}'));res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(out));}catch(e){res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.message}));}});return;
  }
  let file=req.url==='/'?'/index.html':req.url.split('?')[0];file=path.join(__dirname,'public',path.normalize(file));
  if(!file.startsWith(path.join(__dirname,'public'))){res.writeHead(403);return res.end('Forbidden');}
  fs.readFile(file,(e,d)=>{if(e){res.writeHead(404);return res.end('Not found');}const ext=path.extname(file);const type={'.html':'text/html; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css','.js':'text/javascript'}[ext]||'application/octet-stream';res.writeHead(200,{'Content-Type':type});res.end(d);});
});
server.listen(port,'0.0.0.0',()=>console.log(`AI Studio Atölyesi listening on ${port}`));
