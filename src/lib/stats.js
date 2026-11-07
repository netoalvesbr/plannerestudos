// Cálculos de desempenho a partir das respostas { uid: [letra, acertou, ts, segundos] }.

const DIA = 86400000;
export const inicioDoDia = (t = Date.now()) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

export const PERIODOS = {
  todo: { nome: 'Todo o período', faixa: () => [0, Infinity] },
  hoje: { nome: 'Hoje', faixa: () => [inicioDoDia(), Infinity] },
  ontem: { nome: 'Ontem', faixa: () => [inicioDoDia() - DIA, inicioDoDia()] },
  ult7: { nome: 'Últimos 7 dias', faixa: () => [inicioDoDia() - 6 * DIA, Infinity] },
  ant7: { nome: '7 dias anteriores', faixa: () => [inicioDoDia() - 13 * DIA, inicioDoDia() - 6 * DIA] },
  ult30: { nome: 'Últimos 30 dias', faixa: () => [inicioDoDia() - 29 * DIA, Infinity] },
};

export const pct = (c, r) => (r ? c / r : null);
export const fmtPct = (v) => (v == null ? '—' : `${Math.round(v * 100)}%`);

export function resumo(questoes, respostas, periodo = 'todo') {
  const [ini, fim] = PERIODOS[periodo].faixa();
  let r = 0;
  let c = 0;
  for (const q of questoes) {
    const a = respostas[q.uid];
    if (a && a[2] >= ini && a[2] < fim) {
      r++;
      if (a[1]) c++;
    }
  }
  return { resolvidas: r, certas: c, erradas: r - c, pct: pct(c, r), total: questoes.length };
}

// Agrupa por um campo (materia, assunto, bloco, dificuldade)
export function porCampo(questoes, respostas, campo, periodo = 'todo') {
  const grupos = new Map();
  for (const q of questoes) {
    const k = q[campo];
    if (!grupos.has(k)) grupos.set(k, []);
    grupos.get(k).push(q);
  }
  return [...grupos.entries()].map(([chave, qs]) => ({ chave, ...resumo(qs, respostas, periodo) }));
}

export function porDia(questoes, respostas, dias = 14) {
  const hoje = inicioDoDia();
  const set = new Set(questoes.map((q) => q.uid));
  const out = [];
  for (let i = dias - 1; i >= 0; i--) {
    const ini = hoje - i * DIA;
    let c = 0;
    let e = 0;
    for (const [uid, a] of Object.entries(respostas)) {
      if (set.has(uid) && a[2] >= ini && a[2] < ini + DIA) a[1] ? c++ : e++;
    }
    out.push({ data: new Date(ini), certas: c, erradas: e });
  }
  return out;
}

// Estimativa de nota com os pesos oficiais: acerto do bloco × nº de questões × peso
export function estimarNota(concurso, questoes, respostas) {
  if (!concurso?.prova) return null;
  const blocos = concurso.prova.blocos.map((b) => {
    const s = resumo(questoes.filter((q) => q.bloco === b.nome), respostas);
    const pontos = s.pct == null ? null : s.pct * b.questoes * b.peso;
    return { ...b, acerto: s.pct, pontos, max: b.questoes * b.peso };
  });
  const comDados = blocos.filter((b) => b.pontos != null);
  if (!comDados.length) return { blocos, total: null };
  const total = blocos.reduce((s, b) => s + (b.pontos ?? 0), 0);
  const completo = comDados.length === blocos.length;
  return { blocos, total, completo, max: concurso.prova.totalPontos };
}

export function assuntosParaRevisar(questoes, respostas, meta, limite = 12) {
  return porCampo(questoes, respostas, 'assunto')
    .filter((a) => a.resolvidas >= 2 && a.pct < meta)
    .sort((a, b) => a.pct - b.pct)
    .slice(0, limite)
    .map((a) => ({ ...a, materia: questoes.find((q) => q.assunto === a.chave)?.materia }));
}

export const diasAte = (iso) => Math.ceil((new Date(iso + 'T00:00:00') - inicioDoDia()) / DIA);
export const fmtData = (iso) => {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};
export const fmtDiaMes = (iso) => iso.slice(8, 10) + '/' + iso.slice(5, 7);
