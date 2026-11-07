// Ponto único de leitura de PDF. O leitor (pdf.js, ~1 MB) é baixado logo depois que o site abre
// e fica na memória: assim, se a plataforma for atualizada enquanto a página está aberta,
// a importação continua funcionando.

export const MSG_ATUALIZADA = 'A plataforma foi atualizada enquanto esta página estava aberta. Recarregue a página (botão abaixo ou F5) e escolha o arquivo de novo.';
const ehFalhaDeCarga = (e) => /dynamically imported module|Importing a module script failed|error loading dynamically|Failed to fetch|Loading chunk/i.test(String(e?.message || e));

let modulo = null;
function carregar() {
  if (!modulo) {
    modulo = import('./pdf.js').then(async (m) => {
      await m.prepararPdf();
      return m;
    });
    modulo.catch(() => {
      modulo = null;
    });
  }
  return modulo;
}

// chamado quando o site abre (sem atrapalhar o carregamento da tela)
export function preCarregarLeitor() {
  const ir = () => carregar().catch(() => {});
  if ('requestIdleCallback' in window) window.requestIdleCallback(ir, { timeout: 4000 });
  else setTimeout(ir, 2000);
}

export async function textoDoPdf(arquivo, aoProgredir) {
  let m;
  try {
    m = await carregar();
  } catch (e) {
    throw new Error(ehFalhaDeCarga(e) ? MSG_ATUALIZADA : 'Não foi possível abrir o leitor de PDF: ' + e.message);
  }
  try {
    return await m.textoDoPdf(arquivo, aoProgredir);
  } catch (e) {
    if (ehFalhaDeCarga(e)) throw new Error(MSG_ATUALIZADA);
    if (/password/i.test(e?.name + e?.message)) throw new Error('Este PDF está protegido por senha. Salve uma cópia sem senha e tente de novo.');
    if (/Invalid PDF|InvalidPDF/i.test(e?.name + e?.message)) throw new Error('O arquivo não é um PDF válido ou está corrompido. Baixe o edital de novo no site da banca.');
    throw e;
  }
}
