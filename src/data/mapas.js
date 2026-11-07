// Mapas mentais por disciplina. Cada nó: { t: título, n: nota curta, assunto?: liga às questões, c?: filhos }.
// Um mapa de disciplina comum vale para todos os concursos que tenham essa disciplina.

export const MAPAS = {
  'Direito Constitucional': {
    c: [
      {
        t: 'Direitos e garantias fundamentais (art. 5º)',
        n: 'Cláusulas pétreas (art. 60, § 4º, IV). Aplicação imediata (§ 1º).',
        c: [
          {
            t: 'Inviolabilidade do domicílio',
            assunto: 'Inviolabilidade do domicílio',
            n: 'Art. 5º, XI. Sem consentimento: flagrante, desastre ou socorro → a qualquer hora; ordem judicial → só durante o dia.',
          },
          { t: 'Sigilo das comunicações', n: 'Art. 5º, XII. Telefônica: só por ordem judicial, para investigação criminal ou instrução processual penal (Lei 9.296/1996).' },
          { t: 'Prisão', n: 'Art. 5º, LXI: só em flagrante ou por ordem escrita e fundamentada de juiz. LXII: comunicação imediata ao juiz e à família. LXIII: direito ao silêncio.' },
          { t: 'Provas ilícitas', n: 'Art. 5º, LVI: inadmissíveis no processo. Teoria dos frutos da árvore envenenada (CPP, art. 157, § 1º).' },
          { t: 'Presunção de inocência', n: 'Art. 5º, LVII: ninguém será considerado culpado até o trânsito em julgado.' },
        ],
      },
      {
        t: 'Remédios constitucionais',
        n: 'Mnemônico: "HC liberdade, HD dados, MS direito líquido e certo".',
        c: [
          { t: 'Habeas corpus', n: 'Art. 5º, LXVIII: violência ou coação na liberdade de locomoção. Gratuito; qualquer pessoa impetra.' },
          { t: 'Habeas data', n: 'Art. 5º, LXXII: conhecer ou retificar informações pessoais em bancos de dados públicos.' },
          { t: 'Mandado de segurança', n: 'Art. 5º, LXIX: direito líquido e certo não amparado por HC ou HD. Prazo: 120 dias (Lei 12.016/2009).' },
        ],
      },
      {
        t: 'Segurança pública (art. 144)',
        n: 'Dever do Estado, direito e responsabilidade de todos.',
        c: [
          { t: 'Polícias civis', n: 'Art. 144, § 4º: dirigidas por delegados de carreira; funções de polícia judiciária e apuração de infrações penais, exceto as militares.' },
          { t: 'Subordinação', n: 'Art. 144, § 6º: polícias civis subordinam-se aos Governadores dos Estados.' },
          { t: 'Órgãos', n: 'PF, PRF, PFF, polícias civis, polícias militares e corpos de bombeiros, polícias penais.' },
        ],
      },
      {
        t: 'Administração Pública (art. 37)',
        n: 'Princípios: LIMPE – Legalidade, Impessoalidade, Moralidade, Publicidade, Eficiência.',
        c: [
          { t: 'Concurso público', n: 'Art. 37, II: exigido para cargo efetivo; validade de até 2 anos, prorrogável uma vez por igual período (III).' },
          { t: 'Improbidade', n: 'Art. 37, § 4º; Lei 8.429/1992, com as alterações da Lei 14.230/2021 (exige dolo).' },
        ],
      },
    ],
  },

  'Raciocínio Lógico': {
    c: [
      {
        t: 'Proposições e conectivos',
        n: 'Proposição = frase declarativa que admite V ou F. Perguntas, ordens e exclamações não são proposições.',
        c: [
          { t: 'Conjunção (p ∧ q)', n: 'Só é V se ambas forem V.' },
          { t: 'Disjunção (p ∨ q)', n: 'Só é F se ambas forem F.' },
          { t: 'Condicional (p → q)', n: 'Só é F em V → F ("Vera Fischer").' },
          { t: 'Bicondicional (p ↔ q)', n: 'V quando ambas têm o mesmo valor.' },
        ],
      },
      {
        t: 'Negação de proposições',
        assunto: 'Negação de proposições',
        n: 'Troca o conectivo e nega as partes (De Morgan).',
        c: [
          { t: '¬(p ∧ q)', n: '≡ ¬p ∨ ¬q' },
          { t: '¬(p ∨ q)', n: '≡ ¬p ∧ ¬q' },
          { t: '¬(p → q)', n: '≡ p ∧ ¬q — "mantém a primeira E nega a segunda".' },
          { t: 'Todo / algum', n: '¬(Todo A é B) ≡ Algum A não é B; ¬(Nenhum A é B) ≡ Algum A é B.' },
        ],
      },
      {
        t: 'Equivalências da condicional',
        n: 'p → q ≡ ¬q → ¬p (contrapositiva) ≡ ¬p ∨ q. A inversa (¬p → ¬q) NÃO é equivalente.',
      },
      {
        t: 'Análise combinatória',
        assunto: 'Análise combinatória',
        n: 'A ordem importa? Sim → arranjo/permutação. Não → combinação.',
        c: [
          { t: 'Princípio multiplicativo', n: 'Etapas sucessivas e independentes: multiplica as possibilidades.' },
          { t: 'Permutação', n: 'Pn = n!. Com repetição: n! / (a! b! …).' },
          { t: 'Arranjo', n: 'A(n,p) = n! / (n − p)!' },
          { t: 'Combinação', n: 'C(n,p) = n! / [p! (n − p)!]. Equipes, comissões, grupos.' },
        ],
      },
    ],
  },

  Arquivologia: {
    c: [
      {
        t: 'Teoria das três idades',
        assunto: 'Teoria das três idades',
        n: 'Lei 8.159/1991, art. 8º.',
        c: [
          { t: 'Corrente (1ª idade)', n: 'Uso frequente; próximo ao produtor; valor primário (administrativo).' },
          { t: 'Intermediário (2ª idade)', n: 'Uso eventual; aguarda prazo de guarda para eliminação ou recolhimento.' },
          { t: 'Permanente (3ª idade)', n: 'Valor secundário (histórico, probatório, informativo); guarda definitiva; inalienável e imprescritível.' },
        ],
      },
      {
        t: 'Princípios arquivísticos',
        assunto: 'Princípios arquivísticos',
        n: 'Mnemônico "POOCI": Proveniência, Ordem original, Organicidade, Cumulatividade, Indivisibilidade.',
        c: [
          { t: 'Proveniência', n: 'Respeito aos fundos: não misturar documentos de entidades diferentes.' },
          { t: 'Ordem original', n: 'Manter a organização dada pelo produtor.' },
          { t: 'Organicidade', n: 'Os documentos refletem as funções e atividades da entidade.' },
          { t: 'Indivisibilidade', n: 'O fundo não deve ser disperso, alienado ou destruído sem autorização.' },
          { t: 'Cumulatividade', n: 'O arquivo se forma de modo natural e progressivo.' },
        ],
      },
      {
        t: 'Gestão de documentos',
        n: 'Produção, tramitação, uso, avaliação e arquivamento (Lei 8.159/1991, art. 3º).',
        c: [
          { t: 'Tabela de temporalidade', n: 'Define prazos de guarda e destinação (eliminação ou guarda permanente).' },
          { t: 'Classificação', n: 'Plano de classificação por funções e atividades (método funcional).' },
        ],
      },
    ],
  },

  Estatística: {
    c: [
      {
        t: 'Medidas de tendência central',
        assunto: 'Medidas de tendência central',
        n: 'Sempre ordene os dados antes de achar a mediana.',
        c: [
          { t: 'Média', n: 'Soma ÷ n. Sensível a valores extremos.' },
          { t: 'Mediana', n: 'Termo central (n ímpar) ou média dos dois centrais (n par).' },
          { t: 'Moda', n: 'Valor mais frequente; pode haver mais de uma (bimodal) ou nenhuma (amodal).' },
        ],
      },
      {
        t: 'Medidas de dispersão',
        assunto: 'Medidas de dispersão',
        n: 'Quanto os dados se afastam da média.',
        c: [
          { t: 'Variância populacional', n: 'σ² = Σ(xi − μ)² / N.' },
          { t: 'Variância amostral', n: 's² = Σ(xi − x̄)² / (n − 1).' },
          { t: 'Desvio-padrão', n: 'Raiz quadrada da variância; mesma unidade dos dados.' },
          { t: 'Coeficiente de variação', n: 'CV = desvio-padrão ÷ média (dispersão relativa).' },
        ],
      },
      {
        t: 'Probabilidade',
        assunto: 'Probabilidade',
        n: 'P = casos favoráveis ÷ casos possíveis.',
        c: [
          { t: 'União ("ou")', n: 'P(A ∪ B) = P(A) + P(B) − P(A ∩ B).' },
          { t: 'Interseção ("e"), independentes', n: 'P(A ∩ B) = P(A) × P(B).' },
          { t: 'Complementar', n: 'P(não A) = 1 − P(A). Útil para "pelo menos um".' },
        ],
      },
    ],
  },

  'Noções de Identificação e Papiloscopia': {
    c: [
      {
        t: 'Postulados da papiloscopia',
        assunto: 'Postulados da papiloscopia',
        n: 'Fundamentam a identificação pelas cristas papilares.',
        c: [
          { t: 'Perenidade', n: 'Os desenhos existem desde a vida intrauterina (por volta do 6º mês) até a decomposição cadavérica.' },
          { t: 'Imutabilidade', n: 'Não mudam de forma ao longo da vida, salvo lesões que atinjam a derme.' },
          { t: 'Variabilidade', n: 'Únicos: diferem de pessoa para pessoa e de dedo para dedo, inclusive em gêmeos idênticos.' },
          { t: 'Classificabilidade', n: 'Podem ser classificados e arquivados, o que permite a busca em grandes acervos.' },
        ],
      },
      {
        t: 'Sistema de Vucetich – tipos fundamentais',
        assunto: 'Sistema datiloscópico de Vucetich',
        n: 'Polegares: A, I, E, V. Demais dedos: 1, 2, 3, 4.',
        c: [
          { t: 'Arco (A / 1)', n: 'Sem delta (adelto); linhas atravessam o campo de um lado a outro.' },
          { t: 'Presilha interna (I / 2)', n: 'Um delta à DIREITA do observador; núcleo voltado para a esquerda.' },
          { t: 'Presilha externa (E / 3)', n: 'Um delta à ESQUERDA do observador; núcleo voltado para a direita.' },
          { t: 'Verticilo (V / 4)', n: 'Dois deltas; núcleo de linhas circulares, espirais ou ovoides.' },
        ],
      },
      {
        t: 'Revelação de impressões latentes',
        assunto: 'Revelação de impressões latentes',
        n: 'Escolha o método pela superfície.',
        c: [
          { t: 'Superfícies porosas (papel)', n: 'Ninidrina (aminoácidos → púrpura de Ruhemann); nitrato de prata (cloretos).' },
          { t: 'Superfícies não porosas (vidro, plástico)', n: 'Pós (comuns, magnéticos, negro de fumo) e cianoacrilato (vapor que polimeriza).' },
          { t: 'Iodo', n: 'Vapor que reage com lipídios; revelação temporária.' },
        ],
      },
      {
        t: 'Identificação criminal',
        assunto: 'Identificação criminal',
        n: 'CF, art. 5º, LVIII: o civilmente identificado não será identificado criminalmente, salvo nas hipóteses da lei (Lei 12.037/2009, art. 3º).',
      },
    ],
  },
};
