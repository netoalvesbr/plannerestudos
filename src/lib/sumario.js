// Lê o sumário de um livro a partir das linhas de texto do PDF.
//
// Quando o PDF tem marcadores (o índice que aparece na barra lateral do leitor), usamos
// aqueles — é exato. Este arquivo é para o outro caso: o livro escaneado ou exportado sem
// marcadores, em que o sumário é só uma página de texto como esta:
//
//   1. INTRODUÇÃO ..................................... 15
//   1.1 Conceito e natureza jurídica .................. 17
//   Capítulo 2 — DIREITOS FUNDAMENTAIS ................ 45
//   2.1.3 Espécies                                      102
//
// A dificuldade é separar essas linhas de uma linha de texto comum que por acaso termina
// com número. Por isso exigimos um sinal de sumário: pontinhos de preenchimento, uma
// numeração no começo, uma palavra de divisão (capítulo, título, seção...) ou a linha toda
// em maiúsculas. Além disso, as páginas de um sumário sempre crescem — quem não respeita
// isso é descartado.

const PALAVRAS_DIVISAO = /^(cap[íi]tulo|cap\.|parte|t[íi]tulo|se[çc][ãa]o|subse[çc][ãa]o|unidade|livro|anexo|ap[êe]ndice|introdu[çc][ãa]o|conclus[ãa]o|bibliografia|refer[êe]ncias|sum[áa]rio|pref[áa]cio|apresenta[çc][ãa]o)\b/i;

// numeração no começo: "1.", "1.1", "2.3.4 -", "IV -"
const NUM_ARABE = /^(\d{1,2}(?:\.\d{1,2}){0,4})[.)\s-–—]/;
const NUM_ROMANO = /^([IVXLC]{1,6})\s*[.)\s-–—]/;
const PONTINHOS = /[.·•‥…_\s]{4,}\s*\d{1,4}$/;

// linhas que nunca são item de sumário
const LIXO = /^(p[áa]gina|p[áa]g\.?|sum[áa]rio|[íi]ndice|conte[úu]do|table of contents)\s*$/i;

const limpar = (t) => String(t || '').replace(/\s+/g, ' ').trim();

// "SUMÁRIO" sozinho, "ÍNDICE", números de página soltos
const ehCabecalho = (t) => LIXO.test(t) || /^\d{1,4}$/.test(t);

const soMaiusculas = (t) => {
  const letras = t.replace(/[^\p{L}]/gu, '');
  return letras.length >= 3 && letras === letras.toUpperCase();
};

// Quantos níveis tem "2.3.4" → 3. Sem numeração, 1.
function nivelDe(titulo) {
  const m = NUM_ARABE.exec(titulo);
  if (m) return Math.min(4, m[1].split('.').length);
  if (NUM_ROMANO.test(titulo) || PALAVRAS_DIVISAO.test(titulo)) return 1;
  return 2;
}

// Tira a numeração repetida do começo? Não: ela ajuda a pessoa a se achar no livro.
// Só tiramos os pontinhos e a página do fim.
function partir(linha) {
  const t = limpar(linha);
  if (!t || t.length > 200 || ehCabecalho(t)) return null;
  const m = /^(.*?)[\s.·•‥…_-]*(\d{1,4})$/.exec(t);
  if (!m) return null;
  const titulo = limpar(m[1]).replace(/[.·•‥…_\s-]+$/, '');
  const pagina = Number(m[2]);
  if (!titulo || titulo.length < 2) return null;
  // precisa ter letra: descarta "1.2.3 45"
  if (!/\p{L}/u.test(titulo)) return null;
  // sinal de que é mesmo sumário
  const sinal = PONTINHOS.test(t) || NUM_ARABE.test(titulo) || NUM_ROMANO.test(titulo)
    || PALAVRAS_DIVISAO.test(titulo) || soMaiusculas(titulo);
  if (!sinal) return null;
  if (pagina < 1 || pagina > 5000) return null;
  return { titulo, pagina, nivel: nivelDe(titulo) };
}

/**
 * Analisa as linhas de um PDF e devolve os itens do sumário encontrados.
 * Em `relatorio` vai o que a tela mostra para a pessoa entender o resultado.
 */
export function analisarSumario(linhas) {
  const brutos = [];
  for (const l of linhas || []) {
    const item = partir(l);
    if (item) brutos.push(item);
  }

  // As páginas de um sumário crescem. Percorremos guardando o maior encadeamento
  // crescente, o que elimina de uma vez números de página do rodapé e linhas soltas.
  const itens = [];
  let ultima = 0;
  let descartados = 0;
  for (const it of brutos) {
    if (it.pagina >= ultima) {
      itens.push(it);
      ultima = it.pagina;
    } else {
      descartados++;
    }
  }

  // tira repetições exatas (sumário que aparece duas vezes no arquivo)
  const vistos = new Set();
  const unicos = itens.filter((it) => {
    const k = `${it.titulo}#${it.pagina}`;
    if (vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });

  return {
    itens: unicos,
    relatorio: {
      encontrados: unicos.length,
      descartados,
      linhas: (linhas || []).length,
    },
  };
}

/**
 * Página final de um item: a página do próximo item do mesmo nível ou mais alto, menos 1.
 * Serve para preencher "página final" quando a pessoa escolhe um capítulo.
 */
export function faixaDe(itens, indice) {
  const atual = itens?.[indice];
  if (!atual) return { ini: '', fim: '' };
  const ini = atual.pagina;
  let fim = '';
  // o próximo item do mesmo nível ou mais alto: assim a faixa de um capítulo cobre o
  // capítulo inteiro, e não só até o seu primeiro subtítulo
  for (let i = indice + 1; i < itens.length; i++) {
    const prox = itens[i];
    if (prox.nivel > atual.nivel) continue;
    if (prox.pagina != null && ini != null && prox.pagina > ini) {
      fim = prox.pagina - 1;
      break;
    }
  }
  return { ini: ini == null ? '' : String(ini), fim: fim === '' ? '' : String(fim) };
}
