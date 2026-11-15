// Horário da prova como está no edital, e o mesmo horário no fuso de quem está estudando.
// O edital de cada concurso fixa o fuso: a OAB usa o horário oficial de Brasília e a PC/AC
// usa o horário oficial do Acre — quem mora no Acre precisa ver os dois pra não perder a hora.

const MIN = (hhmm) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '').trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
const HHMM = (min) => {
  const t = ((Math.round(min) % 1440) + 1440) % 1440;
  const h = Math.floor(t / 60);
  const m = t % 60;
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
};

// deslocamento do fuso (em minutos) naquele dia — cobre horário de verão, se houver
function offsetMin(tz, dataIso) {
  try {
    const d = new Date(`${dataIso}T12:00:00Z`);
    const txt = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longOffset' })
      .formatToParts(d)
      .find((p) => p.type === 'timeZoneName')?.value || 'GMT+00:00';
    const m = txt.match(/GMT([+-])(\d{1,2}):?(\d{2})?/);
    if (!m) return 0;
    return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] || 0));
  } catch {
    return 0;
  }
}

export const fusoLocal = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo';
  } catch {
    return 'America/Sao_Paulo';
  }
};

// Onde o horário fica guardado: na fase (ex.: 2ª fase da OAB) ou no cargo (ex.: PC/AC, que tem
// turnos diferentes por cargo). Formato: { ini, fim, portoes, fuso, rotulo }
export function horarioDaProva(concurso, { fase, cargo } = {}) {
  if (!concurso) return null;
  const daFase = (concurso.fases || []).find((f) => f.id === fase)?.horarioProva;
  if (daFase?.ini) return daFase;
  const cargos = Array.isArray(cargo) ? cargo : cargo && cargo !== 'ambos' ? [cargo] : [];
  for (const id of cargos) {
    const h = (concurso.cargos || []).find((k) => k.id === id)?.horarioProva;
    if (h?.ini) return h;
  }
  // um cargo só no concurso, ou todos com o mesmo horário: dá pra mostrar sem ambiguidade
  const todos = (concurso.cargos || []).map((k) => k.horarioProva).filter((h) => h?.ini);
  if (todos.length && todos.every((h) => h.ini === todos[0].ini && h.fim === todos[0].fim)) return todos[0];
  return concurso.prova?.horarioProva?.ini ? concurso.prova.horarioProva : null;
}

// Texto pronto: "13h às 18h (horário de Brasília) · portões fecham 12h30"
// e, quando o seu fuso é outro, "no seu horário (Acre): 11h às 16h · portões 10h30"
export function textoHorario(h, dataIso) {
  if (!h?.ini) return null;
  const ini = MIN(h.ini);
  const fim = MIN(h.fim);
  const abrem = MIN(h.portoesAbrem);
  const fecham = MIN(h.portoesFecham);
  if (ini == null) return null;
  const portoes = (a, f) => {
    if (a != null && f != null) return ` · portões das ${HHMM(a)} às ${HHMM(f)}`;
    if (f != null) return ` · portões fecham ${HHMM(f)}`;
    if (a != null) return ` · portões abrem ${HHMM(a)}`;
    return '';
  };
  const trecho = (d) => `${HHMM(ini + d)}${fim != null ? ` às ${HHMM(fim + d)}` : ''}${portoes(abrem != null ? abrem + d : null, fecham != null ? fecham + d : null)}`;
  const doEdital = `${trecho(0)}${h.rotulo ? ` (${h.rotulo})` : ''}`;

  const tzEdital = h.fuso || 'America/Sao_Paulo';
  const tzLocal = fusoLocal();
  const dia = dataIso || new Date().toLocaleDateString('sv-SE');
  const dif = offsetMin(tzLocal, dia) - offsetMin(tzEdital, dia);
  if (!dif) return { edital: doEdital, local: null };
  const cidade = tzLocal.split('/').pop().replace(/_/g, ' ');
  return { edital: doEdital, local: `no seu horário (${cidade}): ${trecho(dif)}` };
}
