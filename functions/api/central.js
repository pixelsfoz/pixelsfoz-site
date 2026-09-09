// Edições de apresentação da Central. Não altera current/archive do APP Rifa.
const PREFIX = 'central:card:';
const LIMIT = 800000;
function json(data, status=200) {
  return new Response(JSON.stringify(data), {status, headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}});
}
function database(context) {
  if (!context.env.PIXELS_DB) throw new Error('Banco da Central indisponível.');
  return context.env.PIXELS_DB;
}
function validImage(image) {
  if (image === '') return true;
  if (typeof image !== 'string' || image.length > 700000) return false;
  const match=/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(image);
  if (!match || match[2].length % 4) return false;
  let bytes; try { bytes=atob(match[2]); } catch { return false; }
  if (match[1]==='jpeg') return bytes.startsWith('\xff\xd8\xff');
  if (match[1]==='png') return bytes.startsWith('\x89PNG\r\n\x1a\n');
  return bytes.startsWith('RIFF') && bytes.slice(8,12)==='WEBP';
}
function cleanRecord(input) {
  if (!input || typeof input!=='object') throw new Error('Selecione uma rifa.');
  const record={};
  for(const [field,max] of Object.entries({id:400,title:160,desc:2000,numbers:80,price:80})) {
    if (typeof input[field]!=='string' || input[field].length>max) throw new Error('Campo inválido: '+field);
    record[field]=input[field].trim();
  }
  if (!/^(fixed:|archive:|current:).+/.test(record.id) || !record.title) throw new Error('Título ou identificação da rifa inválidos.');
  if (!validImage(input.image)) throw new Error('Cartaz inválido ou muito grande. Selecione a imagem novamente.');
  record.image=input.image;
  return record;
}
export async function onRequestGet(context) {
  try {
    const result=await database(context).prepare('SELECT valor, atualizado_em FROM pixels_rifa_state WHERE chave >= ? AND chave < ?').bind(PREFIX,'central:card;').all();
    const records=(result.results||[]).flatMap(row=>{
      try { return [{...JSON.parse(row.valor),revision:row.atualizado_em}]; } catch {return []}
    });
    return json({records});
  } catch {return json({error:'Não foi possível carregar as edições da Central. Verifique o banco PIXELS_DB.'},503)}
}
export async function onRequestPost(context) {
  try {
    const {request}=context;
    if (request.headers.get('origin') && request.headers.get('origin')!==new URL(request.url).origin) return json({error:'Origem não permitida.'},403);
    if (!(request.headers.get('content-type')||'').startsWith('application/json')) return json({error:'Formato inválido.'},415);
    if (Number(request.headers.get('content-length')||0)>LIMIT) return json({error:'Arquivo muito grande.'},413);
    // Limita também corpos sem Content-Length antes de acumulá-los em memória.
    const reader=request.body?.getReader();
    if (!reader) return json({error:'Dados ausentes.'},400);
    const chunks=[];let size=0;
    while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>LIMIT){await reader.cancel();return json({error:'Arquivo muito grande.'},413)}chunks.push(part.value)}
    const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
    let body;try{body=JSON.parse(new TextDecoder().decode(bytes))}catch{return json({error:'Dados inválidos.'},400)}
    const db=database(context);
    const ip=request.headers.get('CF-Connecting-IP')||'local';
    const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(ip));
    const rateKey='central:login:'+Array.from(new Uint8Array(hash),x=>x.toString(16).padStart(2,'0')).join('');
    const cutoff=new Date(Date.now()-15*60*1000).toISOString();
    const rate=await db.prepare('SELECT valor, atualizado_em FROM pixels_rifa_state WHERE chave = ?').bind(rateKey).first();
    if(rate && rate.atualizado_em>cutoff && Number(rate.valor)>=8) return json({error:'Muitas tentativas. Aguarde 15 minutos para entrar novamente.'},429);
    const expected=String(context.env.PIXELS_ADMIN_PASSWORD||'1807');
    if(String(body.password||'')!==expected){
      await db.prepare(`INSERT INTO pixels_rifa_state (chave,valor,atualizado_em) VALUES (?, '1', ?)
        ON CONFLICT(chave) DO UPDATE SET valor=CASE WHEN atualizado_em < ? THEN '1' ELSE CAST(CAST(valor AS INTEGER)+1 AS TEXT) END,
        atualizado_em=CASE WHEN atualizado_em < ? THEN excluded.atualizado_em ELSE atualizado_em END`).bind(rateKey,new Date().toISOString(),cutoff,cutoff).run();
      return json({error:'Senha administrativa inválida.'},401);
    }
    if(rate) await db.prepare('DELETE FROM pixels_rifa_state WHERE chave = ?').bind(rateKey).run();
    if(body.action==='login') return json({ok:true});
    if(body.action!=='save') return json({error:'Ação inválida.'},400);
    let record;try{record=cleanRecord(body.record)}catch(error){return json({error:error.message},400)}
    if(typeof body.revision!=='string' || body.revision.length>80) return json({error:'Versão inválida. Reabra o painel.'},400);
    const revision=crypto.randomUUID();
    // Comparação atômica impede substituir uma edição feita em outra aba.
    const outcome=body.revision
      ? await db.prepare('UPDATE pixels_rifa_state SET valor = ?, atualizado_em = ? WHERE chave = ? AND atualizado_em = ?').bind(JSON.stringify(record),revision,PREFIX+record.id,body.revision).run()
      : await db.prepare('INSERT INTO pixels_rifa_state (chave,valor,atualizado_em) VALUES (?, ?, ?) ON CONFLICT(chave) DO NOTHING').bind(PREFIX+record.id,JSON.stringify(record),revision).run();
    const changed=Number(outcome.meta?.changes||0);
    if(!changed) return json({error:'Esta rifa foi editada em outra aba. Reabra o painel para carregar a versão atual.'},409);
    return json({ok:true,record:{...record,revision}});
  } catch {return json({error:'Não foi possível salvar. Sua edição continua no formulário; tente novamente.'},503)}
}
