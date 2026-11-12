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
// soma (ou subtrai, com n negativo) n dias a uma data iso
export const somarDias = (iso, n) => (iso ? paraIso(new Date(paraData(iso).getTime() + n * DIA)) : '');

export const INTERVALOS_REVISAO = [1, 7, 14, 30, 60, 90, 120];
export const NIVEIS = ['Muito fraco', 'Fraco', 'Médio', 'Bom', 'Muito bom'];

export function configPadrao(dataProva) {
  return {
    inicio: paraIso(new Date()),
    fim: vespera(dataProva),
    modo: 'fixo', // 'fixo' = cada dia da semana tem as mesmas matérias; 'ciclo' = sequência que segue de onde parou
    dias: [1, 2, 3, 4, 5, 6], // seg a sáb
    // horário de cada dia da semana (0 = domingo)
    janelas: { 0: ['08:00', '12:00'], 1: ['19:00', '22:00'], 2: ['19:00', '22:00'], 3: ['19:00', '22:00'], 4: ['19:00', '22:00'], 5: ['19:00', '22:00'], 6: ['08:00', '12:00'] },
    bloco: 50,
    pausa: 10,
    simultaneas: 3, // matérias diferentes por dia (0 = sem limite)
    materias: {}, // { nome: { ativa, nivel 1-5, peso 1-3 } }
    ordem: [], // prioridade das matérias
    revisoes: [1, 7, 14, 30],
    diasRevisao: 7,
    pular: [], // tópicos já estudados (replanejamento)
    // só vale para cronograma combinado (várias provas): estudar uma prova inteira antes da próxima,
    // em vez de misturar as matérias de todas o tempo todo
    sequencial: false,
    folgaDias: 2, // dias sem estudar essa prova antes dela (descanso/revisão final)
    ordemItens: [], // ordem de prioridade das provas (chaves "cid|fase|area"), da primeira para a última
  };
}

// Janela de horário do dia da semana (aceita cronogramas antigos, com horário de semana e de fim de semana)
function janelaDo(cfg, dow) {
  if (cfg.janelas?.[dow]) return cfg.janelas[dow];
  const fds = dow === 0 || dow === 6;
  return [fds && cfg.horaIniFds ? cfg.horaIniFds : cfg.horaIni || '19:00', fds && cfg.horaFimFds ? cfg.horaFimFds : cfg.horaFim || '22:00'];
}

function horariosDo(cfg, dow) {
  const [a, b] = janelaDo(cfg, dow);
  const ini = min(a);
  const fim = min(b);
  const h = [];
  for (let m = ini; m + cfg.bloco <= fim; m += cfg.bloco + (cfg.pausa || 0)) h.push([m, m + cfg.bloco]);
  return h;
}

// Peso de cada matéria: quanto mais fraco o conhecimento e maior o peso, mais vezes ela aparece
export const pesoDa = (m = {}) => (m.peso || 1) * (6 - (m.nivel || 3));

export function materiasAtivas(cfg, disciplinas) {
  const ordem = cfg.ordem || [];
  const pos = (n) => (ordem.includes(n) ? ordem.indexOf(n) : 1000 + disciplinas.findIndex((d) => d.nome === n));
  return disciplinas
    .filter((d) => cfg.materias?.[d.nome]?.ativa !== false)
    .sort((a, b) => pos(a.nome) - pos(b.nome));
}

// Rodízio ponderado suave: distribui as matérias de forma intercalada, respeitando o peso de cada uma
function rodizio(nomes, pesos) {
  const credito = Object.fromEntries(nomes.map((n) => [n, 0]));
  const total = nomes.reduce((s, n) => s + pesos[n], 0);
  return (permitidas) => {
    const lista = permitidas ? nomes.filter((n) => permitidas.has(n)) : nomes;
    if (!lista.length) return null;
    for (const n of nomes) credito[n] += pesos[n];
    let melhor = lista[0];
    for (const n of lista) if (credito[n] > credito[melhor]) melhor = n;
    credito[melhor] -= total;
    return melhor;
  };
}

// disciplinas: [{nome, topicos:[...]}]
export function gerarCronograma(cfg, disciplinas, { discursiva = false } = {}) {
  const hojeIso = paraIso(new Date());
  const agora = new Date().getHours() * 60 + new Date().getMinutes();
  const sessoes = [];
  if (!cfg.inicio || !cfg.fim || cfg.fim < cfg.inicio || !(cfg.bloco > 0)) return sessoes;

  const diasEstudo = [];
  for (let t = paraData(cfg.inicio).getTime(); t <= paraData(cfg.fim).getTime(); t += DIA) {
    const d = new Date(t);
    if (!cfg.dias.includes(d.getDay())) continue;
    const horarios = horariosDo(cfg, d.getDay()).filter(([m]) => !(paraIso(d) === hojeIso && m < agora)); // não agenda horário que já passou
    if (horarios.length) diasEstudo.push({ data: paraIso(d), dow: d.getDay(), horarios });
  }
  if (!diasEstudo.length) return sessoes;

  const nRevisao = Math.min(cfg.diasRevisao || 0, Math.floor(diasEstudo.length / 3));
  const diasConteudo = diasEstudo.slice(0, diasEstudo.length - nRevisao);
  const diasRevisao = diasEstudo.slice(diasEstudo.length - nRevisao);

  const ativas = materiasAtivas(cfg, disciplinas);
  if (!ativas.length) return sessoes;
  const nomes = ativas.map((d) => d.nome);
  const pesos = Object.fromEntries(nomes.map((n) => [n, pesoDa(cfg.materias?.[n])]));
  const somaPesos = nomes.reduce((s, n) => s + pesos[n], 0);
  const vagas = diasConteudo.reduce((s, d) => s + d.horarios.length, 0);
  const pular = new Set(cfg.pular || []);

  // fila de tópicos de cada matéria; se houver mais tópicos que sessões previstas, agrupa
  const filas = {};
  for (const d of ativas) {
    const tops = (d.topicos?.length ? d.topicos : ['Visão geral da disciplina e questões']).filter((t) => !pular.has(`${d.nome}|${t}`));
    const previstas = Math.max(1, Math.floor((vagas * pesos[d.nome]) / somaPesos));
    const porSessao = Math.max(1, Math.ceil(tops.length / previstas));
    const grupos = [];
    for (let i = 0; i < tops.length; i += porSessao) grupos.push(tops.slice(i, i + porSessao));
    filas[d.nome] = { grupos, i: 0, rev: 0, todos: d.topicos?.length ? d.topicos : ['Visão geral da disciplina'] };
  }
  const proximo = (nome) => {
    const f = filas[nome];
    if (f.i < f.grupos.length) {
      const itens = f.grupos[f.i++];
      return { disciplina: nome, tema: itens.join('; '), itens, tipo: 'estudo' };
    }
    const t = f.todos[f.rev++ % f.todos.length];
    return { disciplina: nome, tema: `${discursiva ? 'Treino de peça e questões discursivas' : 'Revisão + questões'}: ${t}`, tipo: 'revisao' };
  };

  const lim = cfg.simultaneas > 0 ? cfg.simultaneas : Infinity;
  const escolher = rodizio(nomes, pesos);
  // escolhe as matérias de um dia, respeitando o limite de matérias diferentes
  const planoDoDia = (n) => {
    const doDia = new Set();
    const lista = [];
    for (let j = 0; j < n; j++) {
      const nome = escolher(doDia.size >= lim ? doDia : null);
      doDia.add(nome);
      lista.push(nome);
    }
    return lista;
  };

  // modo fixo: monta uma semana-modelo e repete; modo ciclo: segue a sequência de onde parou
  let semana = null;
  if (cfg.modo !== 'ciclo') {
    semana = {};
    for (const dow of [1, 2, 3, 4, 5, 6, 0]) if (cfg.dias.includes(dow)) semana[dow] = planoDoDia(horariosDo(cfg, dow).length);
  }

  for (const d of diasConteudo) {
    let nomesDia;
    if (semana) {
      const modelo = semana[d.dow] || [];
      // hoje pode ter menos horários (os que já passaram): usa os últimos do modelo
      nomesDia = modelo.slice(Math.max(0, modelo.length - d.horarios.length));
    } else nomesDia = planoDoDia(d.horarios.length);
    d.horarios.forEach(([ini, fim], j) => {
      const nome = nomesDia[j] || nomes[j % nomes.length];
      const x = proximo(nome);
      sessoes.push({ data: d.data, ini: hhmm(ini), fim: hhmm(fim), ...x });
    });
  }
  // revisão final: percorre as matérias em rodízio
  let r = 0;
  for (const d of diasRevisao) {
    for (const [ini, fim] of d.horarios) {
      const nome = nomes[r++ % nomes.length];
      sessoes.push({ data: d.data, ini: hhmm(ini), fim: hhmm(fim), disciplina: nome, tema: discursiva ? 'Revisão final: modelos de peças, prazos e questões discursivas' : 'Revisão final: resumos, mapas mentais e questões', tipo: 'revisao-final' });
    }
  }
  return sessoes;
}

// Revisões espaçadas: cada conteúdo estudado volta 1, 7, 14, 30... dias depois (revisão curta, fora dos blocos)
export function gerarRevisoes(sessoes, cfg) {
  const ints = cfg.revisoes || [];
  if (!ints.length) return [];
  const fim = cfg.fim;
  const out = [];
  for (const s of sessoes) {
    if (s.tipo !== 'estudo') continue;
    for (const i of ints) {
      const data = paraIso(new Date(paraData(s.data).getTime() + i * DIA));
      if (data > fim) break;
      out.push({ data, disciplina: s.disciplina, tema: s.tema, intervalo: i, origem: s.data });
    }
  }
  return out.sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));
}
export const chaveRevisao = (r) => `rev#${r.data}#${r.disciplina}#${r.tema}`;

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
