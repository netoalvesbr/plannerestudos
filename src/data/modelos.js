// Modelos prontos de concursos com fases. Aplicados na tela "Adicionar concurso".

const slug = (t) =>
  t
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '');
const chave = (t) => (t || '').toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N} ]/gu, '');

// OAB – Exame de Ordem Unificado (FGV)
// 2ª fase: o candidato escolhe UMA área; a prova cobra o direito material e o respectivo direito processual.
export const AREAS_OAB = [
  { nome: 'Direito Administrativo', chaves: ['administrativ'] },
  { nome: 'Direito Civil', chaves: ['civil'] },
  { nome: 'Direito Constitucional', chaves: ['constitucional'] },
  { nome: 'Direito Empresarial', chaves: ['empresarial'] },
  { nome: 'Direito Penal', chaves: ['penal'] },
  { nome: 'Direito do Trabalho', chaves: ['trabalh'] },
  { nome: 'Direito Tributário', chaves: ['tributari'] },
];

// usadas só quando o edital não foi importado (o usuário pode ajustar)
const DISCIPLINAS_OAB_1 = [
  'Ética Profissional', 'Filosofia do Direito', 'Direito Constitucional', 'Direitos Humanos', 'Direito Eleitoral',
  'Direito Internacional', 'Direito Financeiro', 'Direito Tributário', 'Direito Administrativo', 'Direito Ambiental',
  'Direito Civil', 'Direito do Consumidor', 'Estatuto da Criança e do Adolescente', 'Direito Empresarial',
  'Direito Processual Civil', 'Direito Penal', 'Direito Processual Penal', 'Direito Previdenciário',
  'Direito do Trabalho', 'Direito Processual do Trabalho',
];

export function aplicarModeloOAB(c, datas = {}) {
  const f1 = c.fases?.find((f) => /1/.test(f.nome)) || {};
  const f2 = c.fases?.find((f) => /2/.test(f.nome)) || {};
  const fases = [
    { id: f1.id || 'f1', nome: '1ª fase – Prova objetiva', formato: 'A-D', data: f1.data || datas.primeira || c.dataProva || '' },
    {
      id: f2.id || 'f2',
      nome: '2ª fase – Prova prático-profissional',
      formato: 'discursiva',
      data: f2.data || datas.segunda || '',
      areas: AREAS_OAB.map((a) => ({ id: slug(a.nome), nome: a.nome })),
    },
  ];

  // disciplinas já lidas do edital (sem fase) ficam na 1ª fase
  const lidas = (c.disciplinas || []).filter((d) => !d.area);
  const base = lidas.length
    ? lidas.map((d) => ({ ...d, fase: d.fase && d.fase !== fases[1].id ? d.fase : 'f1' }))
    : DISCIPLINAS_OAB_1.map((nome) => ({ nome, bloco: '', fase: fases[0].id, topicos: [], topicosTxt: '' }));
  const primeira = base.map((d) => ({ ...d, fase: fases[0].id }));

  // 2ª fase: uma disciplina por área, reunindo os tópicos do direito material e do processual correspondente
  const segunda = AREAS_OAB.map((a) => {
    const topicos = [];
    for (const d of lidas) {
      const k = chave(d.nome);
      if (!a.chaves.some((x) => k.includes(x))) continue;
      const proc = /process/.test(k);
      const tps = d.topicos?.length ? d.topicos : (d.topicosTxt || '').split('\n').filter(Boolean);
      tps.forEach((t) => topicos.push(proc ? `${d.nome}: ${t}` : t));
    }
    return {
      nome: a.nome,
      bloco: '2ª fase',
      fase: fases[1].id,
      area: slug(a.nome),
      topicos,
      topicosTxt: topicos.join('\n'),
    };
  });

  return {
    ...c,
    sigla: c.sigla || 'OAB',
    nome: c.nome || 'Exame de Ordem Unificado – OAB',
    orgao: c.orgao || 'Ordem dos Advogados do Brasil',
    banca: !c.banca || /objetiva/i.test(c.banca) ? 'FGV' : c.banca,
    formato: 'A-D',
    dataProva: fases[0].data || c.dataProva,
    fases,
    disciplinas: [...primeira, ...segunda],
  };
}

export const ehOAB = (c) => /\bOAB\b|ordem dos advogados|exame de ordem/i.test(`${c.sigla} ${c.nome} ${c.orgao}`);
