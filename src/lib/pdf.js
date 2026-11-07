// Extrai o texto de um PDF no próprio navegador (pdf.js), linha a linha, preservando a ordem de leitura.
// Carregado sob demanda para não pesar o restante da plataforma.

import * as pdfjs from 'pdfjs-dist';
import urlWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

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

export async function textoDoPdf(arquivo, aoProgredir) {
  await prepararPdf();
  const dados = new Uint8Array(await arquivo.arrayBuffer());
  const doc = await pdfjs.getDocument({ data: dados }).promise;
  const linhas = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const pagina = await doc.getPage(p);
    const conteudo = await pagina.getTextContent();
    const largura = pagina.getViewport({ scale: 1 }).width;
    // agrupa os trechos por altura (y); colunas: se a página tem 2 colunas, lê a esquerda e depois a direita
    const itens = conteudo.items
      .filter((i) => i.str && i.str.trim())
      .map((i) => ({ x: i.transform[4], y: Math.round(i.transform[5]), w: i.width, s: i.str }));
    const meio = largura / 2;
    const cruzaMeio = itens.filter((i) => i.x < meio - 10 && i.x + i.w > meio + 10).length;
    const duasColunas = itens.length > 40 && cruzaMeio < itens.length * 0.08 && itens.some((i) => i.x > meio + 5) && itens.some((i) => i.x < meio - 40);
    const colunas = duasColunas ? [itens.filter((i) => i.x < meio), itens.filter((i) => i.x >= meio)] : [itens];
    for (const col of colunas) {
      const porY = new Map();
      for (const i of col) {
        const chave = [...porY.keys()].find((y) => Math.abs(y - i.y) <= 2) ?? i.y;
        if (!porY.has(chave)) porY.set(chave, []);
        porY.get(chave).push(i);
      }
      [...porY.entries()]
        .sort((a, b) => b[0] - a[0])
        .forEach(([, trechos]) => {
          trechos.sort((a, b) => a.x - b.x);
          let t = '';
          let fim = null;
          for (const tr of trechos) {
            if (fim != null && tr.x - fim > 1.5 && !t.endsWith(' ') && !tr.s.startsWith(' ')) t += ' ';
            t += tr.s;
            fim = tr.x + tr.w;
          }
          t = t.replace(/\s+/g, ' ').trim();
          if (t) linhas.push(t);
        });
    }
    linhas.push(''); // quebra de página
    aoProgredir?.(p, doc.numPages);
  }
  return linhas;
}
