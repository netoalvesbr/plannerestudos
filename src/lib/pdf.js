// Extrai o texto de um PDF no próprio navegador (pdf.js), linha a linha, preservando a ordem de leitura.
// Carregado sob demanda para não pesar o restante da plataforma.

import * as pdfjs from 'pdfjs-dist';
import urlWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { linhasDaPagina } from './linhasPdf.js';

// baixa o "worker" do pdf.js e guarda uma cópia na memória (não depende mais do arquivo no servidor)
let preparado = null;
export function prepararPdf() {
  if (!preparado) {
    preparado = fetch(urlWorker)
      .then((r) => {
        if (!r.ok) throw new Error('worker');
        return r.blob();
      })
      .then((b) => {
        pdfjs.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([b], { type: 'text/javascript' }));
      })
      .catch(() => {
        pdfjs.GlobalWorkerOptions.workerSrc = urlWorker;
      });
  }
  return preparado;
}

export async function textoDoPdf(arquivo, aoProgredir, maxPaginas = Infinity) {
  await prepararPdf();
  const dados = new Uint8Array(await arquivo.arrayBuffer());
  const doc = await pdfjs.getDocument({ data: dados }).promise;
  const linhas = [];
  const total = Math.min(doc.numPages, maxPaginas);
  const estado = {}; // lembra se a página anterior terminou num quadro de datas
  for (let p = 1; p <= total; p++) {
    const pagina = await doc.getPage(p);
    const conteudo = await pagina.getTextContent();
    const largura = pagina.getViewport({ scale: 1 }).width;
    // agrupa os trechos por altura (y); colunas: se a página tem 2 colunas, lê a esquerda e depois a direita
    const itens = conteudo.items
      .filter((i) => i.str && i.str.trim())
      .map((i) => ({ x: i.transform[4], y: Math.round(i.transform[5]), w: i.width, s: i.str }));
    linhas.push(...linhasDaPagina(itens, largura, estado));
    linhas.push(''); // quebra de página
    aoProgredir?.(p, total);
  }
  return linhas;
}

// Sumário vindo dos marcadores do próprio PDF (o índice que o leitor mostra na barra lateral).
// Quando existe, é muito mais confiável do que ler a página de sumário: já traz o título e a
// página de destino exatos. Devolve [] se o PDF não tiver marcadores.
export async function sumarioDosMarcadores(arquivo) {
  await prepararPdf();
  const dados = new Uint8Array(await arquivo.arrayBuffer());
  const doc = await pdfjs.getDocument({ data: dados }).promise;
  const raiz = await doc.getOutline();
  if (!raiz?.length) return [];

  const paginaDe = async (item) => {
    try {
      const dest = typeof item.dest === 'string' ? await doc.getDestination(item.dest) : item.dest;
      if (!Array.isArray(dest) || !dest[0]) return null;
      return (await doc.getPageIndex(dest[0])) + 1;
    } catch {
      return null;
    }
  };

  const saida = [];
  const andar = async (itens, nivel) => {
    for (const it of itens) {
      const titulo = String(it.title || '').replace(/\s+/g, ' ').trim();
      if (titulo) saida.push({ titulo, pagina: await paginaDe(it), nivel });
      if (it.items?.length && nivel < 4) await andar(it.items, nivel + 1);
    }
  };
  await andar(raiz, 1);
  return saida;
}
