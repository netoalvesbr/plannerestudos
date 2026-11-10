// Catálogo de matérias da Biblioteca. Começa com as matérias de Direito e de conhecimentos gerais,
// mais as dos editais já cadastrados (PC/AC, OAB, Câmara de Rio Branco), e cresce sozinho:
// cada concurso importado e cada arquivo enviado com uma matéria nova acrescentam essa matéria.
import { todosConcursos } from './concursos.js';
import { AREAS_OAB, SUGESTOES_OAB } from './modelos.js';

export const MATERIAS_BASE = {
  Direito: [
    'Direito Constitucional', 'Direito Administrativo', 'Direito Penal', 'Direito Processual Penal', 'Legislação Penal Especial',
    'Direito Civil', 'Direito Processual Civil', 'Direito do Trabalho', 'Direito Processual do Trabalho', 'Direito Tributário',
    'Direito Financeiro', 'Direito Empresarial', 'Direito do Consumidor', 'Direito Ambiental', 'Direito Previdenciário',
    'Direito Eleitoral', 'Direito Internacional', 'Direitos Humanos', 'Direito da Criança e do Adolescente (ECA)',
    'Direito Penal Militar', 'Direito Processual Penal Militar', 'Ética Profissional', 'Filosofia do Direito',
    'Criminologia', 'Medicina Legal', 'Legislação de Trânsito', 'Licitações e Contratos', 'Improbidade Administrativa',
  ],
  'Conhecimentos gerais': [
    'Língua Portuguesa', 'Redação', 'Raciocínio Lógico', 'Matemática', 'Matemática Financeira', 'Estatística', 'Informática',
    'Contabilidade', 'Administração Financeira e Orçamentária (AFO)', 'Administração Pública', 'Arquivologia',
    'Ética no Serviço Público', 'Atualidades', 'História do Acre', 'Geografia do Acre', 'Realidade do Acre', 'Libras',
  ],
  'Câmara Municipal de Rio Branco': [
    'Lei Orgânica do Município de Rio Branco', 'Regimento Interno da Câmara Municipal de Rio Branco',
    'Estatuto dos Servidores de Rio Branco (Lei 1.794/2009)', 'Técnica Legislativa e Redação Oficial', 'Noções de Informática',
  ],
};

const norm = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// Todas as matérias, agrupadas: base + editais cadastrados + matérias dos arquivos enviados
export function catalogoMaterias(extras = []) {
  const grupos = Object.fromEntries(Object.entries(MATERIAS_BASE).map(([g, l]) => [g, [...l]]));
  const vistos = new Set(Object.values(grupos).flat().map(norm));
  const add = (grupo, nome) => {
    const n = (nome || '').trim();
    if (!n || n.length > 90 || vistos.has(norm(n))) return;
    vistos.add(norm(n));
    (grupos[grupo] ||= []).push(n);
  };
  for (const m of Object.keys(SUGESTOES_OAB)) add('OAB', m);
  for (const a of AREAS_OAB) add('OAB', a.nome);
  for (const c of todosConcursos()) for (const d of c.disciplinas || []) add(c.sigla || c.nome, d.nome);
  for (const m of extras) add('Outras matérias', m);
  for (const g of Object.keys(grupos)) grupos[g].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  return grupos;
}
export const mesmaMateria = (a, b) => norm(a) === norm(b);
