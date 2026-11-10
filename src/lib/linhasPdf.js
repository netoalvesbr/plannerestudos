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
  const iData = dir.findIndex((l) => TEM_DATA.test(l.t));
  const cabDir = dir.slice(0, iData);
  const yCab = cabDir.length ? cabDir[cabDir.length - 1].y : Infinity;
  for (const l of esq.filter((x) => x.y >= yCab - 2)) out.push(l.t);
  for (const l of cabDir) out.push(l.t);
  // blocos da direita: a data e as observações logo abaixo dela
  const blocos = [];
  for (const l of dir.slice(iData)) {
    if (TEM_DATA.test(l.t) && l.t.length < 45) blocos.push({ y: l.y, data: l.t, obs: [] });
    else if (blocos.length) blocos[blocos.length - 1].obs.push(l.t);
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
  const usados = new Set();
  grupos.forEach((g, i) => {
    let b = blocos.length === grupos.length ? blocos[i] : null;
    if (!b) {
      // quantidades diferentes: usa a data mais próxima da altura do meio da atividade
      const meio = (g.ys[0] + g.ys[g.ys.length - 1]) / 2;
      b = blocos.filter((x) => !usados.has(x)).sort((p, q) => Math.abs(p.y - meio) - Math.abs(q.y - meio))[0];
      if (b && Math.abs(b.y - meio) > 40) b = null;
    }
    if (b) usados.add(b);
    out.push(b ? `${g.t} ${b.data}` : g.t);
    if (b?.obs.length) out.push(b.obs.join(' '));
  });
  return out;
}

// Linhas de uma página, na ordem de leitura. itens = [{ x, y, w, s }]
export function linhasDaPagina(itens, largura) {
  // colunas: se a página tem 2 colunas, lê a esquerda e depois a direita
  const meio = largura / 2;
  const cruzaMeio = itens.filter((i) => i.x < meio - 10 && i.x + i.w > meio + 10).length;
  const duasColunas = itens.length > 40 && cruzaMeio < itens.length * 0.08 && itens.some((i) => i.x > meio + 5) && itens.some((i) => i.x < meio - 40);
  if (!duasColunas) return linhasDaColuna(itens).map((l) => l.t);
  const esq = linhasDaColuna(itens.filter((i) => i.x < meio));
  const dir = linhasDaColuna(itens.filter((i) => i.x >= meio));
  const nDatas = dir.filter((l) => TEM_DATA.test(l.t) && l.t.length < 45).length;
  if (nDatas >= 3 && nDatas >= dir.length * 0.2) return tabelaDeDatas(esq, dir);
  return [...esq, ...dir].map((l) => l.t);
}
