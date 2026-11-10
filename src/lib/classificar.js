// Reconhece automaticamente o tipo de material (questões, lei, jurisprudência, doutrina, peça...) e a matéria,
// pelo nome do arquivo e pelo texto das primeiras páginas. É sempre uma sugestão: o usuário confere antes de enviar.
import { textoDoPdf } from './leitorPdf.js';

const norm = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Lê o texto de um .docx (é um arquivo ZIP; o texto fica em word/document.xml)
async function textoDocx(arquivo) {
  const buf = new Uint8Array(await arquivo.arrayBuffer());
  const dv = new DataView(buf.buffer);
  // procura o diretório central do ZIP
  let fim = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 70000); i--) if (dv.getUint32(i, true) === 0x06054b50) { fim = i; break; }
  if (fim < 0) return '';
  let p = dv.getUint32(fim + 16, true);
  const n = dv.getUint16(fim + 10, true);
  for (let k = 0; k < n; k++) {
    const metodo = dv.getUint16(p + 10, true);
    const tamC = dv.getUint32(p + 20, true);
    const lNome = dv.getUint16(p + 28, true);
    const lExtra = dv.getUint16(p + 30, true);
    const lCom = dv.getUint16(p + 32, true);
    const local = dv.getUint32(p + 42, true);
    const nome = new TextDecoder().decode(buf.slice(p + 46, p + 46 + lNome));
    if (nome === 'word/document.xml') {
      const ini = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true);
      let dados = buf.slice(ini, ini + tamC);
      if (metodo === 8) dados = new Uint8Array(await new Response(new Blob([dados]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
      const xml = new TextDecoder().decode(dados);
      return xml.replace(/<\/w:p>/g, '\n').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    }
    p += 46 + lNome + lExtra + lCom;
  }
  return '';
}

export async function textoDoArquivo(arquivo) {
  const nome = arquivo.name.toLowerCase();
  try {
    if (arquivo.type === 'application/pdf' || nome.endsWith('.pdf')) return (await textoDoPdf(arquivo, null, 6)).join('\n');
    if (nome.endsWith('.docx')) return await textoDocx(arquivo);
    if (arquivo.type.startsWith('text/') || nome.endsWith('.txt')) return (await arquivo.text()).slice(0, 60000);
  } catch {
    /* sem texto: classifica só pelo nome */
  }
  return '';
}

const conta = (t, re) => (t.match(re) || []).length;

export function classificar(nomeArquivo, texto) {
  const n = norm(nomeArquivo);
  const t = norm(texto).slice(0, 60000);
  const p = { questoes: 0, leis: 0, jurisprudencia: 0, doutrina: 1, pecas: 0, rascunho: 0, mapas: 0, outros: 0 };
  // pelo nome do arquivo (peso alto)
  if (/quest|simulado|prova|gabarito|exercic|caderno de q/.test(n)) p.questoes += 6;
  if (/\blei\b|lei[-_ ]?\d|codigo|decreto|constituic|\bcf\b|estatuto|regimento|lei seca|vade/.test(n)) p.leis += 6;
  if (/jurisprud|sumula|informativo|acordao|julgado|stf|stj|tese/.test(n)) p.jurisprudencia += 6;
  if (/doutrina|apostila|livro|resumo|aula|manual|curso/.test(n)) p.doutrina += 5;
  if (/peca|peticao|modelo|contestac|apelac|recurso|habeas|mandado|parecer|denuncia|queixa|agravo|embargos/.test(n)) p.pecas += 6;
  if (/rascunho|folha de resposta|folha-de-resposta|folha resposta/.test(n)) p.rascunho += 8;
  if (/mapa|mental|esquema|fluxograma/.test(n)) p.mapas += 7;
  // pelo conteúdo
  if (t) {
    p.questoes += Math.min(10, conta(t, /\n\s*(?:\(?[a-e]\)|[a-e]\s?[-–.])\s+\S/g) / 4) + Math.min(6, conta(t, /\bgabarito\b|assinale|julgue o item|alternativa correta|questao \d+/g));
    p.leis += Math.min(10, conta(t, /\n\s*art\.?\s*\d+/g) / 4) + (/(dispoe sobre|o presidente da republica|decreta:|faco saber que o congresso)/.test(t) ? 4 : 0);
    p.jurisprudencia += Math.min(10, conta(t, /\b(sumula|acordao|relator|relatora|ementa|informativo|julgado em|stf|stj|resp |hc |re |agrg|tema \d+)\b/g) / 3);
    p.pecas += Math.min(10, conta(t, /(excelentissimo|meritissimo|nestes termos|pede deferimento|requer seja|dos fatos|do direito|dos pedidos|vem respeitosamente|a presenca de vossa excelencia)/g) * 1.5);
    p.mapas += /mapa mental/.test(t) ? 3 : 0;
    p.doutrina += Math.min(4, t.length / 15000) + (/(capitulo|conceito|natureza juridica|segundo a doutrina|corrente|classificacao)/.test(t) ? 2 : 0);
  } else if (/\.(png|jpe?g|webp)$/.test(n)) {
    p.outros += 2;
    p.doutrina = 0;
  }
  return Object.entries(p).sort((a, b) => b[1] - a[1])[0][0];
}

// matéria: a do catálogo mais citada no nome e no texto (nome vale mais)
export function adivinharMateria(nomeArquivo, texto, materias) {
  const n = norm(nomeArquivo).replace(/[-_]+/g, ' ');
  const t = norm(texto).slice(0, 60000);
  let melhor = '';
  let max = 0;
  for (const m of materias) {
    const chave = norm(m).replace(/\(.*?\)/g, '').replace(/^nocoes de /, '').trim();
    if (chave.length < 4) continue;
    const curta = chave.replace(/^direito (do |da |de )?/, '');
    let s = 0;
    if (n.includes(chave)) s += 20;
    else if (curta.length > 4 && n.includes(curta)) s += 12;
    s += Math.min(15, (t.split(chave).length - 1) * 2);
    if (s > max) {
      max = s;
      melhor = m;
    }
  }
  return max >= 4 ? melhor : '';
}
