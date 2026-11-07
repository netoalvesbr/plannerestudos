// Carrega todas as provas/questões de src/data/questoes/*.json (formato versao_esquema 2.0).
// Para publicar uma nova semana, basta acrescentar o arquivo JSON e publicar de novo: o link não muda.
import { getConcurso } from '../data/concursos.js';

const arquivos = import.meta.glob('../data/questoes/*.json', { eager: true, import: 'default' });

export const QUESTOES = [];
export const POR_UID = {};
const DIAS = {}; // concursoId -> [{dia, data, semana, provas:[{id,titulo,turno,cargos,uids}]}]

for (const arq of Object.values(arquivos)) {
  const cid = arq.concurso_id;
  // vários arquivos do mesmo dia (ex.: um por cargo) são agrupados num único dia
  let diaObj = null;
  if (arq.dia != null) {
    diaObj = (DIAS[cid] ||= []).find((d) => d.data === arq.data);
    if (!diaObj) {
      diaObj = { dia: arq.dia, semana: arq.semana, data: arq.data, provas: [] };
      DIAS[cid].push(diaObj);
    }
  }
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
}
for (const l of Object.values(DIAS)) l.sort((a, b) => a.data.localeCompare(b.data));

const chave = (t) => (t || '').toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]/gu, '');

// Questões vindas do banco compartilhado (Supabase). Não substituem as questões fixas com o mesmo uid.
export function registrarQuestoesRemotas(lista) {
  for (let i = QUESTOES.length - 1; i >= 0; i--) {
    if (QUESTOES[i].remoto) {
      delete POR_UID[QUESTOES[i].uid];
      QUESTOES.splice(i, 1);
    }
  }
  for (const q of lista) {
    if (POR_UID[q.uid]) continue;
    POR_UID[q.uid] = q;
    QUESTOES.push(q);
  }
}

// Disciplinas do concurso visíveis para o cargo ('oi', 'pap', 'ambos'...) e a fase escolhidos
export function disciplinasDo(concursoId, cargo, fase, area) {
  const c = getConcurso(concursoId);
  if (!c) return [];
  return c.disciplinas.filter(
    (d) =>
      (cargo === 'ambos' || !cargo || !d.cargos || d.cargos.includes(cargo)) &&
      (!fase || !d.fase || d.fase === fase) &&
      (!area || !d.area || d.area === area),
  );
}

// unificado = inclui questões de outros concursos cujas disciplinas existam neste concurso
export function questoesDo(concursoId, cargo, fase, { unificado = false, area = null } = {}) {
  const nomes = new Set(disciplinasDo(concursoId, cargo, fase, area).map((d) => chave(d.nome)));
  return QUESTOES.filter((q) => {
    if (q.anulada) return false;
    const proprio = q.concursos.includes(concursoId);
    if (proprio) {
      if (q.remoto) return (!fase || !q.fase || q.fase === fase) && (!area || !q.area || q.area === area);
      return nomes.has(chave(q.materia));
    }
    return unificado && nomes.has(chave(q.materia));
  });
}

export const totalNoBanco = () => QUESTOES.filter((q) => !q.anulada).length;

export function diasDo(concursoId, cargo) {
  return (DIAS[concursoId] || [])
    .map((d) => ({
      ...d,
      provas: d.provas.filter((p) => !p.cargos || cargo === 'ambos' || !cargo || p.cargos.includes(cargo)),
    }))
    .filter((d) => d.provas.length);
}
