// Planos de reforço prontos (ex.: cronograma de um curso/cursinho) que o usuário pode
// ativar por cima de um cronograma já criado, dia a dia, sem mudar os blocos gerados
// pelo sistema. "ciclo" é uma lista de tarefas, uma por dia; quando o período ativo é
// mais longo que a lista, ela se repete do início (dá pra cadastrar mais planos aqui
// no futuro, sem mudar nada além desta lista).

export const REFORCOS = [
  {
    id: 'oab-fase2-estrategia-4sem',
    titulo: '📋 Plano Estratégia OAB – 2ª fase (Direito Constitucional, 4 semanas em ciclo)',
    ciclo: [
      // Semana 01
      'Antes de iniciar, leia os capítulos 1 e 2 da Trilha – "Como Estudar e Marcação do Código".',
      'Estude os temas Teoria Geral da Constituição e Teoria Geral dos Direitos Fundamentais. Revisão do material: capítulos 1 e 2.',
      'Estude o tema Direitos Individuais e Coletivos (até Direito de Petição e Certidão). Revisão do material: capítulo 3.1.',
      'Estude o tema Direitos Individuais e Coletivos. Revisão do material: capítulo 3.1.',
      'Estude o tema Remédios Constitucionais. Revisão do material: capítulos 3.2 a 3.2.3.',
      'Estude o tema Remédios Constitucionais (do Princípio da Inafastabilidade do Judiciário até o fim do assunto). Revisão do material: capítulos 3.2.4 a 3.2.6.',
      'Simulado com correção em vídeo.',
      // Semana 02
      'Estude o tema Direitos de Nacionalidade. Revisão do material: capítulo 5.',
      'Estude o tema Direitos Políticos e Partidos Políticos. Revisão do material: capítulos 6 e 7.',
      'Estude Noções Introdutórias + Petição Inicial + MS e APC. Peças prático-profissionais: capítulos 2, 3 e 7.',
      'Estude com foco em HC, AP, ACP e MI. Peças prático-profissionais: capítulo 3.',
      'Estude o tema Organização do Estado e Intervenção. Revisão do material: capítulos 8 e 10.',
      'Ajuste ponderado: se não conseguiu cumprir toda a meta da semana, use este dia como compensação.',
      'Estude o tema Repartição de Competências. Revisão do material: capítulo 9.',
      // Semana 03
      'Ajuste ponderado: se não conseguiu cumprir toda a meta da semana, use este dia como compensação.',
      'Estude o tema Administração Pública. Revisão do material: capítulo 11.',
      'Estude o tema Poder Executivo, Atribuições e Responsabilização do Presidente da República. Revisão do material: capítulo 14.',
      'Estude o tema Processo Legislativo Comum. Revisão do material: capítulo 13.',
      'Estude o tema Processo Legislativo Especial. Revisão do material: capítulo 13.',
      'Resolva a prova do Exame 41.',
      'Simulado com correção individual. Ajuste ponderado: se sobrar tempo, use para compensar o que faltou na semana.',
      // Semana 04
      'Estude o tema Ordem Social (parte 1). Revisão do material: capítulo 18 – parte 1.',
      'Estude o tema Ordem Social (parte 2). Revisão do material: capítulo 18 – parte 2.',
      'Estude o tema Teoria Geral do Controle de Constitucionalidade + Controle Difuso + Apelação. Revisão do material: capítulos 19 e 21. Peças prático-profissionais: capítulo 7.',
      'Estude o tema ADI e Representação de Inconstitucionalidade. Revisão do material: capítulo 20.5.',
      'Estude o tema ADO e ADC. Revisão do material: capítulos 20.3 e 20.4.',
      'Estude o tema ADPF. Revisão do material: capítulo 20.2. Peças prático-profissionais: capítulo 4.6.',
      'Ajuste ponderado: se não conseguiu cumprir toda a meta da semana, use este dia como compensação.',
    ],
  },
];
