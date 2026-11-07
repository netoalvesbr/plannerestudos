// Carrega todas as provas/questões de src/data/questoes/*.json (formato versao_esquema 2.0).
// Para publicar uma nova semana, basta acrescentar o arquivo JSON e publicar de novo: o link não muda.
import { getConcurso } from '../data/concursos.js';

const arquivos = import.meta.glob('../data/questoes/*.json', { eager: true, import: 'default' });

export const QUESTOES = [];
export const POR_UID = {};
const DIAS = {}; // concursoId -> [{dia, data, semana, provas:[{id,titulo,turno,cargos,uids}]}]

for (const arq of Object.values(arquivos)) {
  const cid = arq.concurso_id;
  const diaObj = arq.dia != null ? { dia: arq.dia, semana: arq.semana, data: arq.data, provas: [] } : null;
  for (const p of arq.provas) {
    const uids = [];
    for (const q of p.questoes) {
      if (!POR_UID[q.uid]) {
        const qq = { ...q, concursos: q.concursos || [cid], provaId: p.id };
        POR_UID[q.uid] = qq;
        QUESTOES.push(qq);
      }
      uids.push(q.uid);
    }
    if (diaObj) diaObj.provas.push({ id: p.id, titulo: p.titulo, turno: p.turno, cargos: p.cargos || null, uids });
  }
  if (diaObj) (DIAS[cid] ||= []).push(diaObj);
}
for (const l of Object.values(DIAS)) l.sort((a, b) => a.data.localeCompare(b.data));

// Disciplinas do concurso visíveis para o cargo escolhido ('oi', 'pap' ou 'ambos')
export function disciplinasDo(concursoId, cargo) {
  const c = getConcurso(concursoId);
  if (!c) return [];
  return c.disciplinas.filter((d) => cargo === 'ambos' || !cargo || d.cargos.includes(cargo));
}

export function questoesDo(concursoId, cargo) {
  const nomes = new Set(disciplinasDo(concursoId, cargo).map((d) => d.nome));
  return QUESTOES.filter((q) => q.concursos.includes(concursoId) && nomes.has(q.materia) && !q.anulada);
}

export function diasDo(concursoId, cargo) {
  return (DIAS[concursoId] || [])
    .map((d) => ({
      ...d,
      provas: d.provas.filter((p) => !p.cargos || cargo === 'ambos' || !cargo || p.cargos.includes(cargo)),
    }))
    .filter((d) => d.provas.length);
}
