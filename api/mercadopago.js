// Endereço que o Mercado Pago chama sozinho quando uma assinatura é criada, cobrada,
// pausada ou cancelada. Roda no servidor da Vercel, não no navegador — é por isso que as
// chaves daqui podem ser secretas, ao contrário das que ficam no código do site.
//
// Como a pessoa é identificada: ao clicar em "Assinar agora", o site manda o id dela no
// campo external_reference do link do Mercado Pago. O aviso volta com esse mesmo id, então
// não precisamos casar por e-mail (que a pessoa pode digitar diferente no pagamento).
//
// Regra de segurança que vale ouro: NADA do que chega no aviso é levado a sério. O aviso só
// diz "olhe a assinatura tal". Quem responde se está paga é a API do Mercado Pago, consultada
// aqui com a nossa credencial. Assim, mesmo que alguém descubra este endereço e invente um
// aviso, não consegue liberar acesso nenhum.
//
// Variáveis de ambiente (configurar no painel da Vercel, nunca no código):
//   MP_ACCESS_TOKEN            — credencial de produção do Mercado Pago
//   MP_WEBHOOK_SECRET          — segredo da assinatura do webhook (recomendado)
//   SUPABASE_URL               — https://....supabase.co
//   SUPABASE_SERVICE_ROLE_KEY  — chave de serviço do Supabase (NUNCA no site)

import crypto from 'node:crypto';

const DIAS_CARENCIA = 3; // atraso na cobrança não derruba o acesso no mesmo dia
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const env = (nome) => process.env[nome] || '';

// --- assinatura do aviso -----------------------------------------------------------------
// O Mercado Pago manda x-signature: ts=...,v1=...  e o manifesto é
// "id:<id>;request-id:<x-request-id>;ts:<ts>;" assinado em HMAC-SHA256 com o segredo.
function assinaturaConfere(req, id) {
  const segredo = env('MP_WEBHOOK_SECRET');
  if (!segredo) return true; // sem segredo configurado, seguimos (a API do MP ainda decide)
  const cabecalho = req.headers['x-signature'] || '';
  const partes = Object.fromEntries(
    String(cabecalho).split(',').map((p) => p.split('=').map((x) => x.trim())),
  );
  if (!partes.ts || !partes.v1) return false;
  const manifesto = `id:${id};request-id:${req.headers['x-request-id'] || ''};ts:${partes.ts};`;
  const esperado = crypto.createHmac('sha256', segredo).update(manifesto).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(esperado), Buffer.from(partes.v1));
  } catch {
    return false; // tamanhos diferentes
  }
}

// --- Mercado Pago ------------------------------------------------------------------------
async function mp(caminho) {
  const r = await fetch(`https://api.mercadopago.com${caminho}`, {
    headers: { Authorization: `Bearer ${env('MP_ACCESS_TOKEN')}` },
  });
  if (!r.ok) throw new Error(`Mercado Pago respondeu ${r.status} em ${caminho}`);
  return r.json();
}

// --- Supabase ----------------------------------------------------------------------------
async function salvarPlano(userId, ate, obs) {
  const r = await fetch(`${env('SUPABASE_URL')}/rest/v1/planos?on_conflict=user_id`, {
    method: 'POST',
    headers: {
      apikey: env('SUPABASE_SERVICE_ROLE_KEY'),
      Authorization: `Bearer ${env('SUPABASE_SERVICE_ROLE_KEY')}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify({
      user_id: userId,
      plano: 'mensal',
      ate,
      obs,
      atualizado_em: new Date().toISOString(),
    }),
  });
  if (!r.ok) throw new Error(`Supabase respondeu ${r.status}: ${await r.text()}`);
}

// Até quando o acesso vale, a partir do que o Mercado Pago informou.
function valeAte(preapproval) {
  const base = preapproval?.next_payment_date ? new Date(preapproval.next_payment_date) : new Date();
  if (!preapproval?.next_payment_date) base.setMonth(base.getMonth() + 1);
  base.setDate(base.getDate() + DIAS_CARENCIA);
  return base.toISOString();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ erro: 'Use POST.' });
  }
  for (const nome of ['MP_ACCESS_TOKEN', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) {
    if (!env(nome)) return res.status(500).json({ erro: `Falta configurar ${nome} na Vercel.` });
  }

  const corpo = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const tipo = corpo.type || corpo.topic || '';
  const id = String(corpo.data?.id || corpo.id || req.query?.id || '');
  if (!id) return res.status(200).json({ ok: true, ignorado: 'aviso sem id' });

  if (!assinaturaConfere(req, id)) return res.status(401).json({ erro: 'Assinatura do aviso não confere.' });

  try {
    // Descobrimos a assinatura a que o aviso se refere.
    let preapproval = null;
    if (tipo.includes('preapproval')) {
      preapproval = await mp(`/preapproval/${id}`);
    } else if (tipo.includes('authorized_payment')) {
      const pagamento = await mp(`/authorized_payments/${id}`);
      if (pagamento?.preapproval_id) preapproval = await mp(`/preapproval/${pagamento.preapproval_id}`);
    } else {
      // pagamento avulso ou aviso de outro assunto: não mexe em plano nenhum
      return res.status(200).json({ ok: true, ignorado: tipo || 'sem tipo' });
    }

    const userId = String(preapproval?.external_reference || '');
    if (!UUID.test(userId)) {
      // Sem o id da pessoa não há o que liberar. Devolvemos 200 para o Mercado Pago não
      // ficar reenviando um aviso que nunca vai dar certo.
      return res.status(200).json({ ok: true, ignorado: 'assinatura sem external_reference válido' });
    }

    if (preapproval.status === 'authorized') {
      await salvarPlano(userId, valeAte(preapproval), `Mercado Pago · assinatura ${preapproval.id}`);
      return res.status(200).json({ ok: true, liberado: true, ate: valeAte(preapproval) });
    }

    // Pausada ou cancelada: NÃO cortamos o acesso agora. Quem pagou o mês tem direito ao mês,
    // como está escrito nos Termos de Uso. A data que já está gravada expira sozinha.
    return res.status(200).json({ ok: true, liberado: false, situacao: preapproval.status });
  } catch (e) {
    // 500 faz o Mercado Pago tentar de novo mais tarde, que é o que queremos numa falha nossa.
    return res.status(500).json({ erro: e.message });
  }
}
