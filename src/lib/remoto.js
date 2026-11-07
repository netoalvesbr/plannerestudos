// Banco compartilhado: concursos, editais (PDF) e questões visíveis para todos os usuários.
// Com Supabase: tabelas "concursos" e "questoes" + pasta "editais". Sem Supabase (modo local): localStorage.
import { supabase } from './store.js';

const LS = 'estudaai:banco-local';
const lerLocal = () => {
  try {
    return JSON.parse(localStorage.getItem(LS)) || { concursos: [], questoes: [] };
  } catch {
    return { concursos: [], questoes: [] };
  }
};
const gravarLocal = (b) => {
  try {
    localStorage.setItem(LS, JSON.stringify(b));
  } catch {
    /* sem armazenamento */
  }
};

// ---------- identificador da questão (mesma regra dos geradores em Python) ----------
export async function uidDe(texto) {
  const norm = texto
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]/gu, '');
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(norm));
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16);
}

// ---------- conversão linha do banco ⇄ objeto do app ----------
const concursoDoBanco = (r) => ({
  id: r.id,
  sigla: r.sigla,
  nome: r.nome,
  orgao: r.orgao || '',
  banca: r.banca || '',
  edital: r.edital || '',
  editalUrl: r.edital_url || null,
  dataProva: r.data_prova || null,
  formato: r.formato || 'A-E',
  meta: Number(r.meta ?? 0.75),
  fases: r.fases || [],
  cargos: r.cargos || [],
  disciplinas: (r.disciplinas || []).map((d) => ({ grupo: d.bloco || 'Disciplinas', ...d })),
  cronograma: r.cronograma || [],
  prova: r.prova?.blocos ? r.prova : null,
  modelo: r.prova?.modelo || null,
  criadoPor: r.criado_por,
  remoto: true,
});

const concursoParaBanco = (c) => ({
  sigla: c.sigla,
  nome: c.nome,
  orgao: c.orgao || null,
  banca: c.banca || null,
  edital: c.edital || null,
  edital_url: c.editalUrl || null,
  data_prova: c.dataProva || null,
  formato: c.formato || 'A-E',
  meta: c.meta ?? 0.75,
  fases: c.fases || [],
  cargos: c.cargos || [],
  disciplinas: (c.disciplinas || []).map(({ nome, bloco, fase, area, topicos }) => ({ nome, bloco: bloco || null, fase: fase || null, area: area || null, topicos: topicos || [] })),
  cronograma: c.cronograma || [],
  prova: c.prova?.blocos ? { ...c.prova, modelo: c.modelo || null } : c.modelo ? { modelo: c.modelo } : null,
});

export const questaoDoBanco = (r) => ({
  uid: r.uid,
  concursos: r.concurso_id ? [r.concurso_id] : [],
  fase: r.fase || null,
  area: r.area || null,
  cargos: r.cargos || null,
  banca: r.banca || '',
  ano: r.ano || null,
  orgao_prova_original: r.orgao_prova || null,
  origem: r.origem || 'prova_anterior',
  formato: r.formato || 'A-E',
  bloco: r.bloco || '',
  materia: r.materia,
  assunto: r.assunto || 'Geral',
  dificuldade: r.dificuldade || '',
  enunciado: r.enunciado,
  alternativas: r.alternativas || null,
  gabarito: r.formato === 'discursiva' ? 'OK' : r.gabarito,
  espelho: r.espelho || '',
  anulada: !!r.anulada,
  comentario: r.comentario || '',
  fonte: r.fonte || '',
  criadoPor: r.criado_por,
  remoto: true,
});

// ---------- leitura ----------
export async function carregarBanco() {
  if (!supabase) {
    const b = lerLocal();
    return { concursos: b.concursos.map(concursoDoBanco), questoes: b.questoes.map(questaoDoBanco) };
  }
  const { data: cs, error: e1 } = await supabase.from('concursos').select('*').order('criado_em');
  if (e1) throw e1;
  const qs = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await supabase.from('questoes').select('*').order('criado_em').range(de, de + 999);
    if (error) throw error;
    qs.push(...data);
    if (data.length < 1000) break;
  }
  return { concursos: cs.map(concursoDoBanco), questoes: qs.map(questaoDoBanco) };
}

// ---------- concursos ----------
async function enviarEdital(arquivo) {
  if (!arquivo || !supabase) return null;
  const nome = `${crypto.randomUUID()}/${arquivo.name.normalize('NFKD').replace(/[^\w.-]+/g, '_')}`;
  const { error } = await supabase.storage.from('editais').upload(nome, arquivo, { contentType: 'application/pdf' });
  if (error) throw new Error('Não foi possível enviar o PDF do edital: ' + error.message);
  return supabase.storage.from('editais').getPublicUrl(nome).data.publicUrl;
}

export async function salvarConcurso(dados, arquivoPdf, id = null) {
  const url = await enviarEdital(arquivoPdf);
  const linha = concursoParaBanco({ ...dados, editalUrl: url || dados.editalUrl });
  if (!supabase) {
    const b = lerLocal();
    if (id) b.concursos = b.concursos.map((c) => (c.id === id ? { ...c, ...linha } : c));
    else b.concursos.push({ ...linha, id: crypto.randomUUID(), criado_por: 'local' });
    gravarLocal(b);
    return id || b.concursos.at(-1).id;
  }
  if (id) {
    const { error } = await supabase.from('concursos').update({ ...linha, atualizado: new Date().toISOString() }).eq('id', id);
    if (error) throw new Error(error.message);
    return id;
  }
  const { data, error } = await supabase.from('concursos').insert(linha).select('id').single();
  if (error) throw new Error(error.message);
  return data.id;
}

export async function excluirConcurso(id) {
  if (!supabase) {
    const b = lerLocal();
    b.concursos = b.concursos.filter((c) => c.id !== id);
    gravarLocal(b);
    return;
  }
  const { error } = await supabase.from('concursos').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ---------- questões ----------
// lista: objetos do app (com uid). Devolve quantas eram novas e quantas já existiam no banco.
export async function salvarQuestoes(lista) {
  const linhas = lista.map((q) => ({
    uid: q.uid,
    concurso_id: q.concursoId || null,
    fase: q.fase || null,
    area: q.area || null,
    banca: q.banca || null,
    ano: q.ano ? Number(q.ano) : null,
    orgao_prova: q.orgao || null,
    origem: 'prova_anterior',
    formato: q.formato,
    bloco: q.bloco || null,
    materia: q.materia,
    assunto: q.assunto || null,
    enunciado: q.enunciado,
    alternativas: q.formato === 'discursiva' || q.formato === 'CE' ? null : q.alternativas,
    gabarito: q.anulada ? null : q.formato === 'discursiva' ? null : q.gabarito,
    espelho: q.espelho || null,
    anulada: !!q.anulada,
    fonte: q.fonte || null,
  }));
  if (!supabase) {
    const b = lerLocal();
    const existentes = new Set(b.questoes.map((x) => x.uid));
    const novas = linhas.filter((l) => !existentes.has(l.uid));
    b.questoes.push(...novas.map((n) => ({ ...n, criado_por: 'local', criado_em: new Date().toISOString() })));
    gravarLocal(b);
    return { novas: novas.length, repetidas: linhas.length - novas.length };
  }
  // descobre quais já existem para informar ao usuário
  const uids = linhas.map((l) => l.uid);
  const existentes = new Set();
  for (let i = 0; i < uids.length; i += 200) {
    const { data, error } = await supabase.from('questoes').select('uid').in('uid', uids.slice(i, i + 200));
    if (error) throw new Error(error.message);
    data.forEach((d) => existentes.add(d.uid));
  }
  const novas = linhas.filter((l) => !existentes.has(l.uid));
  for (let i = 0; i < novas.length; i += 200) {
    const { error } = await supabase.from('questoes').upsert(novas.slice(i, i + 200), { onConflict: 'uid', ignoreDuplicates: true });
    if (error) throw new Error(error.message);
  }
  return { novas: novas.length, repetidas: linhas.length - novas.length };
}

export async function excluirQuestao(uid) {
  if (!supabase) {
    const b = lerLocal();
    b.questoes = b.questoes.filter((q) => q.uid !== uid);
    gravarLocal(b);
    return;
  }
  const { error } = await supabase.from('questoes').delete().eq('uid', uid);
  if (error) throw new Error(error.message);
}
