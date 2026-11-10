// Transforma a página de uma lei do Planalto (HTML) em estrutura navegável:
// { titulo, ementa, itens: [{ tipo: 'cabecalho', nivel, texto } | { tipo: 'artigo', id, rotulo, num, linhas: [...], stf }] }
// O texto revogado (riscado no site do Planalto) é removido.

const CAB = /^(PARTE|LIVRO|T[ÍI]TULO|CAP[ÍI]TULO|SE[ÇC][ÃA]O|Se[çc][ãa]o|SUBSE[ÇC][ÃA]O|Subse[çc][ãa]o)\b/;
const NIVEL = (t) => (/^PARTE/i.test(t) ? 0 : /^LIVRO/i.test(t) ? 1 : /^T[ÍI]TULO/i.test(t) ? 2 : /^CAP[ÍI]TULO/i.test(t) ? 3 : /^SUBSE/i.test(t) ? 5 : 4);
const ART = /^Art\.?\s*(\d+(?:\.\d{3})*)\s*(?:[º°o]|\.)?\s*(-[A-Z]{1,2}(?![a-zà-ú]))?\s*[.\-–]?\s*/;
const SO_NUMERO = /^(PARTE|LIVRO|T[ÍI]TULO|CAP[ÍI]TULO|SE[ÇC][ÃA]O|Se[çc][ãa]o|SUBSE[ÇC][ÃA]O|Subse[çc][ãa]o)\s+([IVXLCDM]+|\d+|[ÚU]NIC[OA]|GERAL|ESPECIAL)?\s*[º°ªA-Z-]{0,3}\s*$/i;
// rubrica (título do artigo ou do parágrafo, ex.: "Anterioridade da Lei", "Caso de diminuição de pena")
const ehRubrica = (t) =>
  t.length < 90 && /^[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/.test(t) && !/[.;:,]$/.test(t.replace(/\s*\([^)]*\)\s*$/, '')) &&
  !/^(§|Par[áa]grafo|[IVXLC]+\s*[-–]|[a-z]\)|\d+\s*[-–.)]|Pena|Art\.?\s*\d|PARTE|LIVRO|T[ÍI]TULO|CAP[ÍI]TULO|SE[ÇC][ÃA]O|SUBSE)/.test(t);
const FIM = /^(Bras[íi]lia|Rio de Janeiro),\s*\d{1,2}\s*(?:º\s*)?de\s+\p{L}+/u;
const ADCT = /^ATO DAS DISPOSI[ÇC][ÕO]ES CONSTITUCIONAIS TRANSIT[ÓO]RIAS/i;

const limpa = (t) => t.replace(/ /g, ' ').replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, ' ').trim();

export function lerLeiHtml(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('strike, s, del, script, style').forEach((e) => e.remove());
  const ps = [...doc.querySelectorAll('p, h1, h2, h3, h4, center')].filter((p) => !p.querySelector('p'));
  const itens = [];
  let art = null;
  let prefixo = '';
  let cabPendente = null;
  let rubrica = null;
  let comecou = false;
  let pausado = false;
  let ementa = '';
  const vistos = new Map();
  for (const p of ps) {
    const t = limpa(p.textContent || '');
    if (!t) continue;
    if (!comecou) {
      if (!ementa && /^(Disp[õo]e|Institui|Aprova|Altera|Regulamenta|Estabelece|Define|Cria|Organiza)\b/.test(t) && t.length > 20) ementa = t;
      if (!(ART.test(t) || CAB.test(t) || /^PRE[ÂA]MBULO/.test(t))) continue;
      comecou = true;
    }
    if (ADCT.test(t) && itens.length > 5) {
      pausado = false;
      prefixo = 'adct-';
      art = null;
      itens.push({ tipo: 'cabecalho', nivel: 0, texto: 'Ato das Disposições Constitucionais Transitórias (ADCT)' });
      continue;
    }
    if (pausado) continue;
    if (FIM.test(t) || /^Este texto n[ãa]o substitui/i.test(t)) {
      // fim do texto (assinaturas); na Constituição o ADCT vem depois
      if (itens.some((i) => i.tipo === 'artigo' && i.num > 0)) {
        pausado = true;
        art = null;
      }
      continue;
    }
    if (CAB.test(t) && t.length < 120) {
      art = null;
      cabPendente = { tipo: 'cabecalho', nivel: NIVEL(t), texto: t };
      if (!SO_NUMERO.test(t)) cabPendente.nome = ''; // nome já vem na mesma linha
      itens.push(cabPendente);
      rubrica = null;
      continue;
    }
    const m = t.match(ART);
    if (m) {
      const num = parseInt(m[1].replace(/\./g, ''), 10);
      const suf = (m[2] || '').replace(/[\s-]/g, '');
      const rotulo = `Art. ${m[1]}${num < 10 ? 'º' : ''}${suf ? '-' + suf : ''}`;
      let id = `${prefixo}art${num}${suf ? '-' + suf.toLowerCase() : ''}`;
      const n = (vistos.get(id) || 0) + 1;
      vistos.set(id, n);
      if (n > 1) id += `_${n}`;
      const stf = p.querySelector('a.cstf')?.getAttribute('href') || null;
      // a rubrica que ficou no fim do artigo anterior pertence a este
      if (art && art.linhas.length > 1 && art.linhas.at(-1).startsWith('#')) rubrica = art.linhas.pop().slice(1);
      art = { tipo: 'artigo', id, rotulo, num, adct: !!prefixo, linhas: [t.slice(m[0].length).trim()], stf };
      if (rubrica) art.rubrica = rubrica;
      rubrica = null;
      itens.push(art);
      cabPendente = null;
      continue;
    }
    if (art) art.linhas.push(ehRubrica(t) ? '#' + t : t);
    else if (cabPendente && cabPendente.nome === undefined && t.length < 200) {
      cabPendente.nome = t; // nome do título/capítulo (linha seguinte)
    } else if (/^PRE[ÂA]MBULO/.test(t)) {
      art = { tipo: 'artigo', id: 'preambulo', rotulo: 'Preâmbulo', num: 0, linhas: [], stf: null };
      itens.push(art);
    } else if (ehRubrica(t)) {
      rubrica = t;
    }
  }
  const titulo = limpa(doc.title || '');
  return { titulo, ementa, itens: itens.filter((i) => i.tipo !== 'artigo' || i.linhas.some(Boolean)) };
}

// separa as notas de alteração "(Redação dada pela Lei...)" do texto
const NOTA = /\s*\((?:Reda[çc][ãa]o dada|Inclu[íi]d[oa]|Vide|Revogad[oa]|Renumerad|Regulamento|Vig[êe]ncia|Acrescid|Produ[çc][ãa]o de efeito|Promulga[çc][ãa]o)[^)]*\)\s*(?:Vig[êe]ncia)?/gi;
export function separarNotas(linha) {
  const notas = [];
  const texto = linha.replace(NOTA, (m) => {
    notas.push(m.trim());
    return ' ';
  }).replace(/\s{2,}/g, ' ').trim();
  return { texto, notas };
}
