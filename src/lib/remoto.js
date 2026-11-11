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
  repescagem: r.prova?.repescagem || null,
  criadoPor: r.criado_por,
  criadoEm: r.criado_em || null,
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
  disciplinas: (c.disciplinas || []).map(({ nome, bloco, fase, area, topicos, cargos }) => ({ nome, bloco: bloco || null, fase: fase || null, area: area || null, topicos: topicos || [], ...(cargos?.length ? { cargos } : {}) })),
  cronograma: c.cronograma || [],
  prova: c.prova?.blocos || c.modelo || c.repescagem ? { ...(c.prova?.blocos ? c.prova : {}), modelo: c.modelo || null, repescagem: c.repescagem || null } : null,
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
  concursoRef: r.concurso_ref || '',
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
  criadoEm: r.criado_em || null,
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
export async function enviarEdital(arquivo) {
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
    concurso_ref: q.concursoRef || null,
    fase: q.fase || null,
    area: q.area || null,
    banca: q.banca || null,
    ano: q.ano ? Number(q.ano) : null,
    orgao_prova: q.orgao || null,
    origem: q.origem || 'prova_anterior',
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
    ...(q.comentario ? { comentario: q.comentario } : {}),
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

// exclui várias questões de uma vez (um lote importado). Só apaga as que a pessoa criou (ou todas, se for administrador).
export async function excluirQuestoes(uids) {
  if (!supabase) {
    const b = lerLocal();
    const fora = new Set(uids);
    b.questoes = b.questoes.filter((q) => !fora.has(q.uid));
    gravarLocal(b);
    return uids.length;
  }
  let n = 0;
  for (let i = 0; i < uids.length; i += 100) {
    const { data, error } = await supabase.from('questoes').delete().in('uid', uids.slice(i, i + 100)).select('uid');
    if (error) throw new Error(error.message);
    n += data?.length || 0;
  }
  return n;
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

// ---------- biblioteca compartilhada de editais verticalizados ----------
const LSV = 'estudaai:verticalizados-local';
export async function listarVerticalizados() {
  if (!supabase) {
    try {
      return JSON.parse(localStorage.getItem(LSV)) || [];
    } catch {
      return [];
    }
  }
  const { data, error } = await supabase.from('verticalizados').select('*').order('criado_em', { ascending: false }).limit(300);
  if (error) throw new Error(error.message);
  return data;
}

export async function compartilharVerticalizado({ titulo, descricao, disciplinas, autorNome }) {
  const linha = { titulo, descricao: descricao || null, disciplinas, autor_nome: autorNome || null };
  if (!supabase) {
    const l = await listarVerticalizados();
    l.unshift({ ...linha, id: crypto.randomUUID(), criado_por: 'local', criado_em: new Date().toISOString() });
    localStorage.setItem(LSV, JSON.stringify(l));
    return;
  }
  const { error } = await supabase.from('verticalizados').insert(linha);
  if (error) throw new Error(error.message);
}

export async function excluirVerticalizado(id) {
  if (!supabase) {
    const l = (await listarVerticalizados()).filter((v) => v.id !== id);
    localStorage.setItem(LSV, JSON.stringify(l));
    return;
  }
  const { error } = await supabase.from('verticalizados').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ---------- acessos e painel do administrador ----------
// registra 1 acesso por abertura do site (por aba), sem atrapalhar se a tabela ainda não existir
export async function registrarAcesso() {
  if (!supabase) return;
  try {
    if (sessionStorage.getItem('estudaai.acesso')) return;
    sessionStorage.setItem('estudaai.acesso', '1');
    const movel = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
    await supabase.from('acessos').insert({ aparelho: movel ? 'celular' : 'computador' });
  } catch {
    /* ignora */
  }
}

export async function dadosAdmin(dias = 90) {
  if (!supabase) throw new Error('O painel de acessos só funciona com contas (modo online).');
  const { data: usuarios, error: e1 } = await supabase.rpc('admin_usuarios');
  if (e1) throw new Error(/admin_usuarios|function/i.test(e1.message) ? 'O registro de acessos ainda não foi ativado no banco de dados.' : e1.message);
  const desde = new Date(Date.now() - dias * 86400000).toISOString();
  const acessos = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await supabase.from('acessos').select('user_id, em, aparelho').gte('em', desde).order('em').range(de, de + 999);
    if (error) throw new Error(error.message);
    acessos.push(...data);
    if (data.length < 1000) break;
  }
  return { usuarios: usuarios || [], acessos };
}

// ---------- leis: jurisprudência/doutrina por artigo ----------
const LS_ANOT = 'estudaai.anotacoesLei';
export async function anotacoesDaLei(lei) {
  if (!supabase) {
    try {
      return (JSON.parse(localStorage.getItem(LS_ANOT)) || []).filter((a) => a.lei === lei);
    } catch {
      return [];
    }
  }
  const { data, error } = await supabase.from('anotacoes_lei').select('*').eq('lei', lei).order('criado_em');
  if (error) throw new Error(/anotacoes_lei/.test(error.message) ? 'A jurisprudência por artigo ainda não foi ativada no banco de dados.' : error.message);
  return data;
}
export async function salvarAnotacoes(lista) {
  lista = lista.map((a) => ({ ...a, url: /^https?:\/\//i.test((a.url || '').trim()) ? a.url.trim() : null }));
  if (!supabase) {
    const todas = JSON.parse(localStorage.getItem(LS_ANOT) || '[]');
    const novas = lista.map((a) => ({ ...a, id: crypto.randomUUID(), criado_por: 'local', criado_em: new Date().toISOString() }));
    localStorage.setItem(LS_ANOT, JSON.stringify([...todas, ...novas]));
    return novas;
  }
  const { data, error } = await supabase.from('anotacoes_lei').insert(lista).select('*');
  if (error) throw new Error(error.message);
  return data;
}
export async function excluirAnotacao(id) {
  if (!supabase) {
    const todas = JSON.parse(localStorage.getItem(LS_ANOT) || '[]');
    localStorage.setItem(LS_ANOT, JSON.stringify(todas.filter((a) => a.id !== id)));
    return;
  }
  const { error } = await supabase.from('anotacoes_lei').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ---------- PDFs interativos ----------
const LS_EST = 'estudaai.estudos';
export async function listarEstudos(materia) {
  if (!supabase) {
    try {
      return (JSON.parse(localStorage.getItem(LS_EST)) || []).filter((e) => !materia || e.materia === materia);
    } catch {
      return [];
    }
  }
  let q = supabase.from('estudos_interativos').select('id, materia, topico, concurso_ref, criado_por, criado_em');
  if (materia) q = q.eq('materia', materia);
  const { data, error } = await q.order('criado_em');
  if (error) throw new Error(/estudos_interativos/.test(error.message) ? 'Os PDFs interativos ainda não foram ativados no banco de dados.' : error.message);
  return data;
}
export async function lerEstudo(id) {
  if (!supabase) return (JSON.parse(localStorage.getItem(LS_EST)) || []).find((e) => e.id === id);
  const { data, error } = await supabase.from('estudos_interativos').select('*').eq('id', id).single();
  if (error) throw new Error(error.message);
  return data;
}
export async function salvarEstudo(e) {
  if (!supabase) {
    const todos = JSON.parse(localStorage.getItem(LS_EST) || '[]');
    const novo = { ...e, id: crypto.randomUUID(), criado_por: 'local', criado_em: new Date().toISOString() };
    localStorage.setItem(LS_EST, JSON.stringify([...todos, novo]));
    return novo;
  }
  const { data, error } = await supabase.from('estudos_interativos').insert(e).select('*').single();
  if (error) throw new Error(error.message);
  return data;
}
export async function excluirEstudo(id) {
  if (!supabase) {
    localStorage.setItem(LS_EST, JSON.stringify((JSON.parse(localStorage.getItem(LS_EST)) || []).filter((e) => e.id !== id)));
    return;
  }
  const { error } = await supabase.from('estudos_interativos').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ---------- texto das leis ----------
const LS_LEIS = 'estudaai.leisTexto';
const lerLeisLocal = () => {
  try {
    return JSON.parse(localStorage.getItem(LS_LEIS)) || {};
  } catch {
    return {};
  }
};
export async function textoLei(id) {
  if (!supabase) return lerLeisLocal()[id] || null;
  const { data, error } = await supabase.from('leis_texto').select('dados, atualizado').eq('id', id).maybeSingle();
  if (error) throw new Error(/leis_texto/.test(error.message) ? 'O banco de leis ainda não foi ativado.' : error.message);
  return data;
}
export async function statusLeis() {
  if (!supabase) return Object.entries(lerLeisLocal()).map(([id, v]) => ({ id, atualizado: v.atualizado, fonte: v.fonte, meta: v.dados?.meta }));
  const { data, error } = await supabase.from('leis_texto').select('id, atualizado, fonte, meta:dados->meta');
  if (error) throw new Error(/leis_texto/.test(error.message) ? 'O banco de leis ainda não foi ativado no banco de dados.' : error.message);
  return data;
}
export async function salvarTextoLei(id, dados, fonte) {
  if (!supabase) {
    try {
      localStorage.setItem(LS_LEIS, JSON.stringify({ ...lerLeisLocal(), [id]: { dados, fonte, atualizado: new Date().toISOString() } }));
    } catch {
      throw new Error('Sem espaço no navegador para guardar esta lei no modo local.');
    }
    return;
  }
  const { error } = await supabase.from('leis_texto').upsert({ id, dados, fonte, atualizado: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

// ---------- biblioteca compartilhada ----------
const LS_BIB = 'estudaai.biblioteca';
const bibLocal = () => {
  try {
    return JSON.parse(localStorage.getItem(LS_BIB)) || [];
  } catch {
    return [];
  }
};
export async function listarBiblioteca(categoria) {
  if (!supabase) return bibLocal().filter((x) => !categoria || x.categoria === categoria);
  let q = supabase.from('biblioteca').select('*').order('criado_em', { ascending: false });
  if (categoria) q = q.eq('categoria', categoria);
  const { data, error } = await q;
  if (error) throw new Error(/biblioteca/.test(error.message) ? 'A biblioteca ainda não foi ativada no banco de dados.' : error.message);
  return data;
}
export async function contarBiblioteca() {
  const lista = await listarBiblioteca();
  const n = {};
  for (const x of lista) n[x.categoria] = (n[x.categoria] || 0) + 1;
  return n;
}
const limparNome = (n) => n.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '-').slice(-80);
export async function enviarArquivo(dados, arquivo, aoProgredir) {
  if (!supabase) {
    if (arquivo.size > 2 * 1024 * 1024) throw new Error('No modo sem conta, só arquivos de até 2 MB.');
    const url = await new Promise((ok, erro) => {
      const fr = new FileReader();
      fr.onload = () => ok(fr.result);
      fr.onerror = () => erro(fr.error);
      fr.readAsDataURL(arquivo);
    });
    const item = { ...dados, id: crypto.randomUUID(), arquivo: url, nome_arquivo: arquivo.name, tipo: arquivo.type, tamanho: arquivo.size, criado_por: 'local', criado_em: new Date().toISOString(), downloads: 0 };
    try {
      localStorage.setItem(LS_BIB, JSON.stringify([item, ...bibLocal()]));
    } catch {
      throw new Error('Sem espaço no navegador para este arquivo no modo sem conta.');
    }
    return item;
  }
  const { data: u } = await supabase.auth.getUser();
  const caminho = `${u.user.id}/${Date.now()}-${limparNome(arquivo.name)}`;
  aoProgredir?.('Enviando o arquivo…');
  const { error: e1 } = await supabase.storage.from('biblioteca').upload(caminho, arquivo, { contentType: arquivo.type, upsert: false });
  if (e1) throw new Error(/mime|type/i.test(e1.message) ? 'Tipo de arquivo não aceito. Envie PDF, imagem (JPG/PNG) ou Word.' : /size|large/i.test(e1.message) ? 'Arquivo grande demais (máximo 25 MB).' : e1.message);
  const { data, error } = await supabase
    .from('biblioteca')
    .insert({ ...dados, arquivo: caminho, nome_arquivo: arquivo.name, tipo: arquivo.type, tamanho: arquivo.size, autor_nome: u.user.user_metadata?.nome || u.user.user_metadata?.full_name || u.user.user_metadata?.name || '' })
    .select('*')
    .single();
  if (error) {
    await supabase.storage.from('biblioteca').remove([caminho]);
    throw new Error(error.message);
  }
  return data;
}
export async function linkArquivo(item, baixar = false) {
  if (!supabase) return item.arquivo;
  const { data, error } = await supabase.storage.from('biblioteca').createSignedUrl(item.arquivo, 3600, baixar ? { download: item.nome_arquivo || true } : undefined);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}
export async function excluirArquivo(item) {
  if (!supabase) {
    localStorage.setItem(LS_BIB, JSON.stringify(bibLocal().filter((x) => x.id !== item.id)));
    return;
  }
  const { error } = await supabase.from('biblioteca').delete().eq('id', item.id);
  if (error) throw new Error(error.message);
  await supabase.storage.from('biblioteca').remove([item.arquivo]);
}

// baixa o arquivo da biblioteca como File (para gerar questões a partir dele)
export async function baixarArquivoBiblioteca(item) {
  const url = supabase ? (await supabase.storage.from('biblioteca').createSignedUrl(item.arquivo, 600)).data?.signedUrl : item.arquivo;
  if (!url) throw new Error('Não foi possível abrir o arquivo.');
  const blob = await (await fetch(url)).blob();
  return new File([blob], item.nome_arquivo || `${item.titulo}.pdf`, { type: item.tipo || blob.type || 'application/pdf' });
}
export async function mudarPrivacidade(item, privado) {
  if (!supabase) {
    localStorage.setItem(LS_BIB, JSON.stringify(bibLocal().map((x) => (x.id === item.id ? { ...x, privado } : x))));
    return;
  }
  const { error } = await supabase.from('biblioteca').update({ privado }).eq('id', item.id);
  if (error) throw new Error(/privado/.test(error.message) ? 'A opção de arquivo privado ainda não foi ativada no banco de dados.' : error.message);
}
