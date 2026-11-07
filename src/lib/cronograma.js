// Gera o cronograma de estudos: de uma data inicial até a véspera da prova, nos dias e horários escolhidos.
// Cada sessão recebe uma disciplina e um tópico do edital, intercalando as disciplinas.
// Os últimos dias antes da prova são reservados para revisão geral e questões.

const DIA = 86400000;
export const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const paraData = (iso) => new Date(iso + 'T12:00:00');
const paraIso = (d) => d.toLocaleDateString('sv-SE');
const min = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
};
const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

export const vespera = (iso) => (iso ? paraIso(new Date(paraData(iso).getTime() - DIA)) : '');

export function configPadrao(dataProva) {
  return {
    inicio: paraIso(new Date()),
    fim: vespera(dataProva),
    dias: [1, 2, 3, 4, 5, 6], // seg a sáb
    horaIni: '19:00',
    horaFim: '22:00',
    // fim de semana com horário próprio
    horaIniFds: '08:00',
    horaFimFds: '12:00',
    bloco: 50,
    pausa: 10,
    diasRevisao: 7,
  };
}

// disciplinas: [{nome, topicos:[...]}]
export function gerarCronograma(cfg, disciplinas, { discursiva = false } = {}) {
  const hojeIso = paraIso(new Date());
  const agora = new Date().getHours() * 60 + new Date().getMinutes();
  const sessoes = [];
  if (!cfg.inicio || !cfg.fim || cfg.fim < cfg.inicio) return sessoes;

  // horários de cada dia
  const diasEstudo = [];
  for (let t = paraData(cfg.inicio).getTime(); t <= paraData(cfg.fim).getTime(); t += DIA) {
    const d = new Date(t);
    if (!cfg.dias.includes(d.getDay())) continue;
    const fds = d.getDay() === 0 || d.getDay() === 6;
    const ini = min(fds && cfg.horaIniFds ? cfg.horaIniFds : cfg.horaIni);
    const fim = min(fds && cfg.horaFimFds ? cfg.horaFimFds : cfg.horaFim);
    const horarios = [];
    for (let m = ini; m + cfg.bloco <= fim; m += cfg.bloco + cfg.pausa) {
      if (paraIso(d) === hojeIso && m < agora) continue; // não agenda horário que já passou
      horarios.push([m, m + cfg.bloco]);
    }
    if (horarios.length) diasEstudo.push({ data: paraIso(d), horarios });
  }
  if (!diasEstudo.length) return sessoes;

  const nRevisao = Math.min(cfg.diasRevisao || 0, Math.floor(diasEstudo.length / 3));
  const diasConteudo = diasEstudo.slice(0, diasEstudo.length - nRevisao);
  const diasRevisao = diasEstudo.slice(diasEstudo.length - nRevisao);

  // itens: tópicos intercalados entre as disciplinas (A1, B1, C1, A2, B2, ...)
  const filas = disciplinas
    .map((d) => ({ nome: d.nome, itens: d.topicos?.length ? [...d.topicos] : ['Visão geral da disciplina e questões'] }))
    .filter((d) => d.itens.length);
  const itens = [];
  for (let i = 0; filas.some((f) => i < f.itens.length); i++) {
    for (const f of filas) if (i < f.itens.length) itens.push({ disciplina: f.nome, tema: f.itens[i] });
  }

  const vagas = diasConteudo.reduce((s, d) => s + d.horarios.length, 0);
  let fila = [];
  if (itens.length && vagas) {
    if (vagas >= itens.length) {
      // primeira passada pelo conteúdo; depois, revisões com questões na mesma ordem
      fila = itens.map((x) => ({ ...x, tipo: 'estudo' }));
      for (let k = 0; fila.length < vagas; k++) {
        const x = itens[k % itens.length];
        fila.push({ ...x, tema: `${discursiva ? 'Treino de peça e questões discursivas' : 'Revisão + questões'}: ${x.tema}`, tipo: 'revisao' });
      }
    } else {
      // mais tópicos que sessões: agrupa tópicos da mesma disciplina numa sessão
      const porSessao = Math.ceil(itens.length / vagas);
      const porDisc = new Map();
      for (const x of itens) {
        if (!porDisc.has(x.disciplina)) porDisc.set(x.disciplina, []);
        porDisc.get(x.disciplina).push(x.tema);
      }
      const grupos = [];
      for (const [disc, temas] of porDisc) for (let i = 0; i < temas.length; i += porSessao) grupos.push({ disciplina: disc, tema: temas.slice(i, i + porSessao).join('; '), tipo: 'estudo', ordem: i });
      grupos.sort((a, b) => a.ordem - b.ordem);
      fila = grupos;
    }
  }

  let k = 0;
  for (const d of diasConteudo) {
    for (const [ini, fim] of d.horarios) {
      const x = fila[k++];
      if (!x) break;
      sessoes.push({ data: d.data, ini: hhmm(ini), fim: hhmm(fim), disciplina: x.disciplina, tema: x.tema, tipo: x.tipo });
    }
  }
  // revisão final: percorre as disciplinas em rodízio
  let r = 0;
  for (const d of diasRevisao) {
    for (const [ini, fim] of d.horarios) {
      const f = filas[r++ % Math.max(1, filas.length)];
      if (!f) break;
      sessoes.push({ data: d.data, ini: hhmm(ini), fim: hhmm(fim), disciplina: f.nome, tema: discursiva ? 'Revisão final: modelos de peças, prazos e questões discursivas' : 'Revisão final: resumos, mapas mentais e questões', tipo: 'revisao-final' });
    }
  }
  return sessoes;
}

export const chaveSessao = (s) => `${s.data}#${s.ini}`;

// Arquivo .ics para importar no Google Agenda, Outlook ou Apple Calendar
export function gerarIcs(sessoes, titulo) {
  const esc = (t) => t.replace(/\\/g, '\\\\').replace(/[,;]/g, (m) => '\\' + m).replace(/\n/g, '\\n');
  const dt = (data, h) => data.replace(/-/g, '') + 'T' + h.replace(':', '') + '00';
  const agora = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const linhas = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//EstudaAi//Cronograma//PT', 'CALSCALE:GREGORIAN', `X-WR-CALNAME:${esc(titulo)}`];
  sessoes.forEach((s, i) => {
    linhas.push(
      'BEGIN:VEVENT',
      `UID:estudaai-${s.data}-${s.ini.replace(':', '')}-${i}@estudaai`,
      `DTSTAMP:${agora}`,
      `DTSTART:${dt(s.data, s.ini)}`,
      `DTEND:${dt(s.data, s.fim)}`,
      `SUMMARY:${esc(`📚 ${s.disciplina}`)}`,
      `DESCRIPTION:${esc(s.tema)}`,
      'END:VEVENT',
    );
  });
  linhas.push('END:VCALENDAR');
  return linhas.join('\r\n');
}
