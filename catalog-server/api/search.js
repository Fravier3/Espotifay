import { Innertube } from 'youtubei.js'
let client
export default async function handler(req, res) {
 res.setHeader('Access-Control-Allow-Origin','https://fravier3.github.io')
 res.setHeader('Access-Control-Allow-Methods','GET, OPTIONS')
 if(req.method==='OPTIONS') return res.status(204).end()
 if(req.method!=='GET') return res.status(405).json({error:'Método no permitido'})
 const q=String(req.query.q||'música latina éxitos').trim().slice(0,160)
 if(!q) return res.status(400).json({error:'Escribe una canción o artista'})
 try {
  client ||= Innertube.create({retrieve_player:false,lang:'es',location:'US'})
  const tube=await client
  const result=await tube.music.search(q,{type:'song'})
  const songs=(result.contents || []).flatMap(shelf => shelf.contents || [])
  const tracks=songs.filter(s=>/^[\w-]{11}$/.test(s.id||'')).map(s=>({
    id:s.id,source:'youtube',title:String(s.title||''),
    artist:s.artists?.map(a=>a.name).join(', ') || String(s.author?.name||''),
    image:s.thumbnail?.contents?.at(-1)?.url || s.thumbnails?.at(-1)?.url || '',
    duration:s.duration?.seconds||0
  }))
  res.setHeader('Cache-Control','public, s-maxage=300, stale-while-revalidate=600')
  res.json({tracks})
 }catch(e){client=undefined;console.error('Music catalog',e.message);res.status(502).json({error:'YouTube Music no respondió. Intenta nuevamente.'})}
}
