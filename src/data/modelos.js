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

// Tópicos sugeridos (base para o edital verticalizado quando o edital não traz o conteúdo detalhado)
export const SUGESTOES_OAB = {
  'Ética Profissional': ['Estatuto da Advocacia e da OAB (Lei 8.906/1994)', 'Regulamento Geral', 'Código de Ética e Disciplina', 'Atividade da advocacia', 'Direitos e prerrogativas do advogado', 'Inscrição na OAB', 'Sociedade de advogados', 'Advogado empregado', 'Honorários advocatícios', 'Incompatibilidades e impedimentos', 'Infrações e sanções disciplinares', 'Processo disciplinar', 'Órgãos da OAB e eleições'],
  'Filosofia do Direito': ['Justiça em Aristóteles', 'Jusnaturalismo', 'Contratualistas (Hobbes, Locke, Rousseau)', 'Utilitarismo', 'Positivismo jurídico (Kelsen e Hart)', 'Teoria da justiça de Rawls', 'Pós-positivismo (Dworkin e Alexy)', 'Hermenêutica e interpretação do direito'],
  'Direito Constitucional': ['Teoria da Constituição e poder constituinte', 'Princípios fundamentais', 'Direitos e garantias fundamentais', 'Remédios constitucionais', 'Nacionalidade e direitos políticos', 'Organização do Estado', 'Poder Legislativo e processo legislativo', 'Poder Executivo', 'Poder Judiciário e funções essenciais à Justiça', 'Controle de constitucionalidade', 'Ordem social e ordem econômica'],
  'Direitos Humanos': ['Teoria geral dos direitos humanos', 'Sistema global de proteção (ONU)', 'Sistema interamericano (Convenção Americana e Corte IDH)', 'Incorporação dos tratados de direitos humanos (art. 5º, §§ 2º e 3º, CF)', 'Proteção de grupos vulneráveis'],
  'Direito Eleitoral': ['Direitos políticos', 'Partidos políticos', 'Alistamento eleitoral', 'Inelegibilidades (LC 64/1990)', 'Propaganda eleitoral', 'Crimes eleitorais', 'Ações eleitorais'],
  'Direito Internacional': ['Fontes do direito internacional público', 'Tratados internacionais', 'Lei de Migração e condição jurídica do estrangeiro', 'Direito internacional privado (LINDB)', 'Cooperação jurídica internacional', 'Homologação de sentença estrangeira'],
  'Direito Financeiro': ['Princípios orçamentários', 'Leis orçamentárias (PPA, LDO e LOA)', 'Receita e despesa pública', 'Lei de Responsabilidade Fiscal', 'Precatórios'],
  'Direito Tributário': ['Sistema Tributário Nacional e competência tributária', 'Limitações ao poder de tributar', 'Espécies tributárias', 'Obrigação tributária', 'Crédito tributário e lançamento', 'Suspensão, extinção e exclusão do crédito', 'Responsabilidade tributária', 'Garantias e privilégios do crédito', 'Impostos federais, estaduais e municipais', 'Processo administrativo e execução fiscal'],
  'Direito Administrativo': ['Princípios da Administração Pública', 'Organização administrativa', 'Poderes administrativos', 'Atos administrativos', 'Licitações (Lei 14.133/2021)', 'Contratos administrativos', 'Serviços públicos', 'Agentes públicos', 'Responsabilidade civil do Estado', 'Improbidade administrativa (Lei 8.429/1992, com a Lei 14.230/2021)', 'Intervenção do Estado na propriedade', 'Bens públicos', 'Processo administrativo (Lei 9.784/1999)'],
  'Direito Ambiental': ['Princípios do direito ambiental', 'Competências ambientais', 'Política Nacional do Meio Ambiente', 'Licenciamento ambiental e EIA/RIMA', 'Unidades de conservação (SNUC)', 'Código Florestal', 'Responsabilidade ambiental civil, administrativa e penal'],
  'Direito Civil': ['LINDB', 'Pessoas naturais e jurídicas', 'Bens', 'Negócio jurídico', 'Prescrição e decadência', 'Obrigações', 'Contratos em geral', 'Contratos em espécie', 'Responsabilidade civil', 'Direitos reais', 'Direito de família', 'Direito das sucessões'],
  'Direito do Consumidor': ['Relação de consumo', 'Direitos básicos do consumidor', 'Responsabilidade pelo fato e pelo vício', 'Prescrição e decadência', 'Práticas comerciais e publicidade', 'Proteção contratual', 'Defesa do consumidor em juízo'],
  'Estatuto da Criança e do Adolescente': ['Princípios e direitos fundamentais', 'Medidas de proteção', 'Família substituta e adoção', 'Ato infracional e medidas socioeducativas', 'Conselho Tutelar', 'Acesso à Justiça e crimes'],
  'Direito Empresarial': ['Empresário, estabelecimento e registro', 'Sociedades empresárias', 'Títulos de crédito', 'Propriedade industrial', 'Contratos empresariais', 'Recuperação judicial e extrajudicial', 'Falência'],
  'Direito Processual Civil': ['Normas fundamentais', 'Jurisdição e competência', 'Partes, procuradores e intervenção de terceiros', 'Atos processuais e prazos', 'Tutela provisória', 'Procedimento comum', 'Provas', 'Sentença e coisa julgada', 'Cumprimento de sentença', 'Processo de execução', 'Procedimentos especiais', 'Recursos', 'Processos nos tribunais'],
  'Direito Penal': ['Aplicação da lei penal', 'Teoria do crime', 'Concurso de pessoas', 'Penas e aplicação da pena', 'Extinção da punibilidade', 'Crimes contra a pessoa', 'Crimes contra o patrimônio', 'Crimes contra a dignidade sexual', 'Crimes contra a Administração Pública', 'Legislação penal especial'],
  'Direito Processual Penal': ['Princípios e aplicação da lei processual penal', 'Inquérito policial', 'Ação penal', 'Competência', 'Provas', 'Prisões e medidas cautelares', 'Procedimentos', 'Tribunal do Júri', 'Nulidades', 'Recursos', 'Habeas corpus e revisão criminal', 'Execução penal'],
  'Direito Previdenciário': ['Seguridade social', 'Segurados e dependentes', 'Custeio', 'Benefícios do RGPS', 'Carência e salário de benefício', 'Aposentadorias', 'Reforma da Previdência (EC 103/2019)'],
  'Direito do Trabalho': ['Princípios do direito do trabalho', 'Relação de emprego e sujeitos', 'Contrato de trabalho', 'Jornada e intervalos', 'Remuneração e salário', 'Férias', 'Estabilidades', 'Extinção do contrato e verbas rescisórias', 'FGTS', 'Direito coletivo do trabalho'],
  'Direito Processual do Trabalho': ['Organização e competência da Justiça do Trabalho', 'Partes e procuradores', 'Procedimentos ordinário, sumário e sumaríssimo', 'Audiência e provas', 'Sentença', 'Recursos trabalhistas', 'Execução trabalhista', 'Ações especiais'],
};

const DISCIPLINAS_OAB_1 = Object.keys(SUGESTOES_OAB);

// 2ª fase: direito material + processual correspondente + peças mais cobradas
const SEGUNDA_FASE = {
  'Direito Administrativo': { base: ['Direito Administrativo'], pecas: ['Mandado de segurança', 'Ação popular', 'Ação de procedimento comum contra a Fazenda', 'Contestação', 'Apelação e agravo de instrumento'] },
  'Direito Civil': { base: ['Direito Civil', 'Direito Processual Civil'], pecas: ['Petição inicial', 'Contestação', 'Apelação', 'Agravo de instrumento', 'Embargos de declaração'] },
  'Direito Constitucional': { base: ['Direito Constitucional'], pecas: ['Mandado de segurança', 'Habeas data e mandado de injunção', 'Ação popular', 'ADI, ADC e ADPF', 'Recurso ordinário constitucional', 'Recurso extraordinário', 'Recurso especial'] },
  'Direito Empresarial': { base: ['Direito Empresarial', 'Direito Processual Civil'], pecas: ['Petição inicial', 'Contestação', 'Pedido de recuperação judicial e de falência', 'Habilitação e impugnação de crédito', 'Apelação e agravo de instrumento'] },
  'Direito Penal': { base: ['Direito Penal', 'Direito Processual Penal'], pecas: ['Resposta à acusação', 'Memoriais', 'Apelação', 'Recurso em sentido estrito', 'Habeas corpus', 'Revisão criminal'] },
  'Direito do Trabalho': { base: ['Direito do Trabalho', 'Direito Processual do Trabalho'], pecas: ['Reclamação trabalhista', 'Contestação', 'Recurso ordinário', 'Recurso de revista', 'Embargos à execução'] },
  'Direito Tributário': { base: ['Direito Tributário'], pecas: ['Mandado de segurança', 'Ação anulatória', 'Ação declaratória', 'Ação de repetição de indébito', 'Embargos à execução fiscal', 'Exceção de pré-executividade'] },
};

const igual = (a, b) => chave(a).replace(/\s+/g, ' ').trim() === chave(b).replace(/\s+/g, ' ').trim();

export function aplicarModeloOAB(c, datas = {}) {
  const f1 = c.fases?.find((f) => /1/.test(f.nome)) || {};
  const f2 = c.fases?.find((f) => /2/.test(f.nome)) || {};
  const fases = [
    { id: 'f1', nome: '1ª fase – Prova objetiva', formato: 'A-D', data: datas.primeira || f1.data || c.dataProva || '' },
    {
      id: 'f2',
      nome: '2ª fase – Prova prático-profissional',
      formato: 'discursiva',
      data: datas.segunda || f2.data || '',
      areas: AREAS_OAB.map((a) => ({ id: slug(a.nome), nome: a.nome })),
    },
  ];

  // tópicos lidos do edital, quando houver, têm prioridade sobre os sugeridos
  const lidas = (c.disciplinas || []).filter((d) => !d.area && d.fase !== 'f2');
  const topicosDe = (nome) => {
    const d = lidas.find((x) => igual(x.nome, nome));
    const t = d ? (d.topicos?.length ? d.topicos : (d.topicosTxt || '').split('\n').filter(Boolean)) : [];
    return t.length ? t : SUGESTOES_OAB[nome] || [];
  };

  const primeira = DISCIPLINAS_OAB_1.map((nome) => {
    const topicos = topicosDe(nome);
    return { nome, bloco: '1ª fase', fase: 'f1', topicos, topicosTxt: topicos.join('\n') };
  });
  const segunda = AREAS_OAB.map((a) => {
    const cfg = SEGUNDA_FASE[a.nome];
    const topicos = [
      ...cfg.base.flatMap((b, k) => topicosDe(b).map((t) => (k > 0 ? `${b}: ${t}` : t))),
      ...cfg.pecas.map((p) => `Peça: ${p}`),
    ];
    return { nome: a.nome, bloco: '2ª fase', fase: 'f2', area: slug(a.nome), topicos, topicosTxt: topicos.join('\n') };
  });

  return {
    ...c,
    sigla: c.sigla || 'OAB',
    nome: /exame/i.test(c.nome || '') ? c.nome : 'Exame de Ordem Unificado – OAB',
    orgao: 'Ordem dos Advogados do Brasil',
    banca: !c.banca || /objetiva/i.test(c.banca) ? 'FGV' : c.banca,
    formato: 'A-D',
    dataProva: fases[0].data || c.dataProva,
    fases,
    modelo: 'oab',
    disciplinas: [...primeira, ...segunda],
  };
}

export const ehOAB = (c) => /\bOAB\b|ordem dos advogados|exame de ordem/i.test(`${c.sigla} ${c.nome} ${c.orgao}`);

// Repescagem da OAB (reaproveitamento da 1ª fase): quem passou na 1ª fase e não na 2ª
// faz só a 2ª fase do exame seguinte. O edital do novo exame atualiza as datas.
const SO_PRIMEIRA = /(objetiva|1[ªa] fase|primeira fase)/i;
const DA_SEGUNDA = /(reaproveit|repescagem|2[ªa] fase|segunda fase|pr[áa]tico|discursiva)/i;

export function eventosRepescagem(r) {
  return (r.cronograma || [])
    .filter((e) => !SO_PRIMEIRA.test(e.evento) || DA_SEGUNDA.test(e.evento))
    .map((e) => ({ ...e, exame: r.sigla || 'novo exame' }));
}

export function aplicarRepescagem(c, r, editalUrl = null, exameOriginal = null) {
  const hoje = new Date().toLocaleDateString('sv-SE');
  const segunda = r.datasFases?.segunda || null;
  const anterior = exameOriginal || c.repescagem?.exameOriginal || c.sigla;
  // mantém as datas já passadas do exame original (histórico) e troca as futuras pelas do novo edital
  const antigos = (c.cronograma || []).filter((e) => e.data < hoje && !e.exame);
  const novos = eventosRepescagem(r);
  const cronograma = [...antigos, ...novos].sort((a, b) => a.data.localeCompare(b.data));
  return {
    ...c,
    dataProva: segunda || c.dataProva,
    cronograma,
    fases: (c.fases || []).map((f) =>
      f.id === 'f1' ? { ...f, concluida: true, situacao: `Aprovado no ${anterior} (reaproveitada)` } : f.id === 'f2' ? { ...f, data: segunda || f.data } : f,
    ),
    repescagem: { exame: r.sigla || '', nome: r.nome || '', data: segunda, editalUrl: editalUrl || null, exameOriginal: anterior, em: hoje },
  };
}
