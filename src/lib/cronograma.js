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

// gera as sessões de um "reforço" (plano pronto, dia a dia, repetindo em ciclo) entre
// duas datas, por cima de qualquer cronograma já existente (ver src/data/reforcos.js)
export function gerarSessoesReforco(ciclo, inicioIso, fimIso, disciplina) {
  if (!ciclo?.length || !inicioIso || !fimIso || fimIso < inicioIso) return [];
  const out = [];
  let data = inicioIso;
  let i = 0;
  while (data <= fimIso) {
    const texto = ciclo[i % ciclo.length];
    if (texto) out.push({ data, ini: '', fim: '', disciplina, tema: texto, tipo: 'estudo', reforco: true });
    data = somarDias(data, 1);
    i++;
  }
  return out;
}

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
    // cada dia pode ser definido pelo horário (janela acima) ou só pela quantidade de horas:
    // modoDia[dia] = 'horas' + horasDia[dia] = 6  → 6 horas de estudo nesse dia, sem hora marcada
    modoDia: {},
    horasDia: {},
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
    fimPorItem: {}, // data final de cada prova do combinado ("cid|fase|area" -> iso): cada uma para na sua véspera
    reforco: null, // plano de reforço ativo: { id, inicio, fim } (ver src/data/reforcos.js)
  };
}

// Janela de horário do dia da semana (aceita cronogramas antigos, com horário de semana e de fim de semana)
function janelaDo(cfg, dow) {
  if (cfg.janelas?.[dow]) return cfg.janelas[dow];
  const fds = dow === 0 || dow === 6;
  return [fds && cfg.horaIniFds ? cfg.horaIniFds : cfg.horaIni || '19:00', fds && cfg.horaFimFds ? cfg.horaFimFds : cfg.horaFim || '22:00'];
}

// Blocos de um dia da semana. Cada item é [início, fim] em minutos; null = bloco sem hora marcada
// (dia definido só pela quantidade de horas, pra quem estuda em horários soltos ao longo do dia).
export function horariosDo(cfg, dow) {
  const passo = cfg.bloco + (cfg.pausa || 0);
  if (cfg.modoDia?.[dow] === 'horas') {
    const totalMin = Math.round((Number(cfg.horasDia?.[dow]) || 0) * 60);
    const n = totalMin >= cfg.bloco ? Math.floor((totalMin + (cfg.pausa || 0)) / passo) : 0;
    return Array.from({ length: n }, () => null);
  }
  const [a, b] = janelaDo(cfg, dow);
  const ini = min(a);
  const fim = min(b);
  const h = [];
  for (let m = ini; m + cfg.bloco <= fim; m += passo) h.push([m, m + cfg.bloco]);
  return h;
}
export const blocosNoDia = (cfg, dow) => horariosDo(cfg, dow).length;
// minutos de estudo de um dia da semana (blocos × duração do bloco)
export const minutosNoDia = (cfg, dow) => blocosNoDia(cfg, dow) * cfg.bloco;

// Peso de cada matéria: quanto mais fraco o conhecimento e maior o peso, mais vezes ela aparece
export const pesoDa = (m = {}) => (m.peso || 1) * (6 - (m.nivel || 3));

export function materiasAtivas(cfg, disciplinas) {
  const ordem = cfg.ordem || [];
  const ativas = disciplinas.filter((d) => cfg.materias?.[d.nome]?.ativa !== false);
  if (ordem.length) {
    const pos = (n) => (ordem.includes(n) ? ordem.indexOf(n) : 1000 + disciplinas.findIndex((d) => d.nome === n));
    return [...ativas].sort((a, b) => pos(a.nome) - pos(b.nome));
  }
  // sem ordem definida à mão: primeiro o concurso marcado como prioridade, depois as matérias
  // de maior peso no edital (as de peso 1 ficam mais pro fim da fila)
  const peso = (n) => cfg.materias?.[n]?.peso || 1;
  const orig = (d) => disciplinas.indexOf(d);
  return [...ativas].sort(
    (a, b) => (b.prioritaria ? 1 : 0) - (a.prioritaria ? 1 : 0) || peso(b.nome) - peso(a.nome) || orig(a) - orig(b),
  );
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
    // não agenda horário que já passou (blocos sem hora marcada continuam valendo o dia todo)
    const horarios = horariosDo(cfg, d.getDay()).filter((h) => !(h && paraIso(d) === hojeIso && h[0] < agora));
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
  const pular = new Set(cfg.pular || []);
  // cada matéria pode ter a sua própria data final (a véspera da prova do concurso dela,
  // no cronograma combinado): depois dessa data ela sai do rodízio e sobram as outras
  const fimDe = Object.fromEntries(ativas.map((d) => [d.nome, d.fim || '']));
  const valeNoDia = (n, data) => !fimDe[n] || data <= fimDe[n];
  const disponiveisEm = (data) => nomes.filter((n) => valeNoDia(n, data));
  // matérias do concurso marcado como prioridade (ganham o primeiro bloco de cada dia)
  const prioritarias = new Set(ativas.filter((d) => d.prioritaria).map((d) => d.nome));

  // fila de tópicos de cada matéria; se houver mais tópicos que sessões previstas, agrupa
  const filas = {};
  for (const d of ativas) {
    const tops = (d.topicos?.length ? d.topicos : ['Visão geral da disciplina e questões']).filter((t) => !pular.has(`${d.nome}|${t}`));
    // só contam as vagas dos dias em que essa matéria ainda vale (antes da prova dela)
    const vagas = diasConteudo.reduce((s, x) => s + (valeNoDia(d.nome, x.data) ? x.horarios.length : 0), 0);
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
  // escolhe as matérias de um dia: respeita o limite de matérias diferentes, só usa as que ainda
  // valem naquele dia e dá o primeiro bloco ao concurso prioritário
  const planoDoDia = (n, base) => {
    const doDia = new Set();
    const lista = [];
    for (let j = 0; j < n; j++) {
      let permitidas = base ? new Set(base) : null;
      if (doDia.size >= lim) permitidas = new Set([...doDia].filter((x) => !base || base.has(x)));
      if (j === 0 && prioritarias.size) {
        const p = [...(permitidas || nomes)].filter((x) => prioritarias.has(x));
        if (p.length) permitidas = new Set(p);
      }
      const nome = escolher(permitidas);
      if (!nome) break;
      doDia.add(nome);
      lista.push(nome);
    }
    return lista;
  };

  // No modo fixo a semana-modelo se repete igual até a prova: se uma matéria não entrar nela,
  // ela nunca é estudada. Então, se sobrar matéria de fora, troca uma repetição de outra por ela.
  const garantirTodas = (s, disp) => {
    const dows = Object.keys(s);
    const conta = {};
    for (const dow of dows) for (const n of s[dow]) conta[n] = (conta[n] || 0) + 1;
    // procura o melhor bloco pra ceder: o da matéria que mais se repete na semana
    const procurar = (n, deJ) => {
      let alvo = null;
      for (const dow of dows) {
        if (s[dow].includes(n)) continue; // não repete a mesma matéria duas vezes no mesmo dia
        const distintasNoDia = new Set(s[dow]).size;
        for (let j = deJ; j < s[dow].length; j++) {
          const atual = s[dow][j];
          if ((conta[atual] || 0) <= 1) continue;
          // se a matéria cedente aparece 2× no mesmo dia, ela continua lá e o dia ganha mais uma
          // matéria diferente: só vale se ainda couber no limite (trocar 1× por 1× é neutro)
          if (s[dow].filter((x) => x === atual).length > 1 && distintasNoDia >= lim) continue;
          if (!alvo || conta[atual] > conta[alvo.nome]) alvo = { dow, j, nome: atual };
        }
      }
      return alvo;
    };
    for (const n of disp) {
      if (conta[n]) continue;
      // primeiro tenta sem mexer no bloco de abertura do dia (reservado ao concurso prioritário);
      // se não houver outro jeito de encaixar a matéria, cede um desses blocos
      const alvo = procurar(n, prioritarias.size ? 1 : 0) || (prioritarias.size ? procurar(n, 0) : null);
      if (!alvo) continue;
      conta[alvo.nome]--;
      s[alvo.dow][alvo.j] = n;
      conta[n] = 1;
    }
  };

  // modo fixo: monta uma semana-modelo e repete. Quando uma prova passa e as matérias dela saem,
  // monta uma nova semana-modelo só com as que sobraram.
  const semanas = new Map();
  const semanaDe = (disp) => {
    const chave = disp.join('|');
    if (!semanas.has(chave)) {
      const base = new Set(disp);
      const s = {};
      for (const dow of [1, 2, 3, 4, 5, 6, 0]) if (cfg.dias.includes(dow)) s[dow] = planoDoDia(horariosDo(cfg, dow).length, base);
      garantirTodas(s, disp);
      semanas.set(chave, s);
    }
    return semanas.get(chave);
  };

  for (const d of diasConteudo) {
    const disp = disponiveisEm(d.data);
    if (!disp.length) continue;
    let nomesDia;
    if (cfg.modo !== 'ciclo') {
      const modelo = semanaDe(disp)[d.dow] || [];
      // hoje pode ter menos horários (os que já passaram): usa os últimos do modelo
      nomesDia = modelo.slice(Math.max(0, modelo.length - d.horarios.length));
    } else nomesDia = planoDoDia(d.horarios.length, new Set(disp));
    d.horarios.forEach((h, j) => {
      const nome = nomesDia[j] || disp[j % disp.length];
      const x = proximo(nome);
      sessoes.push({ data: d.data, ini: h ? hhmm(h[0]) : '', fim: h ? hhmm(h[1]) : '', idx: j, ...x });
    });
  }
  // revisão final: percorre as matérias em rodízio
  let r = 0;
  for (const d of diasRevisao) {
    const disp = disponiveisEm(d.data);
    if (!disp.length) continue;
    d.horarios.forEach((h, j) => {
      const nome = disp[r++ % disp.length];
      sessoes.push({ data: d.data, ini: h ? hhmm(h[0]) : '', fim: h ? hhmm(h[1]) : '', idx: j, disciplina: nome, tema: discursiva ? 'Revisão final: modelos de peças, prazos e questões discursivas' : 'Revisão final: resumos, mapas mentais e questões', tipo: 'revisao-final' });
    });
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
    // no combinado, a revisão de uma matéria não passa da prova do concurso dela
    const fimMateria = cfg.fimPorMateria?.[s.disciplina] || fim;
    for (const i of ints) {
      const data = paraIso(new Date(paraData(s.data).getTime() + i * DIA));
      if (data > fim || data > fimMateria) break;
      out.push({ data, disciplina: s.disciplina, tema: s.tema, intervalo: i, origem: s.data });
    }
  }
  return out.sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));
}
export const chaveRevisao = (r) => `rev#${r.data}#${r.disciplina}#${r.tema}`;

// blocos sem hora marcada (dia definido por quantidade de horas) usam o número do bloco como chave
export const chaveSessao = (s) => `${s.data}#${s.ini || `b${s.idx ?? 0}`}`;

// Arquivo .ics para importar no Google Agenda, Outlook ou Apple Calendar
export function gerarIcs(sessoes, titulo) {
  const esc = (t) => t.replace(/\\/g, '\\\\').replace(/[,;]/g, (m) => '\\' + m).replace(/\n/g, '\\n');
  const dt = (data, h) => data.replace(/-/g, '') + 'T' + h.replace(':', '') + '00';
  const agora = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const linhas = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//EstudaAi//Cronograma//PT', 'CALSCALE:GREGORIAN', `X-WR-CALNAME:${esc(titulo)}`];
  sessoes.forEach((s, i) => {
    if (!s.ini || !s.fim) return; // bloco sem hora marcada não vira evento de agenda
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
