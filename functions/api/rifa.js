async function garantirTabela(db) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS pixels_rifa_state (
      chave TEXT PRIMARY KEY,
      valor TEXT NOT NULL,
      atualizado_em TEXT NOT NULL
    )
  `).run();
}

async function ler(db, chave, fallback) {
  const row = await db.prepare(
    'SELECT valor FROM pixels_rifa_state WHERE chave = ?'
  ).bind(chave).first();
  if (!row || !row.valor) return fallback;
  try { return JSON.parse(row.valor); } catch (_) { return fallback; }
}

async function gravar(db, chave, valor) {
  const agora = new Date().toISOString();
  await db.prepare(`
    INSERT INTO pixels_rifa_state (chave, valor, atualizado_em)
    VALUES (?, ?, ?)
    ON CONFLICT(chave) DO UPDATE SET
      valor = excluded.valor,
      atualizado_em = excluded.atualizado_em
  `).bind(chave, JSON.stringify(valor), agora).run();
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });
}

export async function onRequestGet(context) {
  try {
    const db = context.env.PIXELS_DB;
    if (!db) return json({error:'Binding D1 PIXELS_DB não configurado.'}, 500);
    await garantirTabela(db);
    const current = await ler(db, 'current', null);
    const archive = await ler(db, 'archive', []);
    return json({current, archive});
  } catch (erro) {
    return json({error: erro.message || 'Erro ao carregar dados.'}, 500);
  }
}

export async function onRequestPost(context) {
  try {
    const db = context.env.PIXELS_DB;
    if (!db) return json({error:'Binding D1 PIXELS_DB não configurado.'}, 500);
    await garantirTabela(db);

    const body = await context.request.json();
    const senhaEsperada = String(context.env.PIXELS_ADMIN_PASSWORD || '1807');
    if (String(body.password || '') !== senhaEsperada) {
      return json({error:'Senha administrativa inválida.'}, 401);
    }

    if (body.action === 'sync-current') {
      if (!body.raffle) return json({error:'Dados da rifa ausentes.'}, 400);
      await gravar(db, 'current', body.raffle);
      return json({ok:true, action:'sync-current'});
    }

    if (body.action === 'close') {
      if (!body.raffle) return json({error:'Dados do encerramento ausentes.'}, 400);
      const archive = await ler(db, 'archive', []);
      const fechamento = body.raffle;
      const id = fechamento.closedAt || `${fechamento.raffle || fechamento.title}-${fechamento.date || ''}`;
      const semDuplicar = Array.isArray(archive)
        ? archive.filter(item => (item.closedAt || `${item.raffle || item.title}-${item.date || ''}`) !== id)
        : [];
      semDuplicar.push(fechamento);
      await gravar(db, 'archive', semDuplicar);
      await db.prepare('DELETE FROM pixels_rifa_state WHERE chave = ?').bind('current').run();
      return json({ok:true, action:'close'});
    }

    return json({error:'Ação inválida.'}, 400);
  } catch (erro) {
    return json({error: erro.message || 'Erro ao salvar dados.'}, 500);
  }
}
