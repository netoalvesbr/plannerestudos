// Fichas dos concursos. Para cadastrar um novo concurso, acrescente um objeto
// neste arquivo (mesma estrutura) e as questões em src/data/questoes/.

export const CONCURSOS = [
  {
    id: 'pcac-2026',
    sigla: 'PC/AC',
    nome: 'Polícia Civil do Acre',
    edital: 'Edital nº 001 SEAD/PCAC/2026',
    banca: 'IDECAN',
    formato: 'A-E',
    meta: 0.75,
    dataProva: '2027-01-24',
    inicioProvasDiarias: '2026-11-09',
    cargos: [
      {
        id: 'oi',
        nome: 'Oficial Investigador de Polícia',
        vagas: '74 por município (67 AC + 7 PcD)',
        remuneracao: 'R$ 6.342,07',
        requisitos: 'Nível superior em qualquer área + CNH AB',
        horario: 'Prova das 7h às 12h (portões das 6h às 7h)',
      },
      {
        id: 'pap',
        nome: 'Papiloscopista Policial',
        vagas: '35 por regional (Baixo Acre 14, Juruá 6, Alto Acre 5, Envira 5, Purus 5)',
        remuneracao: 'R$ 6.342,07',
        requisitos: 'Nível superior em qualquer área + CNH AB',
        horario: 'Prova das 13h às 18h (portões das 12h às 13h)',
      },
    ],
    prova: {
      totalQuestoes: 100,
      totalPontos: 160,
      blocos: [
        { nome: 'Conhecimentos Básicos', questoes: 24, peso: 1, minimo: '≥ 1 ponto em cada disciplina' },
        { nome: 'Conhecimentos Jurídicos', questoes: 16, peso: 1, minimo: '≥ 1 ponto em cada disciplina' },
        { nome: 'Conhecimentos Específicos', questoes: 60, peso: 2, minimo: '≥ 2 pontos no bloco' },
      ],
      aprovacao: '≥ 50% dos pontos da objetiva (80 de 160)',
      discursiva: '40 pontos, mínimo de 20',
    },
    cronograma: [
      { data: '2026-11-11', fim: '2026-12-14', evento: 'Inscrições' },
      { data: '2026-11-11', fim: '2026-11-12', evento: 'Pedido de isenção' },
      { data: '2027-01-15', evento: 'Divulgação dos locais de prova' },
      { data: '2027-01-24', evento: 'Prova objetiva e discursiva' },
      { data: '2027-02-24', evento: 'Resultado definitivo da objetiva' },
      { data: '2027-03-10', evento: 'Resultado preliminar da discursiva' },
      { data: '2027-03-22', evento: 'Resultado definitivo da discursiva' },
    ],
    // grupo = agrupamento dos mapas mentais; cargos = para quem a disciplina aparece
    disciplinas: [
      { nome: 'Língua Portuguesa', bloco: 'Conhecimentos Básicos', grupo: 'Conhecimentos Básicos', cargos: ['oi', 'pap'] },
      { nome: 'Raciocínio Lógico', bloco: 'Conhecimentos Básicos', grupo: 'Conhecimentos Básicos', cargos: ['oi', 'pap'] },
      { nome: 'Informática', bloco: 'Conhecimentos Básicos', grupo: 'Conhecimentos Básicos', cargos: ['oi', 'pap'] },
      { nome: 'Realidade do Acre', bloco: 'Conhecimentos Básicos', grupo: 'Conhecimentos Básicos', cargos: ['oi', 'pap'] },
      { nome: 'Direito Constitucional', bloco: 'Conhecimentos Jurídicos', grupo: 'Conhecimentos Jurídicos', cargos: ['oi', 'pap'] },
      { nome: 'Direito Administrativo', bloco: 'Conhecimentos Jurídicos', grupo: 'Conhecimentos Jurídicos', cargos: ['oi', 'pap'] },
      { nome: 'Direito Penal e Processual Penal', bloco: 'Conhecimentos Jurídicos', grupo: 'Conhecimentos Jurídicos', cargos: ['oi', 'pap'] },
      { nome: 'Legislação Institucional', bloco: 'Conhecimentos Jurídicos', grupo: 'Conhecimentos Jurídicos', cargos: ['oi', 'pap'] },
      { nome: 'Contabilidade e Análise Financeira', bloco: 'Conhecimentos Específicos', grupo: 'Específicos – Oficial Investigador', cargos: ['oi'] },
      { nome: 'Estatística', bloco: 'Conhecimentos Específicos', grupo: 'Específicos – Oficial Investigador', cargos: ['oi'] },
      { nome: 'Arquivologia', bloco: 'Conhecimentos Específicos', grupo: 'Específicos – Oficial Investigador', cargos: ['oi'] },
      { nome: 'TI e Segurança da Informação', bloco: 'Conhecimentos Específicos', grupo: 'Específicos – Oficial Investigador', cargos: ['oi'] },
      { nome: 'Análise de Dados', bloco: 'Conhecimentos Específicos', grupo: 'Específicos – Oficial Investigador', cargos: ['oi'] },
      { nome: 'Noções de Administração', bloco: 'Conhecimentos Específicos', grupo: 'Específicos – Oficial Investigador', cargos: ['oi'] },
      { nome: 'Biologia', bloco: 'Conhecimentos Específicos', grupo: 'Específicos – Papiloscopista', cargos: ['pap'] },
      { nome: 'Física', bloco: 'Conhecimentos Específicos', grupo: 'Específicos – Papiloscopista', cargos: ['pap'] },
      { nome: 'Química', bloco: 'Conhecimentos Específicos', grupo: 'Específicos – Papiloscopista', cargos: ['pap'] },
      { nome: 'Noções de Identificação e Papiloscopia', bloco: 'Conhecimentos Específicos', grupo: 'Específicos – Papiloscopista', cargos: ['pap'] },
      { nome: 'Medicina e Odontologia Legal', bloco: 'Conhecimentos Específicos', grupo: 'Específicos – Papiloscopista', cargos: ['pap'] },
      { nome: 'Ciências Forenses', bloco: 'Conhecimentos Específicos', grupo: 'Específicos – Papiloscopista', cargos: ['pap'] },
    ],
  },
];

// Concursos cadastrados pelos usuários (banco compartilhado) – preenchidos em tempo de execução
let REMOTOS = [];
export function registrarConcursos(lista) {
  REMOTOS = lista;
}
export const todosConcursos = () => [...CONCURSOS, ...REMOTOS];
export const getConcurso = (id) => todosConcursos().find((c) => c.id === id);

