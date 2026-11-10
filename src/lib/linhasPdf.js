// Monta as linhas de texto de uma página de PDF a partir dos trechos (posição x, y e largura).
// Separado do leitor para poder ser testado sem o pdf.js.

// junta os trechos de uma coluna em linhas (mesma altura), da de cima para a de baixo
function linhasDaColuna(col) {
  const porY = new Map();
  for (const i of col) {
    const chave = [...porY.keys()].find((y) => Math.abs(y - i.y) <= 2) ?? i.y;
    if (!porY.has(chave)) porY.set(chave, []);
    porY.get(chave).push(i);
  }
  return [...porY.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([y, trechos]) => {
      trechos.sort((a, b) => a.x - b.x);
      let t = '';
      let fim = null;
      for (const tr of trechos) {
        if (fim != null && tr.x - fim > 1.5 && !t.endsWith(' ') && !tr.s.startsWith(' ')) t += ' ';
        t += tr.s;
        fim = tr.x + tr.w;
      }
      return { y, t: t.replace(/\s+/g, ' ').trim() };
    })
    .filter((l) => l.t);
}

const TEM_DATA = /\d{1,2}\s*\/\s*\d{1,2}\s*\/\s*\d{4}/;

// Quadro "Atividade | Datas previstas" (o cronograma no fim do edital): a data fica centralizada na altura da
// atividade, que pode ocupar várias linhas. Devolve uma linha por atividade, já com a data dela.
function tabelaDeDatas(esq, dir) {
  const out = [];
  const iData = dir.findIndex((l) => ehData(l));
  const cabDir = dir.slice(0, iData);
  const yCab = cabDir.length ? cabDir[cabDir.length - 1].y : Infinity;
  for (const l of esq.filter((x) => x.y >= yCab - 2)) out.push(l.t);
  for (const l of cabDir) out.push(l.t);
  // blocos da direita: a data e as observações logo abaixo dela
  const blocos = [];
  for (const l of dir.slice(iData)) {
    if (ehData(l)) blocos.push({ ys: [l.y], data: l.t, obs: [] });
    else if (blocos.length) {
      blocos[blocos.length - 1].obs.push(l.t);
      blocos[blocos.length - 1].ys.push(l.y);
    }
  }
  // atividades: cada uma começa com letra maiúscula; as linhas seguintes (minúsculas ou números) são continuação
  const grupos = [];
  for (const l of esq.filter((x) => x.y < yCab - 2)) {
    if (!grupos.length || /^\p{Lu}/u.test(l.t)) grupos.push({ ys: [l.y], t: l.t });
    else {
      const g = grupos[grupos.length - 1];
      g.ys.push(l.y);
      g.t += ' ' + l.t;
    }
  }
  const centro = (ys) => (ys[0] + ys[ys.length - 1]) / 2;
  // a primeira linha em minúscula é o fim de uma atividade que começou na página anterior (sem data própria)
  const resto = grupos.length === blocos.length + 1 && grupos[0] && !/^\p{Lu}/u.test(grupos[0].t) ? 1 : 0;
  const emOrdem = grupos.length - resto === blocos.length;
  const usados = new Set();
  grupos.forEach((g, i) => {
    let b = null;
    if (emOrdem) b = i >= resto ? blocos[i - resto] : null;
    else {
      // quantidades diferentes: usa a data cujo bloco fica na mesma altura da atividade
      b = blocos.filter((x) => !usados.has(x)).sort((p, q) => Math.abs(centro(p.ys) - centro(g.ys)) - Math.abs(centro(q.ys) - centro(g.ys)))[0];
      if (b && Math.abs(centro(b.ys) - centro(g.ys)) > 30) b = null;
    }
    if (b) usados.add(b);
    out.push(b ? `${g.t} ${b.data}` : g.t);
    if (b?.obs.length) out.push(b.obs.join(' '));
  });
  return out;
}
const ehData = (l) => TEM_DATA.test(l.t) && l.t.length < 45;

// Linhas de uma página, na ordem de leitura. itens = [{ x, y, w, s }]
// estado.tabela: a página anterior terminou num quadro de datas (o quadro pode continuar nesta)
export function linhasDaPagina(itens, largura, estado = {}) {
  // colunas: se a página tem 2 colunas, lê a esquerda e depois a direita
  const meio = largura / 2;
  const cruza = (i) => i.x < meio - 10 && i.x + i.w > meio + 10;
  const cruzaMeio = itens.filter(cruza).length;
  const duasColunas = itens.length > 40 && cruzaMeio < itens.length * 0.08 && itens.some((i) => i.x > meio + 5) && itens.some((i) => i.x < meio - 40);
  const datasDir = linhasDaColuna(itens.filter((i) => i.x >= meio)).filter(ehData);
  const todasDir = linhasDaColuna(itens.filter((i) => i.x >= meio));
  // quadro de datas: a coluna da direita é feita de datas e, na altura delas, quase nada atravessa o meio da página
  const yDatas = datasDir.map((l) => l.y);
  const noQuadro = itens.filter((i) => cruza(i) && i.y <= Math.max(...yDatas) + 2 && i.y >= Math.min(...yDatas) - 2).length;
  const temEsq = itens.some((i) => i.x < meio - 40);
  const ehTabela =
    temEsq && noQuadro <= 1 && ((datasDir.length >= 3 && datasDir.length >= todasDir.length * 0.2) || (estado.tabela && datasDir.length >= 1));
  estado.tabela = ehTabela;
  if (ehTabela) {
    // o quadro termina pouco abaixo da última data; linhas de largura total depois dela (notas de rodapé) ficam fora
    const yUltima = Math.min(...datasDir.map((l) => l.y));
    const yNotas = Math.max(-Infinity, ...itens.filter((i) => cruza(i) && i.y < yUltima).map((i) => i.y));
    const corte = Math.max(yUltima - 75, yNotas);
    const dentro = itens.filter((i) => i.y > corte + 2);
    const fora = itens.filter((i) => i.y <= corte + 2);
    return [...tabelaDeDatas(linhasDaColuna(dentro.filter((i) => i.x < meio)), linhasDaColuna(dentro.filter((i) => i.x >= meio))), ...linhasDaColuna(fora).map((l) => l.t)];
  }
  if (!duasColunas) return linhasDaColuna(itens).map((l) => l.t);
  return [...linhasDaColuna(itens.filter((i) => i.x < meio)), ...todasDir].map((l) => l.t);
}
