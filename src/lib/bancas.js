// Site oficial de cada banca, para abrir direto do card do concurso.
// Só entra aqui endereço conferido (o do próprio edital, quando possível). Banca que não está
// na lista não ganha endereço inventado: o link vira uma busca, que é honesto e não leva a
// site errado — perder a inscrição por causa de um link torto seria um estrago grande.
const SITES = [
  [['idib'], 'https://www.idib.org.br'],
  [['idecan'], 'https://www.idecan.org.br'],
  [['cebraspe', 'cespe'], 'https://www.cebraspe.org.br'],
  [['fgv'], 'https://conhecimento.fgv.br/concursos'],
  [['fcc', 'carlos chagas'], 'https://www.concursosfcc.com.br'],
  [['vunesp'], 'https://www.vunesp.com.br'],
  [['cesgranrio'], 'https://www.cesgranrio.org.br'],
  [['quadrix'], 'https://www.quadrix.org.br'],
  [['consulplan'], 'https://www.consulplan.net'],
  [['ibfc'], 'https://www.ibfc.org.br'],
  [['aocp'], 'https://www.institutoaocp.org.br'],
  [['iades'], 'https://www.iades.com.br'],
  [['fundatec'], 'https://www.fundatec.org.br'],
  [['selecon'], 'https://www.selecon.org.br'],
  [['ibade'], 'https://www.ibade.org.br'],
  [['fundep', 'gestao de concursos'], 'https://www.gestaodeconcursos.com.br'],
  [['fumarc'], 'https://www.fumarc.com.br'],
  [['ieses'], 'https://www.ieses.org'],
];

const chave = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// { url, oficial } — oficial=false quer dizer que o link é uma busca pelo nome da banca
export function siteDaBanca(banca) {
  const n = chave(banca).trim();
  if (!n) return null;
  for (const [nomes, url] of SITES) if (nomes.some((x) => n.includes(x))) return { url, oficial: true };
  return { url: `https://www.google.com/search?q=${encodeURIComponent(`${banca} banca concursos site oficial`)}`, oficial: false };
}
