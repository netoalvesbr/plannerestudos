// Camada de dados do usuário.
// - Com VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY definidos: login e dados na conta (Supabase).
// - Sem eles: "modo local" – tudo fica salvo apenas neste navegador.
// Em ambos os casos, mantém uma cópia local de segurança.
import { createClient } from '@supabase/supabase-js';
import { ADMIN_EMAILS, SUPABASE_CHAVE_PUBLICA, SUPABASE_URL } from '../data/config.js';

// Na página publicada no Claude (que não acessa outros sites) usa o modo do Claude; nos demais lugares, o Supabase.
const naPaginaClaude = typeof window !== 'undefined' && /claudeusercontent|claude\.ai/.test(window.location.hostname);
const URL = import.meta.env.VITE_SUPABASE_URL || SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || SUPABASE_CHAVE_PUBLICA;
export const supabase = URL && KEY && !naPaginaClaude && !import.meta.env.VITE_SEM_SUPABASE ? createClient(URL, KEY) : null;
// 'conta' = Supabase; 'claude' = página publicada no Claude (dados na conta Claude); 'local' = só neste aparelho
let modo = supabase ? 'conta' : 'local';
export const getModo = () => modo;

// ---------- integração com a página publicada no Claude ----------
let cdb = null;
let cuser = null;
let cid = null;
let detectado = null;
const comPrazo = (p, ms = 10000) => Promise.race([p, new Promise((r) => setTimeout(() => r(null), ms))]);

function detectarClaude() {
  if (detectado) return detectado;
  detectado = (async () => {
    if (supabase || !globalThis.claude?.use) return false;
    try {
      const [u, d] = await Promise.all([comPrazo(globalThis.claude.use('user')), comPrazo(globalThis.claude.use('db'))]);
      if (!u || !d) return false;
      const id = await u.id();
      if (!id) return false;
      cdb = d;
      cuser = u;
      cid = id;
      modo = 'claude';
      userId = id;
      return true;
    } catch {
      return false;
    }
  })();
  return detectado;
}

// grava um documento por vez (fila por documento)
const filas = {};
function gravar(docId, corpo) {
  const anterior = filas[docId] || Promise.resolve(true);
  const p = anterior.then(() =>
    cdb
      .doc(`data/users/${cid}/${docId}`)
      .set(corpo)
      .then(() => true)
      .catch((e) => {
        console.warn('Falha ao gravar na conta', e);
        return false;
      }),
  );
  filas[docId] = p;
  return p;
}
// respostas divididas em 16 documentos pelo 1º caractere do uid (limite de tamanho por documento)
const shardDe = (uid) => 'r' + (/^[0-9a-f]/.test(uid) ? uid[0] : 'x');
function gravarShard(respostas, sh) {
  const r = {};
  for (const [u, v] of Object.entries(respostas)) if (shardDe(u) === sh) r[u] = v;
  return gravar(sh, { r });
}

const lsGet = (k, def) => {
  try {
    const v = localStorage.getItem(k);
    return v ? JSON.parse(v) : def;
  } catch {
    return def;
  }
};
const lsSet = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* armazenamento indisponível */
  }
};

let userId = 'local';
const kResp = () => `estudaai:${userId}:respostas`;
const kPrefs = () => `estudaai:${userId}:prefs`;

// ---------- sessão ----------
export async function obterUsuario() {
  if (!supabase) {
    if (await detectarClaude()) {
      const me = await cuser.me();
      const nome = me.name || lsGet('estudaai:local:nome', null);
      return nome ? { id: cid, nome, email: null } : null;
    }
    const nome = lsGet('estudaai:local:nome', null);
    return nome ? { id: 'local', nome, email: null } : null;
  }
  const { data } = await supabase.auth.getSession();
  const u = data.session?.user;
  if (!u) return null;
  userId = u.id;
  const nome = u.user_metadata?.nome || u.user_metadata?.full_name || u.user_metadata?.name || (u.email || '').split('@')[0];
  return { id: u.id, nome, email: u.email, admin: ADMIN_EMAILS.includes((u.email || '').toLowerCase()) };
}

export function aoMudarSessao(cb) {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((evento) => {
    if (evento === 'PASSWORD_RECOVERY') cb('recuperar');
    else if (evento === 'SIGNED_IN' || evento === 'SIGNED_OUT') setTimeout(() => cb(), 0);
  });
  return () => data.subscription.unsubscribe();
}

export async function entrarLocal(nome) {
  lsSet('estudaai:local:nome', nome.trim());
}

const traduzir = (e) => {
  const m = (e?.message || '').toLowerCase();
  if (m.includes('invalid login')) return 'E-mail ou senha incorretos.';
  if (m.includes('already registered') || m.includes('already been registered')) return 'Este e-mail já tem conta. Use "Entrar".';
  if (m.includes('password should be')) return 'A senha precisa ter pelo menos 6 caracteres.';
  if (m.includes('email not confirmed')) return 'Confirme o seu e-mail pelo link que enviamos antes de entrar.';
  if (m.includes('rate limit')) return 'Muitas tentativas. Aguarde alguns minutos e tente de novo.';
  if (m.includes('invalid') && m.includes('email')) return 'E-mail inválido.';
  return e?.message || 'Erro desconhecido.';
};

export async function entrarComSenha(email, senha) {
  const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
  if (error) throw new Error(traduzir(error));
}

// devolve true se já entrou; false se precisa confirmar o e-mail
export async function criarConta(nome, email, senha) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password: senha,
    options: { data: { nome }, emailRedirectTo: window.location.origin },
  });
  if (error) throw new Error(traduzir(error));
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    throw new Error('Este e-mail já tem conta. Use "Entrar".');
  }
  return !!data.session;
}

export async function recuperarSenha(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
  if (error) throw new Error(traduzir(error));
}

export async function definirNovaSenha(senha) {
  const { error } = await supabase.auth.updateUser({ password: senha });
  if (error) throw new Error(traduzir(error));
}

export async function sair() {
  if (supabase) await supabase.auth.signOut();
  else if (modo === 'claude') return;
  else localStorage.removeItem('estudaai:local:nome');
}

// ---------- dados ----------
// respostas: { uid: [letra, acertou(0/1), timestamp, segundos] }
export async function carregarDados() {
  let respostas = lsGet(kResp(), {});
  let prefs = lsGet(kPrefs(), {});
  let somenteLocal = modo === 'local';
  if (modo === 'claude') {
    try {
      const snap = await comPrazo(cdb.collection(`data/users/${cid}`).get());
      if (!snap) throw new Error('sem resposta');
      const daConta = {};
      let prefsConta = null;
      for (const d of snap.docs) {
        const corpo = d.data() || {};
        if (d.id === 'prefs') prefsConta = corpo.p;
        else if (d.id.startsWith('r')) Object.assign(daConta, corpo.r || {});
      }
      const pendentes = Object.keys(respostas).filter((u) => !daConta[u]);
      respostas = { ...respostas, ...daConta };
      if (prefsConta) prefs = { ...prefs, ...prefsConta };
      for (const sh of new Set(pendentes.map(shardDe))) {
        if (!(await gravarShard(respostas, sh))) somenteLocal = true;
      }
      lsSet(kResp(), respostas);
      lsSet(kPrefs(), prefs);
    } catch (e) {
      console.warn('Falha ao carregar da conta', e);
      somenteLocal = true;
    }
  }
  if (supabase) {
    try {
      const [r, p] = await Promise.all([
        supabase.from('respostas').select('uid,letra,acertou,ts,segundos'),
        supabase.from('preferencias').select('dados').maybeSingle(),
      ]);
      if (r.error) throw r.error;
      const daConta = {};
      for (const x of r.data) daConta[x.uid] = [x.letra, x.acertou ? 1 : 0, Number(x.ts), x.segundos || 0];
      // mescla: o que estiver só no aparelho (ex.: respondido offline) sobe para a conta
      const pendentes = Object.entries(respostas).filter(([uid]) => !daConta[uid]);
      respostas = { ...respostas, ...daConta };
      if (pendentes.length) await enviarRespostas(pendentes);
      if (!p.error && p.data?.dados) prefs = { ...prefs, ...p.data.dados };
      lsSet(kResp(), respostas);
      lsSet(kPrefs(), prefs);
    } catch (e) {
      console.warn('Falha ao carregar da conta', e);
      somenteLocal = true;
    }
  }
  return { respostas, prefs, somenteLocal };
}

async function enviarRespostas(pares) {
  const linhas = pares.map(([uid, [letra, acertou, ts, segundos]]) => ({
    user_id: userId,
    uid,
    letra,
    acertou: !!acertou,
    ts,
    segundos,
  }));
  const { error } = await supabase.from('respostas').upsert(linhas);
  if (error) throw error;
}

// devolve true se salvou na conta; false se ficou só no aparelho
export async function salvarResposta(respostas, uid) {
  lsSet(kResp(), respostas);
  if (modo === 'claude') return gravarShard(respostas, shardDe(uid));
  if (!supabase) return false;
  try {
    await enviarRespostas([[uid, respostas[uid]]]);
    return true;
  } catch (e) {
    console.warn('Resposta salva só localmente', e);
    return false;
  }
}

export async function salvarPrefs(prefs) {
  lsSet(kPrefs(), prefs);
  if (modo === 'claude') return gravar('prefs', { p: prefs });
  if (!supabase) return false;
  try {
    const { error } = await supabase
      .from('preferencias')
      .upsert({ user_id: userId, dados: prefs, atualizado: new Date().toISOString() });
    if (error) throw error;
    return true;
  } catch (e) {
    console.warn('Preferências salvas só localmente', e);
    return false;
  }
}

export async function zerarRespostas(respostas, uids) {
  lsSet(kResp(), respostas);
  if (modo === 'claude') {
    for (const sh of new Set(uids.map(shardDe))) await gravarShard(respostas, sh);
    return;
  }
  if (!supabase) return;
  try {
    for (let i = 0; i < uids.length; i += 200) {
      await supabase.from('respostas').delete().in('uid', uids.slice(i, i + 200));
    }
  } catch (e) {
    console.warn('Falha ao zerar na conta', e);
  }
}

export function historicoComoTexto(respostas, prefs) {
  return JSON.stringify({ versao: 1, exportado: new Date().toISOString(), respostas, prefs }, null, 2);
}
