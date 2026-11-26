import { Readable } from 'node:stream'
export default async function handler(req, res) {
 res.setHeader('Access-Control-Allow-Origin','https://fravier3.github.io')
 res.setHeader('Access-Control-Expose-Headers','Content-Length, Content-Range, Accept-Ranges')
 if(req.method==='OPTIONS'){res.setHeader('Access-Control-Allow-Headers','Range');return res.status(204).end()}
 if(req.method!=='GET')return res.status(405).end()
 const id=String(req.query.id||'')
 if(!/^[\w-]{11}$/.test(id))return res.status(400).json({error:'Identificador inválido'})
 try{
  const endpoint='https://yt.chocolatemoo53.com'
  const response=await fetch(endpoint+'/api/v1/videos/'+id+'?local=true',{signal:AbortSignal.timeout(12000)})
  if(!response.ok)throw Error('Invidious respondió '+response.status)
  const data=await response.json()
  const format=(data.adaptiveFormats||[]).filter(f=>(f.type||'').startsWith('audio/mp4')).sort((a,b)=>Number(b.bitrate)-Number(a.bitrate))[0]
  if(!format?.url)throw Error('No hay audio AAC')
  const url=new URL(format.url,endpoint)
  if(url.protocol!=='https:' || !(url.hostname.endsWith('.googlevideo.com') || url.hostname==='yt.chocolatemoo53.com'))throw Error('Enlace inválido')
  const upstream=await fetch(url,{headers:{Range:req.headers.range||'bytes=0-'},signal:AbortSignal.timeout(60000)})
  if(!upstream.ok)throw Error('El audio respondió '+upstream.status)
  if(!upstream.headers.get('content-type')?.startsWith('audio/'))throw Error('La fuente no devolvió audio')
  res.status(upstream.status)
  for(const name of ['content-type','content-range','content-length','accept-ranges']){const v=upstream.headers.get(name);if(v)res.setHeader(name,v)}
  res.setHeader('Cache-Control','no-store')
  const stream=Readable.fromWeb(upstream.body)
  req.on('aborted',()=>stream.destroy())
  stream.on('error',()=>res.destroy())
  stream.pipe(res)
 }catch(e){console.error('Invidious audio',e.message);if(!res.headersSent)res.status(502).json({error:'La fuente de audio de Yutu no está disponible. Intenta más tarde.'})}
}
