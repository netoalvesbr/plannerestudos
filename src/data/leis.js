// Catálogo de leis (texto oficial e atualizado buscado no site do Planalto).
// Agrupado por matéria; a tela lista as matérias em ordem alfabética.
const P = 'https://www.planalto.gov.br/ccivil_03/';

export const LEIS = [
  { id: 'cf', nome: 'Constituição Federal de 1988', curto: 'CF/88', materia: 'Direito Constitucional', url: P + 'constituicao/constituicao.htm' },
  { id: 'l9868', nome: 'Lei 9.868/1999 – ADI, ADC e ADO', materia: 'Direito Constitucional', url: P + 'leis/l9868.htm' },
  { id: 'l12016', nome: 'Lei 12.016/2009 – Mandado de Segurança', materia: 'Direito Constitucional', url: P + '_ato2007-2010/2009/lei/l12016.htm' },

  { id: 'cp', nome: 'Código Penal (Decreto-Lei 2.848/1940)', curto: 'CP', materia: 'Direito Penal', url: P + 'decreto-lei/del2848compilado.htm' },
  { id: 'l8072', nome: 'Lei 8.072/1990 – Crimes Hediondos', materia: 'Direito Penal', url: P + 'leis/l8072.htm' },
  { id: 'l11343', nome: 'Lei 11.343/2006 – Lei de Drogas', materia: 'Direito Penal', url: P + '_ato2004-2006/2006/lei/l11343.htm' },
  { id: 'l10826', nome: 'Lei 10.826/2003 – Estatuto do Desarmamento', materia: 'Direito Penal', url: P + 'leis/2003/l10.826.htm' },
  { id: 'l11340', nome: 'Lei 11.340/2006 – Lei Maria da Penha', materia: 'Direito Penal', url: P + '_ato2004-2006/2006/lei/l11340.htm' },
  { id: 'l13869', nome: 'Lei 13.869/2019 – Abuso de Autoridade', materia: 'Direito Penal', url: P + '_ato2019-2022/2019/lei/l13869.htm' },
  { id: 'l9455', nome: 'Lei 9.455/1997 – Tortura', materia: 'Direito Penal', url: P + 'leis/l9455.htm' },
  { id: 'l12850', nome: 'Lei 12.850/2013 – Organização Criminosa', materia: 'Direito Penal', url: P + '_ato2011-2014/2013/lei/l12850.htm' },
  { id: 'l9613', nome: 'Lei 9.613/1998 – Lavagem de Dinheiro', materia: 'Direito Penal', url: P + 'leis/l9613.htm' },
  { id: 'l7716', nome: 'Lei 7.716/1989 – Crimes de Racismo', materia: 'Direito Penal', url: P + 'leis/l7716.htm' },
  { id: 'l9503', nome: 'Código de Trânsito Brasileiro (Lei 9.503/1997)', curto: 'CTB', materia: 'Legislação de Trânsito', url: P + 'leis/l9503compilado.htm' },

  { id: 'cpp', nome: 'Código de Processo Penal (Decreto-Lei 3.689/1941)', curto: 'CPP', materia: 'Direito Processual Penal', url: P + 'decreto-lei/del3689compilado.htm' },
  { id: 'l7210', nome: 'Lei 7.210/1984 – Execução Penal', curto: 'LEP', materia: 'Direito Processual Penal', url: P + 'leis/l7210.htm' },
  { id: 'l9099', nome: 'Lei 9.099/1995 – Juizados Especiais', materia: 'Direito Processual Penal', url: P + 'leis/l9099.htm' },
  { id: 'l9296', nome: 'Lei 9.296/1996 – Interceptação Telefônica', materia: 'Direito Processual Penal', url: P + 'leis/l9296.htm' },
  { id: 'l7960', nome: 'Lei 7.960/1989 – Prisão Temporária', materia: 'Direito Processual Penal', url: P + 'leis/l7960.htm' },

  { id: 'cpm', nome: 'Código Penal Militar (Decreto-Lei 1.001/1969)', curto: 'CPM', materia: 'Direito Penal Militar', url: P + 'decreto-lei/del1001.htm' },
  { id: 'cppm', nome: 'Código de Processo Penal Militar (Decreto-Lei 1.002/1969)', curto: 'CPPM', materia: 'Direito Processual Penal Militar', url: P + 'decreto-lei/del1002.htm' },

  { id: 'l8112', nome: 'Lei 8.112/1990 – Servidores Públicos Federais', materia: 'Direito Administrativo', url: P + 'leis/l8112cons.htm' },
  { id: 'l14133', nome: 'Lei 14.133/2021 – Licitações e Contratos', materia: 'Direito Administrativo', url: P + '_ato2019-2022/2021/lei/l14133.htm' },
  { id: 'l8429', nome: 'Lei 8.429/1992 – Improbidade Administrativa', materia: 'Direito Administrativo', url: P + 'leis/l8429.htm' },
  { id: 'l9784', nome: 'Lei 9.784/1999 – Processo Administrativo Federal', materia: 'Direito Administrativo', url: P + 'leis/l9784.htm' },
  { id: 'l12527', nome: 'Lei 12.527/2011 – Acesso à Informação', curto: 'LAI', materia: 'Direito Administrativo', url: P + '_ato2011-2014/2011/lei/l12527.htm' },
  { id: 'l13709', nome: 'Lei 13.709/2018 – Proteção de Dados (LGPD)', materia: 'Direito Administrativo', url: P + '_ato2015-2018/2018/lei/l13709.htm' },

  { id: 'cc', nome: 'Código Civil (Lei 10.406/2002)', curto: 'CC', materia: 'Direito Civil', url: P + 'leis/2002/l10406compilada.htm' },
  { id: 'lindb', nome: 'LINDB (Decreto-Lei 4.657/1942)', materia: 'Direito Civil', url: P + 'decreto-lei/del4657compilado.htm' },
  { id: 'cdc', nome: 'Código de Defesa do Consumidor (Lei 8.078/1990)', curto: 'CDC', materia: 'Direito do Consumidor', url: P + 'leis/l8078compilado.htm' },
  { id: 'cpc', nome: 'Código de Processo Civil (Lei 13.105/2015)', curto: 'CPC', materia: 'Direito Processual Civil', url: P + '_ato2015-2018/2015/lei/l13105.htm' },

  { id: 'clt', nome: 'CLT (Decreto-Lei 5.452/1943)', curto: 'CLT', materia: 'Direito do Trabalho', url: P + 'decreto-lei/del5452.htm' },
  { id: 'ctn', nome: 'Código Tributário Nacional (Lei 5.172/1966)', curto: 'CTN', materia: 'Direito Tributário', url: P + 'leis/l5172compilado.htm' },
  { id: 'lrf', nome: 'Lei de Responsabilidade Fiscal (LC 101/2000)', curto: 'LRF', materia: 'Administração Financeira e Orçamentária', url: P + 'leis/lcp/lcp101.htm' },
  { id: 'l4320', nome: 'Lei 4.320/1964 – Normas de Direito Financeiro', materia: 'Administração Financeira e Orçamentária', url: P + 'leis/l4320.htm' },
  { id: 'l8213', nome: 'Lei 8.213/1991 – Benefícios da Previdência', materia: 'Direito Previdenciário', url: P + 'leis/l8213cons.htm' },
  { id: 'l8212', nome: 'Lei 8.212/1991 – Custeio da Seguridade Social', materia: 'Direito Previdenciário', url: P + 'leis/l8212cons.htm' },

  { id: 'eca', nome: 'Estatuto da Criança e do Adolescente (Lei 8.069/1990)', curto: 'ECA', materia: 'Direitos Humanos e Legislação Especial', url: P + 'leis/l8069.htm' },
  { id: 'l10741', nome: 'Estatuto da Pessoa Idosa (Lei 10.741/2003)', materia: 'Direitos Humanos e Legislação Especial', url: P + 'leis/2003/l10.741.htm' },
  { id: 'l13146', nome: 'Estatuto da Pessoa com Deficiência (Lei 13.146/2015)', materia: 'Direitos Humanos e Legislação Especial', url: P + '_ato2015-2018/2015/lei/l13146.htm' },

  { id: 'l8906', nome: 'Estatuto da Advocacia e da OAB (Lei 8.906/1994)', materia: 'Ética Profissional (OAB)', url: P + 'leis/l8906.htm' },
  { id: 'l8159', nome: 'Lei 8.159/1991 – Política Nacional de Arquivos', materia: 'Arquivologia', url: P + 'leis/l8159.htm' },
  { id: 'l4737', nome: 'Código Eleitoral (Lei 4.737/1965)', materia: 'Direito Eleitoral', url: P + 'leis/l4737compilado.htm' },
  { id: 'l12651', nome: 'Código Florestal (Lei 12.651/2012)', materia: 'Direito Ambiental', url: P + '_ato2011-2014/2012/lei/l12651.htm' },
  { id: 'l9605', nome: 'Lei 9.605/1998 – Crimes Ambientais', materia: 'Direito Ambiental', url: P + 'leis/l9605.htm' },
  { id: 'l10257', nome: 'Estatuto da Cidade (Lei 10.257/2001)', materia: 'Direito Administrativo', url: P + 'leis/leis_2001/l10257.htm' },
  { id: 'lc123', nome: 'Estatuto da Microempresa (LC 123/2006)', materia: 'Direito Empresarial', url: P + 'leis/lcp/lcp123.htm' },
  { id: 'l13445', nome: 'Lei de Migração (Lei 13.445/2017)', materia: 'Direitos Humanos e Legislação Especial', url: P + '_ato2015-2018/2017/lei/l13445.htm' },
  { id: 'l12288', nome: 'Estatuto da Igualdade Racial (Lei 12.288/2010)', materia: 'Direitos Humanos e Legislação Especial', url: P + '_ato2007-2010/2010/lei/l12288.htm' },
  { id: 'l9474', nome: 'Estatuto dos Refugiados (Lei 9.474/1997)', materia: 'Direitos Humanos e Legislação Especial', url: P + 'leis/l9474.htm' },
  { id: 'l12852', nome: 'Estatuto da Juventude (Lei 12.852/2013)', materia: 'Direitos Humanos e Legislação Especial', url: P + '_ato2011-2014/2013/lei/l12852.htm' },
  { id: 'l6880', nome: 'Estatuto dos Militares (Lei 6.880/1980)', materia: 'Direito Militar', url: P + 'leis/l6880.htm' },
];

// Fonte de referência para procurar qualquer outra lei: Portal da Legislação do Planalto
export const PORTAL_LEGISLACAO = 'https://www4.planalto.gov.br/legislacao/';

// Leis acrescentadas pelo administrador (pelo link do Planalto) ficam no banco, com nome e matéria
let extras = [];
export const registrarLeisExtras = (lista) => {
  extras = lista.filter((l) => l?.id && l.nome && !LEIS.some((x) => x.id === l.id));
};
export const todasAsLeis = () => [...LEIS, ...extras];
export const getLei = (id) => todasAsLeis().find((l) => l.id === id);

export function leisPorMateria(busca = '') {
  const termo = busca.trim().toLowerCase();
  const grupos = new Map();
  for (const l of todasAsLeis()) {
    if (termo && !`${l.nome} ${l.curto || ''} ${l.materia}`.toLowerCase().includes(termo)) continue;
    if (!grupos.has(l.materia)) grupos.set(l.materia, []);
    grupos.get(l.materia).push(l);
  }
  return [...grupos.entries()].sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'));
}
