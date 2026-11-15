import { getConcurso } from '../data/concursos.js';
import { useEffect, useMemo, useState } from 'react';
import { disciplinasDo } from '../lib/dados.js';
import { blocosNoDia, chaveRevisao, chaveSessao, configPadrao, DIAS_SEMANA, gerarCronograma, gerarIcs, gerarRevisoes, gerarSessoesReforco, INTERVALOS_REVISAO, materiasAtivas, NIVEIS, pesoDa, somarDias, vespera } from '../lib/cronograma.js';
import { REFORCOS } from '../data/reforcos.js';
import { fmtData } from '../lib/stats.js';
import { verticalizadoDe } from './EditalVerticalizado.jsx';
import { ProximaData } from './Calendario.jsx';
import { eventosDoAluno } from '../lib/exameAnterior.js';
import { cronometrar } from './Cronometro.jsx';

const campo = { width: '100%', minHeight: 40, padding: '6px 9px', borderRadius: 9, border: '1px solid var(--borda)', background: 'var(--card)', color: 'var(--txt)', font: 'inherit' };
const nomeDia = (iso) => DIAS_SEMANA[new Date(iso + 'T12:00:00').getDay()];
const NOME_DIA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const ORDEM_DIAS = [1, 2, 3, 4, 5, 6, 0];
const minutos = (h) => { const [a, b] = h.split(':').map(Number); return a * 60 + (b || 0); };
const fmtHoras = (m) => (m % 60 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}` : `${m / 60}h`);
const paraHora = (m) => { const t = ((Math.round(m) % 1440) + 1440) % 1440; return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; };

// cronogramas salvos antes do novo assistente continuam iguais
function normalizar(cfg, dataProva) {
  const base = configPadrao(dataProva);
  if (!cfg) return base;
  const antigo = !('modo' in cfg);
  const n = { ...base, ...cfg, ...(antigo ? { modo: 'ciclo', simultaneas: 0, revisoes: [] } : {}) };
  if (!cfg.janelas) {
    n.janelas = {};
    for (let d = 0; d < 7; d++) {
      const fds = d === 0 || d === 6;
      n.janelas[d] = [fds ? cfg.horaIniFds || cfg.horaIni : cfg.horaIni, fds ? cfg.horaFimFds || cfg.horaFim : cfg.horaFim];
    }
  }
  return n;
}

const PASSOS = ['Modo', 'Cargos', 'Matérias', 'Dias e horas', 'Blocos', 'Revisões', 'Resumo'];

// junta as matérias de vários concursos num cronograma só (matérias iguais aparecem uma vez, com os tópicos somados)
const normNome = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/^nocoes de /, '').replace(/[^a-z0-9]+/g, ' ').trim();
// Peso da matéria segundo o edital: 2ª fase da OAB vale o máximo (é a prova inteira);
// nos demais, usa a tabela de pesos do edital e, quando ela não veio na importação,
// trata o bloco de "Conhecimentos Específicos" como peso 2 (é assim no edital da PC/AC).
const semAcento = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
export function pesoDoEdital(c, d, it = {}) {
  if (it.fase === 'f2' && it.area) return 3;
  const b = (c?.prova?.blocos || []).find((x) => normNome(x.nome) === normNome(d.bloco || ''));
  if (b?.peso) return Math.min(3, Math.max(1, Math.round(b.peso)));
  if (/especific/i.test(semAcento(d.bloco))) return 2;
  return 1;
}
export function mesclarConcursos(itens, { fimPorItem = {}, prioritario = '' } = {}) {
  const mapa = new Map();
  for (const it of itens) {
    const c = getConcurso(it.cid);
    if (!c) continue;
    // matéria da área da 2ª fase da OAB: conteúdo exclusivo (peça prático-profissional),
    // não é a mesma coisa que uma matéria de mesmo nome de outro concurso (ex.: "Direito
    // Constitucional" da OAB 2ª fase ≠ "Direito Constitucional" da PC/AC) — nunca mescla,
    // fica com um nome próprio pra aparecer separado no cronograma combinado.
    const ehAreaOAB2 = it.fase === 'f2' && !!it.area;
    const chave = chaveItem(it);
    // cada matéria para na véspera da prova do concurso dela
    const fimIt = fimPorItem[chave] || vespera(dataDoItem(it));
    const ehPrioritario = !!prioritario && chave === prioritario;
    for (const d of disciplinasDo(it.cid, it.cargo || 'ambos', it.fase || '', it.area || '')) {
      const k = ehAreaOAB2 ? `${normNome(d.nome)}::${it.cid}::${it.area}` : normNome(d.nome);
      const nomeExibido = ehAreaOAB2 ? `${d.nome} (${c.sigla})` : d.nome;
      const e = mapa.get(k) || { nome: nomeExibido, topicos: [], origens: [], fim: '', pesoEdital: 1, prioritaria: false };
      for (const t of d.topicos || []) if (!e.topicos.some((x) => normNome(x) === normNome(t))) e.topicos.push(t);
      if (!e.origens.includes(c.sigla)) e.origens.push(c.sigla);
      // matéria que aparece em mais de um concurso vale até a última prova e herda o maior peso
      if (fimIt && (!e.fim || fimIt > e.fim)) e.fim = fimIt;
      e.pesoEdital = Math.max(e.pesoEdital, pesoDoEdital(c, d, it));
      e.prioritaria = e.prioritaria || ehPrioritario;
      mapa.set(k, e);
    }
  }
  return [...mapa.values()];
}
// Matérias e configuração efetiva de um cronograma combinado (usado tanto pelo assistente
// quanto por quem só tem a configuração salva — ver src/lib/cronogramaSalvo.js).
export function discsDoCombinado(itens, cfg = {}) {
  const ordenados = itensNaOrdem(itens || [], cfg.ordemItens);
  const fimPorItem = {};
  for (const it of ordenados) fimPorItem[chaveItem(it)] = cfg.fimPorItem?.[chaveItem(it)] || vespera(dataDoItem(it));
  const prioritario = ordenados.length ? chaveItem(ordenados[0]) : '';
  const discs = mesclarConcursos(ordenados, { fimPorItem, prioritario });
  // o cronograma vai até a última das provas; cada matéria para na prova do concurso dela
  const ultimo = Object.values(fimPorItem).filter(Boolean).sort().at(-1) || cfg.fim;
  const fimPorMateria = Object.fromEntries(discs.filter((d) => d.fim).map((d) => [d.nome, d.fim]));
  return { discs, ordenados, fimPorItem, cfg: { ...cfg, fim: cfg.sequencial ? cfg.fim : ultimo || cfg.fim, fimPorMateria } };
}
export function dataDoItem(it) {
  const c = getConcurso(it.cid);
  return c?.fases?.find((f) => f.id === it.fase)?.data || c?.dataProva || '';
}
// chave estável de um item do combinado, pra guardar a ordem de prioridade escolhida pelo usuário
export const chaveItem = (it) => `${it.cid}|${it.fase || ''}|${it.area || ''}`;
export function itensNaOrdem(itens, ordem) {
  if (!ordem?.length || !itens) return itens;
  const resto = [...itens];
  const out = [];
  for (const k of ordem) {
    const i = resto.findIndex((it) => chaveItem(it) === k);
    if (i >= 0) out.push(resto.splice(i, 1)[0]);
  }
  return [...out, ...resto];
}
// modo sequencial do combinado: estuda a 1ª prova (pela prioridade) até "folgaDias" antes da sua data,
// depois passa pra próxima, e assim por diante
export function segmentosSequenciais(itensOrd, folgaDias, inicioIso) {
  let cursor = inicioIso;
  const out = [];
  for (const it of itensOrd) {
    const prova = dataDoItem(it);
    const limite = prova ? somarDias(prova, -Math.max(0, folgaDias || 0)) : '';
    const fim = limite && limite >= cursor ? limite : cursor;
    out.push({ ...it, prova, inicio: cursor, fim });
    cursor = somarDias(fim, 1);
  }
  return out;
}

export default function Cronograma({ ctx, voltar, combinado = null }) {
  const { cargo, fase, area, prefs, setPrefs, abrirAvulsas } = ctx;
  // cronograma combinado: um "concurso" virtual que junta vários
  const concurso = combinado
    ? { id: combinado.chave, sigla: 'Combinado', nome: combinado.nome, fases: [], cargos: [], formato: 'A-E', dataProva: combinado.itens.map(dataDoItem).filter(Boolean).sort()[0] || '' }
    : ctx.concurso;
  const faseObj = concurso.fases?.find((f) => f.id === fase);
  const areaObj = faseObj?.areas?.find((a) => a.id === area);
  const dataProva = faseObj?.data || concurso.dataProva || '';
  const chave = combinado ? combinado.chave : [concurso.id, fase || '', area || ''].join('|');
  const salvo = prefs.cronogramas?.[chave];
  const [editando, setEditando] = useState(!salvo);
  const [passo, setPasso] = useState(0);
  const [cfg, setCfg] = useState(() => normalizar(salvo?.cfg, dataProva));
  const [todos, setTodos] = useState(false);
  const hojeIso = new Date().toLocaleDateString('sv-SE');
  const [reforcoSel, setReforcoSel] = useState('');
  const [reforcoInicio, setReforcoInicio] = useState(() => somarDias(hojeIso, 1));
  const [reforcoFim, setReforcoFim] = useState('');
  const set = (k, v) => setCfg((c) => ({ ...c, [k]: v }));

  const vert = combinado ? null : verticalizadoDe(prefs, concurso.id, fase, area);
  // usa o edital verticalizado do aluno (se houver); senão, as matérias do concurso
  const usarBase = editando ? cfg : normalizar(salvo?.cfg, dataProva);
  // cargos: o cronograma pode juntar as matérias de um ou vários cargos
  const listaCargos = concurso.cargos || [];
  const temCargos = listaCargos.length > 1;
  const cargosPadrao = cargo === 'ambos' || !cargo ? listaCargos.map((c) => c.id) : Array.isArray(cargo) ? cargo : [cargo];
  const cargosSel = (usarBase.cargos?.length ? usarBase.cargos : cargosPadrao).filter((id) => listaCargos.some((c) => c.id === id));
  const nomeCargo = (id) => listaCargos.find((c) => c.id === id)?.nome || id;

  // combinado sequencial: uma prova inteira antes da próxima, pela ordem de prioridade escolhida
  const itensPriorizados = useMemo(
    () => (combinado ? itensNaOrdem(combinado.itens, usarBase.ordemItens) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [combinado?.chave, (usarBase.ordemItens || []).join()],
  );
  // combinado: matérias mescladas + data final de cada prova + peso do edital, tudo junto
  const doCombinado = useMemo(
    () => (combinado ? discsDoCombinado(combinado.itens, usarBase) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [combinado?.chave, usarBase],
  );
  const fimPorItem = doCombinado?.fimPorItem || null;
  const discsMix = doCombinado?.discs || null;
  const discsCru = discsMix || (vert ? vert.disciplinas : disciplinasDo(concurso.id, temCargos ? (cargosSel.length ? cargosSel : 'ambos') : cargo, fase, area));
  // matérias com o peso que o edital dá a elas (no combinado o peso já vem da mescla)
  const discs = useMemo(
    () => (discsMix ? discsMix : discsCru.map((d) => ({ ...d, pesoEdital: pesoDoEdital(concurso, d, { fase, area }) }))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [discsMix, discsCru.map((d) => d.nome).join('|'), concurso.id, fase, area],
  );
  const discursiva = (faseObj?.formato || concurso.formato) === 'discursiva';

  // pesos do edital já preenchidos na etapa "Matérias" (sem mexer no que o usuário escolher depois)
  const assinaturaPesos = discs.map((d) => `${d.nome}:${d.pesoEdital || 1}`).join('|');
  useEffect(() => {
    if (!editando) return;
    setCfg((c) => {
      const materias = { ...(c.materias || {}) };
      let mudou = false;
      for (const d of discs) {
        if (!materias[d.nome]?.peso && (d.pesoEdital || 1) > 1) {
          materias[d.nome] = { ...materias[d.nome], peso: d.pesoEdital };
          mudou = true;
        }
      }
      return mudou ? { ...c, materias } : c;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editando, assinaturaPesos]);

  // no combinado, o cronograma vai até a última das provas (cada matéria para na prova dela)
  const usar = doCombinado?.cfg || usarBase;
  const sequencial = !!(combinado && usar.sequencial);
  const segmentos = useMemo(
    () => (sequencial ? segmentosSequenciais(itensPriorizados, usar.folgaDias, usar.inicio) : null),
    [sequencial, itensPriorizados, usar.folgaDias, usar.inicio],
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const sessoes = useMemo(() => {
    if (segmentos) {
      return segmentos.flatMap((seg) => {
        const c = getConcurso(seg.cid);
        const f = c?.fases?.find((x) => x.id === seg.fase);
        const discSeg = disciplinasDo(seg.cid, seg.cargo || 'ambos', seg.fase || '', seg.area || '');
        const cfgSeg = { ...usar, inicio: seg.inicio, fim: seg.fim };
        const discursivaSeg = (f?.formato || c?.formato) === 'discursiva';
        return gerarCronograma(cfgSeg, discSeg, { discursiva: discursivaSeg }).map((s) => ({ ...s, origemCid: seg.cid, origemSigla: c?.sigla }));
      });
    }
    return gerarCronograma(usar, discs, { discursiva });
  }, [usar, discs.length, discursiva, concurso.id, fase, area, cargosSel.join(), segmentos]);
  const fimParaRevisoes = segmentos ? segmentos.at(-1)?.fim || usar.fim : usar.fim;
  const revisoes = useMemo(() => gerarRevisoes(sessoes, { ...usar, fim: fimParaRevisoes }), [sessoes, usar, fimParaRevisoes]);
  const feitos = salvo?.feitos || {};
  const hoje = new Date().toLocaleDateString('sv-SE');

  // reforço: plano pronto (dia a dia) ativado por cima deste cronograma, sem mexer nos blocos gerados
  const planoReforco = usar.reforco?.id ? REFORCOS.find((r) => r.id === usar.reforco.id) : null;
  const sessoesReforco = useMemo(
    () => (planoReforco ? gerarSessoesReforco(planoReforco.ciclo, usar.reforco.inicio, usar.reforco.fim, planoReforco.titulo) : []),
    [planoReforco, usar.reforco?.inicio, usar.reforco?.fim],
  );
  const fimSugeridoReforco = segmentos ? segmentos.at(-1)?.fim || usar.fim : usar.fim;
  const ativarReforco = (fimEscolhido) => {
    const fim = fimEscolhido || reforcoFim || fimSugeridoReforco;
    if (!reforcoSel || !reforcoInicio || !fim) return;
    salvar({ ...salvo, cfg: { ...usar, reforco: { id: reforcoSel, inicio: reforcoInicio, fim } } });
  };
  const desativarReforco = () => {
    const { reforco, ...resto } = usar;
    salvar({ ...salvo, cfg: resto });
  };

  const reordenarItem = (i, delta) => {
    const j = i + delta;
    if (!itensPriorizados || j < 0 || j >= itensPriorizados.length) return;
    const chaves = itensPriorizados.map(chaveItem);
    [chaves[i], chaves[j]] = [chaves[j], chaves[i]];
    set('ordemItens', chaves);
  };

  // cronogramas individuais dos concursos que entraram no combinado (somem quando o combinado é criado)
  const individuaisSubstituidos = combinado
    ? Object.keys(prefs.cronogramas || {}).filter((k) => !k.startsWith('mix|') && combinado.itens.some((it) => it.cid === k.split('|')[0]))
    : [];
  const salvar = (novo, { limparIndividuais = false } = {}) => {
    const mapa = { ...(prefs.cronogramas || {}) };
    // um cronograma combinado substitui os cronogramas individuais dos concursos dele:
    // fica só o combinado na lista, em vez de três cronogramas concorrentes
    if (limparIndividuais) for (const k of individuaisSubstituidos) delete mapa[k];
    setPrefs({ cronogramas: { ...mapa, [chave]: { ...novo, ...(combinado ? { mix: combinado.itens, nome: combinado.nome } : {}) } } });
  };
  const marcar = (k) => {
    const n = { ...feitos };
    n[k] ? delete n[k] : (n[k] = 1);
    salvar({ ...salvo, feitos: n });
  };

  const titulo = combinado ? `🔀 ${combinado.nome}` : `${concurso.sigla}${faseObj ? ` – ${faseObj.nome}` : ''}${areaObj ? ` – ${areaObj.nome}` : ''}`;
  // datas de prova de cada concurso combinado, na ordem de prioridade escolhida — pra nunca esconder
  // que são provas em datas diferentes atrás de uma data única só
  const datasPorItem = combinado
    ? (itensPriorizados || combinado.itens).map((it) => ({ sigla: getConcurso(it.cid)?.sigla || '?', prova: dataDoItem(it) }))
    : null;
  const horas = Math.round(sessoes.reduce((s, x) => s + minutos(x.fim) - minutos(x.ini), 0) / 60);

  function baixarIcs() {
    const blob = new Blob([gerarIcs(sessoes, `Cronograma ${titulo}`)], { type: 'text/calendar' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `cronograma-${concurso.sigla.replace(/\W+/g, '-').toLowerCase()}.ics`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  function replanejar() {
    // tópicos já estudados saem da fila; o restante é redistribuído a partir de hoje
    const pular = new Set(usar.pular || []);
    for (const s of sessoes) if (s.tipo === 'estudo' && feitos[chaveSessao(s)]) (s.itens || []).forEach((t) => pular.add(`${s.disciplina}|${t}`));
    salvar({ ...salvo, cfg: { ...usar, inicio: hoje, pular: [...pular] } });
    setCfg({ ...usar, inicio: hoje, pular: [...pular] });
  }

  const passos = ['Modo', ...(combinado ? ['Prioridade'] : []), ...PASSOS.slice(1).filter((p) => p !== 'Cargos' || temCargos)];
  const nomePasso = passos[passo];
  if (editando) {
    const mat = (nome) => cfg.materias[nome] || {};
    const setMat = (nome, v) => set('materias', { ...cfg.materias, [nome]: { ...mat(nome), ...v } });
    // lista todas (inclusive as desmarcadas), mas na mesma ordem que o cronograma vai usar
    const todasAtivas = Object.fromEntries(Object.entries(cfg.materias || {}).map(([k, v]) => [k, { ...v, ativa: true }]));
    const ordenadas = materiasAtivas({ ...cfg, materias: todasAtivas }, discs);
    const mover = (i, delta) => {
      const nomes = ordenadas.map((d) => d.nome);
      const j = i + delta;
      if (j < 0 || j >= nomes.length) return;
      [nomes[i], nomes[j]] = [nomes[j], nomes[i]];
      set('ordem', nomes);
    };
    const ativas = materiasAtivas(cfg, discs);
    const blocosSemana = ORDEM_DIAS.filter((d) => cfg.dias.includes(d)).reduce((s, d) => s + blocosNoDia(cfg, d), 0);
    const minSemana = blocosSemana * cfg.bloco;
    const somaPesos = ativas.reduce((s, d) => s + pesoDa(cfg.materias[d.nome]), 0) || 1;
    const contagem = {};
    for (const s of sessoes) if (s.tipo !== 'revisao-final') contagem[s.disciplina] = (contagem[s.disciplina] || 0) + 1;
    const semAparecer = ativas.filter((d) => !contagem[d.nome]).map((d) => d.nome);
    const ultimo = passo === passos.length - 1;

    // no combinado, guarda a data final real (a última das provas), pra lista e cards não mostrarem a primeira
    const confirmar = () => { salvar({ cfg: combinado && !cfg.sequencial ? { ...cfg, fim: usar.fim } : cfg, feitos: salvo?.feitos || {} }, { limparIndividuais: true }); setEditando(false); };

    return (
      <div>
        {voltar && <button className="btn peq" onClick={voltar} style={{ marginBottom: 8 }}>← Meus cronogramas</button>}
        <h1>📆 {salvo ? 'Ajustar cronograma' : 'Montar meu cronograma'}</h1>
        <p className="sub">{titulo} · {discs.length} {discs.length === 1 ? 'matéria' : 'matérias'} · {discs.reduce((s, d) => s + (d.topicos?.length || 0), 0)} tópicos{!datasPorItem && dataProva ? ` · prova em ${fmtData(dataProva)}` : ''}</p>
        {datasPorItem && (
          <p className="sub peq">
            {datasPorItem.map((d, i) => (
              <span key={i}>{i > 0 && ' · '}<b>{d.sigla}</b>: {d.prova ? `prova em ${fmtData(d.prova)}` : 'sem data de prova cadastrada'}</span>
            ))}
          </p>
        )}
        <ol className="passos" aria-label="Etapas">
          {passos.map((p, i) => (
            <li key={p}><button aria-current={i === passo ? 'step' : undefined} onClick={() => setPasso(i)}>{i < passo ? '✓' : i + 1}. {p}</button></li>
          ))}
        </ol>

        {nomePasso === 'Modo' && (
          <section className="card">
            <h2>Como você prefere estudar?</h2>
            <div className="opcoes-modo">
              {[
                ['fixo', '📌 Fixo (previsível)', 'Cada dia da semana tem sempre as mesmas matérias. Ex.: segunda = Português e Penal. Bom para quem tem rotina estável.'],
                ['ciclo', '🔄 Ciclo (dinâmico)', 'As matérias seguem uma sequência, sem dia fixo. Se você perder um dia, o ciclo continua de onde parou ao replanejar.'],
              ].map(([v, t, d]) => (
                <label key={v} className={`opcao${cfg.modo === v ? ' sel' : ''}`}>
                  <input type="radio" name="modo" className="oculto" checked={cfg.modo === v} onChange={() => set('modo', v)} />
                  <b>{cfg.modo === v ? '✓ ' : ''}{t}</b>
                  <span className="peq sub">{d}</span>
                </label>
              ))}
            </div>
            <div className="filtros" style={{ marginTop: 12 }}>
              <label className="campo">Começar em<input type="date" style={campo} value={cfg.inicio} onChange={(e) => set('inicio', e.target.value)} /></label>
              {!sequencial && !fimPorItem && (
                <label className="campo">Até (véspera da prova)<input type="date" style={campo} value={cfg.fim} onChange={(e) => set('fim', e.target.value)} /></label>
              )}
              {!sequencial && fimPorItem && itensPriorizados.map((it) => {
                const k = chaveItem(it);
                const c = getConcurso(it.cid);
                return (
                  <label key={k} className="campo">
                    Estudar {c?.sigla} até
                    <input type="date" style={campo} value={fimPorItem[k] || ''} onChange={(e) => set('fimPorItem', { ...(cfg.fimPorItem || {}), [k]: e.target.value })} />
                  </label>
                );
              })}
            </div>
            {!sequencial && fimPorItem && (
              <p className="sub peq">Cada prova tem a sua data: as matérias de cada concurso são agendadas só até a véspera da prova dele. Depois que uma prova passa, o cronograma continua com as matérias da outra.</p>
            )}
            {!dataProva && !sequencial && !fimPorItem && <p className="sub peq">A data da prova ainda não está cadastrada; escolha a data final acima.</p>}
            {sequencial && <p className="sub peq">A data final de cada prova é calculada no passo "Prioridade", a partir da ordem escolhida.</p>}
          </section>
        )}

        {nomePasso === 'Prioridade' && (
          <section className="card">
            <h2>Como combinar as provas?</h2>
            <div className="opcoes-modo">
              {[
                [false, '🔀 Misturado', 'As matérias de todas as provas ficam juntas, intercaladas, do início ao fim do cronograma.'],
                [true, '➡️ Sequencial (uma prova por vez)', 'Estuda uma prova inteira primeiro (pela ordem de prioridade abaixo) e só passa pra próxima depois.'],
              ].map(([v, t, d]) => (
                <label key={String(v)} className={`opcao${!!cfg.sequencial === v ? ' sel' : ''}`}>
                  <input type="radio" name="sequencial" className="oculto" checked={!!cfg.sequencial === v} onChange={() => set('sequencial', v)} />
                  <b>{!!cfg.sequencial === v ? '✓ ' : ''}{t}</b>
                  <span className="peq sub">{d}</span>
                </label>
              ))}
            </div>
            <p className="sub peq" style={{ marginTop: 12 }}>
              {cfg.sequencial
                ? 'Defina qual prova é mais importante pra você: a primeira da lista é estudada até terminar (deixando a folga de dias abaixo antes dela), depois o cronograma passa pra próxima.'
                : 'Defina qual prova é mais prioritária pra você agora (1º lugar = mais prioritária). No modo Misturado isso é só uma anotação — as matérias de todas as provas continuam misturadas do mesmo jeito; pra estudar uma prova inteira antes da outra, escolha o modo Sequencial acima.'}
            </p>
            <ul className="lista-materias">
              {itensPriorizados.map((it, i) => {
                const c = getConcurso(it.cid);
                const seg = segmentos?.[i];
                const data = datasPorItem?.[i];
                return (
                  <li key={chaveItem(it)} className="linha" style={{ alignItems: 'center' }}>
                    <span style={{ flex: 1 }}>
                      <b>{i + 1}º: {c?.sigla}</b>
                      {seg ? (
                        <span className="peq sub" style={{ display: 'block' }}>
                          {seg.prova ? `Prova em ${fmtData(seg.prova)} · estuda ` : 'Sem data de prova cadastrada · estuda '}
                          de {fmtData(seg.inicio)} a {fmtData(seg.fim)}
                        </span>
                      ) : (
                        <span className="peq sub" style={{ display: 'block' }}>
                          {data?.prova ? `Prova em ${fmtData(data.prova)}` : 'Sem data de prova cadastrada'}
                        </span>
                      )}
                    </span>
                    <button className="btn peq" aria-label={`Subir prioridade de ${c?.sigla}`} disabled={i === 0} onClick={() => reordenarItem(i, -1)}>↑</button>
                    <button className="btn peq" aria-label={`Baixar prioridade de ${c?.sigla}`} disabled={i === itensPriorizados.length - 1} onClick={() => reordenarItem(i, 1)}>↓</button>
                  </li>
                );
              })}
            </ul>
            {cfg.sequencial && (
              <label className="campo" style={{ maxWidth: 320, marginTop: 8 }}>
                Parar de estudar cada prova quantos dias antes dela
                <input type="number" min="0" max="15" style={campo} value={cfg.folgaDias ?? 2} onChange={(e) => set('folgaDias', Math.max(0, +e.target.value || 0))} />
              </label>
            )}
          </section>
        )}

        {nomePasso === 'Cargos' && (
          <section className="card">
            <h2>Para quais cargos você vai estudar?</h2>
            <p className="sub peq">Marque um ou mais. As matérias do cronograma serão as dos cargos marcados; as comuns aparecem uma vez só.</p>
            <div className="escolha">
              {listaCargos.map((k) => {
                const on = cargosSel.includes(k.id);
                const n = disciplinasDo(concurso.id, k.id, fase, area).length;
                return (
                  <button key={k.id} type="button" role="checkbox" aria-checked={on} className="card bloco-card" style={{ margin: 0, borderWidth: 2, borderColor: on ? 'var(--pri)' : undefined, background: on ? 'var(--pri-claro)' : undefined }}
                    onClick={() => {
                      const novo = on ? cargosSel.filter((x) => x !== k.id) : [...cargosSel, k.id];
                      set('cargos', novo);
                      const pc = prefs.concursos?.[concurso.id] || {};
                      setPrefs({ concursos: { ...(prefs.concursos || {}), [concurso.id]: { ...pc, cargo: novo.length === listaCargos.length ? 'ambos' : novo.length === 1 ? novo[0] : novo } } });
                    }}>
                    <b>{on ? '☑' : '☐'} {k.nome}</b>
                    <span className="peq sub" style={{ display: 'block' }}>{n} {n === 1 ? 'matéria' : 'matérias'}</span>
                  </button>
                );
              })}
            </div>
            {!cargosSel.length && <p className="aviso">Marque pelo menos um cargo.</p>}
          </section>
        )}

        {nomePasso === 'Matérias' && (
          <section className="card">
            <h2>Quais matérias e qual o seu nível em cada uma?</h2>
            <p className="sub peq">Quanto mais fraco o seu nível (e maior o peso na prova), mais vezes a matéria aparece. Use ↑ ↓ para definir a prioridade: as primeiras entram antes.</p>
            {!discs.length && <p className="aviso">Este concurso ainda não tem disciplinas cadastradas. Importe o edital na ficha do concurso.</p>}
            <ul className="lista-materias">
              {ordenadas.map((d, i) => {
                const m = mat(d.nome);
                const ativa = m.ativa !== false;
                const nivel = m.nivel || 3;
                return (
                  <li key={d.nome} style={{ opacity: ativa ? 1 : 0.55 }}>
                    <div className="linha" style={{ alignItems: 'center' }}>
                      <label style={{ flex: 1, display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input type="checkbox" checked={ativa} onChange={() => setMat(d.nome, { ativa: !ativa })} style={{ width: 20, height: 20 }} />
                        <span>
                          <b>{d.nome}</b>
                          {d.origens?.length > 0 && <span className="peq sub" style={{ display: 'block' }}>concursos: {d.origens.join(' · ')}</span>}
                          {temCargos && (
                            <span className="peq sub" style={{ display: 'block' }}>
                              {!d.cargos?.length || d.cargos.length === listaCargos.length ? 'todos os cargos' : `cargo: ${d.cargos.filter((c) => cargosSel.includes(c)).map(nomeCargo).join(' · ') || d.cargos.map(nomeCargo).join(' · ')}`}
                            </span>
                          )}
                        </span>
                      </label>
                      <button className="btn peq" aria-label={`Subir ${d.nome}`} disabled={i === 0} onClick={() => mover(i, -1)}>↑</button>
                      <button className="btn peq" aria-label={`Descer ${d.nome}`} disabled={i === ordenadas.length - 1} onClick={() => mover(i, 1)}>↓</button>
                    </div>
                    {ativa && (
                      <div className="filtros" style={{ marginTop: 6 }}>
                        <label className="campo">Meu nível: <b>{NIVEIS[nivel - 1]}</b>
                          <input type="range" min="1" max="5" value={nivel} onChange={(e) => setMat(d.nome, { nivel: +e.target.value })} aria-valuetext={NIVEIS[nivel - 1]} />
                        </label>
                        <label className="campo">Peso na prova
                          <select style={campo} value={m.peso || 1} onChange={(e) => setMat(d.nome, { peso: +e.target.value })}>
                            <option value="1">Normal</option><option value="2">Alto (2×)</option><option value="3">Muito alto (3×)</option>
                          </select>
                          {(d.pesoEdital || 1) > 1 && (
                            <span className="peq sub">
                              {d.pesoEdital === 3 ? 'Pelo edital: prova prático-profissional (2ª fase) — sugerido Muito alto' : 'Pelo edital: matéria de peso 2 — sugerido Alto'}
                            </span>
                          )}
                        </label>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {nomePasso === 'Dias e horas' && (
          <section className="card">
            <h2>Em quais dias e horários você vai estudar?</h2>
            <p className="sub peq" style={{ marginTop: 0 }}>
              Em cada dia você escolhe: <b>Por horário</b> (ex.: das 19h às 22h, com hora marcada) ou <b>Por horas</b> (ex.: 6 horas no domingo, você encaixa no horário que der — o cronograma mostra os blocos sem hora marcada).
            </p>
            <ul className="lista-materias">
              {ORDEM_DIAS.map((d) => {
                const on = cfg.dias.includes(d);
                const [a, b] = cfg.janelas[d];
                const n = blocosNoDia(cfg, d);
                const porHoras = cfg.modoDia?.[d] === 'horas';
                const setJ = (i, v) => set('janelas', { ...cfg.janelas, [d]: i === 0 ? [v, b] : [a, v] });
                const horasJanela = Math.max(0, minutos(b) - minutos(a)) / 60;
                const setHorasJanela = (h) => { const horas = Math.max(0, Math.min(16, h)); setJ(1, paraHora(minutos(a) + horas * 60)); };
                const horasSoltas = cfg.horasDia?.[d] ?? horasJanela;
                const setHorasSoltas = (h) => set('horasDia', { ...(cfg.horasDia || {}), [d]: Math.max(0, Math.min(16, h)) });
                const trocarModo = (m) => {
                  set('modoDia', { ...(cfg.modoDia || {}), [d]: m });
                  if (m === 'horas' && cfg.horasDia?.[d] == null) set('horasDia', { ...(cfg.horasDia || {}), [d]: horasJanela });
                };
                return (
                  <li key={d} className="linha" style={{ alignItems: 'center', opacity: on ? 1 : 0.55, flexWrap: 'wrap' }}>
                    <label style={{ minWidth: 110, display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input type="checkbox" checked={on} onChange={() => set('dias', on ? cfg.dias.filter((x) => x !== d) : [...cfg.dias, d].sort())} style={{ width: 20, height: 20 }} />
                      <b>{NOME_DIA[d]}</b>
                    </label>
                    {on && (
                      <>
                        <select aria-label={`${NOME_DIA[d]}: como definir o estudo`} style={{ ...campo, width: 'auto' }} value={porHoras ? 'horas' : 'horario'} onChange={(e) => trocarModo(e.target.value)}>
                          <option value="horario">Por horário</option>
                          <option value="horas">Por horas</option>
                        </select>
                        {porHoras ? (
                          <label className="peq" style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                            <input type="number" min="0" max="16" step="0.5" aria-label={`${NOME_DIA[d]}: horas de estudo no dia`} style={{ ...campo, width: 70 }} value={horasSoltas} onChange={(e) => setHorasSoltas(+e.target.value || 0)} />
                            horas no dia, sem hora marcada
                          </label>
                        ) : (
                          <>
                            <input type="time" aria-label={`${NOME_DIA[d]}: início`} style={{ ...campo, width: 'auto' }} value={a} onChange={(e) => setJ(0, e.target.value)} />
                            <span>até</span>
                            <input type="time" aria-label={`${NOME_DIA[d]}: fim`} style={{ ...campo, width: 'auto' }} value={b} onChange={(e) => setJ(1, e.target.value)} />
                            <label className="peq" style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                              ou
                              <input type="number" min="0" max="16" step="0.5" aria-label={`${NOME_DIA[d]}: quantidade de horas de estudo`} style={{ ...campo, width: 64 }} value={horasJanela} onChange={(e) => setHorasJanela(+e.target.value || 0)} />
                              horas
                            </label>
                          </>
                        )}
                        <span className="peq sub">{n} {n === 1 ? 'bloco' : 'blocos'} · {fmtHoras(n * cfg.bloco)}</span>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
            <p className="sub">Total: <b>{blocosSemana} blocos</b> e <b>{fmtHoras(minSemana)}</b> de estudo por semana.</p>
          </section>
        )}

        {nomePasso === 'Blocos' && (
          <section className="card">
            <h2>Como serão os blocos de estudo?</h2>
            <div className="filtros">
              <label className="campo">Duração de cada bloco (min)<input type="number" min="15" max="180" step="5" style={campo} value={cfg.bloco} onChange={(e) => set('bloco', Math.max(15, +e.target.value || 50))} /></label>
              <label className="campo">Pausa entre blocos (min)<input type="number" min="0" max="60" style={campo} value={cfg.pausa} onChange={(e) => set('pausa', Math.max(0, +e.target.value || 0))} /></label>
              <label className="campo">Matérias diferentes por dia
                <select style={campo} value={cfg.simultaneas} onChange={(e) => set('simultaneas', +e.target.value)}>
                  {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
                  <option value="0">Sem limite</option>
                </select>
              </label>
            </div>
            <p className="sub peq">Dica: blocos de 25 a 50 minutos funcionam bem com o cronômetro em modo Pomodoro. Estudar 2 ou 3 matérias por dia evita cansaço e mantém tudo em dia.</p>
          </section>
        )}

        {nomePasso === 'Revisões' && (
          <section className="card">
            <h2>Deseja incluir revisões?</h2>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="checkbox" checked={cfg.revisoes.length > 0} onChange={() => set('revisoes', cfg.revisoes.length ? [] : [1, 7, 14, 30])} style={{ width: 20, height: 20 }} />
              Incluir revisões espaçadas (o conteúdo volta depois de alguns dias, numa revisão rápida)
            </label>
            {cfg.revisoes.length > 0 && (
              <div className="linha" role="group" aria-label="Intervalos de revisão" style={{ marginTop: 8 }}>
                {INTERVALOS_REVISAO.map((i) => {
                  const on = cfg.revisoes.includes(i);
                  return (
                    <label key={i} className="btn peq" style={{ background: on ? 'var(--pri)' : undefined, color: on ? 'var(--pri-txt)' : undefined }}>
                      <input type="checkbox" className="oculto" checked={on} onChange={() => set('revisoes', on ? cfg.revisoes.filter((x) => x !== i) : [...cfg.revisoes, i].sort((x, y) => x - y))} />
                      {on ? '✓ ' : ''}{i} {i === 1 ? 'dia' : 'dias'}
                    </label>
                  );
                })}
              </div>
            )}
            <label className="campo" style={{ marginTop: 12, maxWidth: 320 }}>Dias finais só de revisão geral<input type="number" min="0" max="30" style={campo} value={cfg.diasRevisao} onChange={(e) => set('diasRevisao', Math.max(0, +e.target.value || 0))} /></label>
          </section>
        )}

        {nomePasso === 'Resumo' && (
          <section className="card">
            <h2>Resumo do seu cronograma</h2>
            <ul>
              <li>Modo: <b>{cfg.modo === 'ciclo' ? 'Ciclo (dinâmico)' : 'Fixo (previsível)'}</b></li>
              {temCargos && <li>Cargos: <b>{cargosSel.map(nomeCargo).join(', ')}</b></li>}
              <li><b>{blocosSemana} blocos</b> de {cfg.bloco} min por semana ({fmtHoras(minSemana)})</li>
              <li>Dias: {ORDEM_DIAS.filter((d) => cfg.dias.includes(d)).map((d) => `${NOME_DIA[d]} (${fmtHoras(blocosNoDia(cfg, d) * cfg.bloco)})`).join(', ') || 'nenhum'}</li>
              <li>Até {cfg.simultaneas || 'todas as'} matérias por dia</li>
              <li>Revisões: {cfg.revisoes.length ? cfg.revisoes.map((i) => `${i} ${i === 1 ? 'dia' : 'dias'}`).join(', ') : 'não incluídas'}{cfg.diasRevisao ? ` · ${cfg.diasRevisao} dias finais de revisão geral` : ''}</li>
              <li>No total: <b>{sessoes.length} blocos</b>, <b>{horas} horas</b>{sessoes.length > 0 && <> · de {fmtData(sessoes[0].data)} a {fmtData(sessoes.at(-1).data)}</>}</li>
            </ul>
            {individuaisSubstituidos.length > 0 && (
              <p className="aviso">
                Ao salvar, {individuaisSubstituidos.length === 1 ? 'o cronograma individual' : 'os cronogramas individuais'} de{' '}
                <b>{[...new Set(individuaisSubstituidos.map((k) => getConcurso(k.split('|')[0])?.sigla || '?'))].join(' e ')}</b>{' '}
                {individuaisSubstituidos.length === 1 ? 'será excluído' : 'serão excluídos'} — fica só este combinado na sua lista.
              </p>
            )}
            {segmentos && (
              <>
                <h3 style={{ marginBottom: 4 }}>Ordem das provas</h3>
                <ul>
                  {segmentos.map((seg) => {
                    const c = getConcurso(seg.cid);
                    return (
                      <li key={chaveItem(seg)}>
                        <b>{c?.sigla}</b>: {fmtData(seg.inicio)} a {fmtData(seg.fim)}{seg.prova ? ` (prova em ${fmtData(seg.prova)})` : ' (sem data de prova)'}
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
            <h3 style={{ marginBottom: 4 }}>Distribuição inteligente</h3>
            <div className="hbar">
              {ativas.map((d) => (
                <FragmentoBarra key={d.nome} nome={d.nome} n={contagem[d.nome] || 0} pct={(pesoDa(cfg.materias[d.nome]) / somaPesos) * 100} />
              ))}
            </div>
            {semAparecer.length > 0 && <p className="aviso">Sem blocos para: {semAparecer.join(', ')}. Aumente os dias/horários ou o limite de matérias por dia.</p>}
          </section>
        )}

        <div className="linha">
          {passo > 0 && <button className="btn" onClick={() => setPasso(passo - 1)}>← Voltar</button>}
          {!ultimo && <button className="btn pri" disabled={nomePasso === 'Cargos' && !cargosSel.length} onClick={() => setPasso(passo + 1)}>Continuar →</button>}
          {(ultimo || salvo) && <button className={`btn${ultimo ? ' pri' : ''}`} disabled={!sessoes.length} onClick={confirmar}>{salvo ? 'Salvar alterações' : '✓ Criar cronograma'}</button>}
          {salvo && <button className="btn" onClick={() => { setCfg(normalizar(salvo.cfg, dataProva)); setEditando(false); }}>Cancelar</button>}
        </div>
      </div>
    );
  }

  const feitas = sessoes.filter((s) => feitos[chaveSessao(s)]).length;
  const atrasadas = sessoes.filter((s) => s.data < hoje && !feitos[chaveSessao(s)]).length;
  const porDia = new Map();
  for (const s of sessoes) {
    if (!porDia.has(s.data)) porDia.set(s.data, { s: [], r: [], f: [] });
    porDia.get(s.data).s.push(s);
  }
  for (const r of revisoes) if (porDia.has(r.data)) porDia.get(r.data).r.push(r);
  for (const f of sessoesReforco) {
    if (!porDia.has(f.data)) porDia.set(f.data, { s: [], r: [], f: [] });
    porDia.get(f.data).f.push(f);
  }
  const dias = [...porDia.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const proximos = todos ? dias : dias.filter(([d]) => d >= hoje).slice(0, 14);
  const revPendentes = revisoes.filter((r) => r.data <= hoje && !feitos[chaveRevisao(r)]).length;

  const Sessao = ({ s }) => {
    const k = chaveSessao(s);
    const ok = !!feitos[k];
    return (
      <li className="sessao">
        <input type="checkbox" checked={ok} onChange={() => marcar(k)} aria-label={`Concluída: ${s.disciplina} ${s.ini ? `às ${s.ini}` : `(bloco ${(s.idx ?? 0) + 1})`}`} />
        <div style={{ flex: 1, opacity: ok ? 0.6 : 1 }}>
          <div className="peq sub">{s.ini ? `${s.ini}–${s.fim}` : `Bloco ${(s.idx ?? 0) + 1} · ${fmtHoras(usar.bloco)} (sem hora marcada)`} {s.origemSigla && <span>· {s.origemSigla}</span>} {s.tipo !== 'estudo' && <span>· 🔁 revisão</span>} {ok && <b className="sobe">· ✓ feito</b>}</div>
          <b>{s.disciplina}</b>
          <div className="peq">{s.tema}</div>
        </div>
        <div className="acoes-sessao">
          <button className="praticar peq" onClick={() => cronometrar(s.disciplina, s.tema, chave)} title="Abre o cronômetro já com esta matéria e este cronograma selecionado, pra dar baixa automática ao salvar">⏱ cronometrar</button>
          <button className="praticar peq" onClick={() => abrirAvulsas({ materia: s.disciplina, mostrar: 'nao' })}>✎ questões</button>
        </div>
      </li>
    );
  };
  const Revisao = ({ r }) => {
    const k = chaveRevisao(r);
    const ok = !!feitos[k];
    return (
      <li className="sessao">
        <input type="checkbox" checked={ok} onChange={() => marcar(k)} aria-label={`Revisão feita: ${r.disciplina}`} />
        <div style={{ flex: 1, opacity: ok ? 0.6 : 1 }}>
          <div className="peq sub">🔁 revisão de {r.intervalo} {r.intervalo === 1 ? 'dia' : 'dias'} · estudado em {fmtData(r.origem)} {ok && <b className="sobe">· ✓ feita</b>}</div>
          <b>{r.disciplina}</b>
          <div className="peq">{r.tema}</div>
        </div>
      </li>
    );
  };
  const ReforcoItem = ({ s }) => {
    const k = chaveSessao(s);
    const ok = !!feitos[k];
    return (
      <li className="sessao">
        <input type="checkbox" checked={ok} onChange={() => marcar(k)} aria-label={`Reforço feito: ${s.tema}`} />
        <div style={{ flex: 1, opacity: ok ? 0.6 : 1 }}>
          <div className="peq sub">📋 reforço {ok && <b className="sobe">· ✓ feito</b>}</div>
          <div className="peq">{s.tema}</div>
        </div>
      </li>
    );
  };

  return (
    <div>
      {voltar && <button className="btn peq" onClick={voltar} style={{ marginBottom: 8 }}>← Meus cronogramas</button>}
      <div className="linha entre">
        <h1 style={{ margin: 0 }}>📆 Cronograma de estudos</h1>
        <div className="linha">
          <button className="btn peq" onClick={() => { setPasso(0); setEditando(true); }}>⚙️ Ajustar</button>
          <button className="btn peq" onClick={baixarIcs}>📅 Baixar para a agenda (.ics)</button>
          <button className="btn peq" onClick={() => { setTodos(true); setTimeout(() => window.print(), 300); }}>🖨️ Imprimir / PDF</button>
        </div>
      </div>
      <p className="sub">{titulo}{dataProva ? ` · prova em ${fmtData(dataProva)}` : ''}{vert ? ' · baseado no seu edital verticalizado' : ''}</p>
      <ProximaData
        eventos={
          combinado
            ? combinado.itens
                .flatMap((it) => {
                  const c = getConcurso(it.cid);
                  return c ? eventosDoAluno(c, prefs, it.fase).map((e) => ({ ...e, titulo: `${c.sigla}: ${e.titulo}` })) : [];
                })
                .sort((a, b) => a.data.localeCompare(b.data))
            : eventosDoAluno(concurso, prefs, fase)
        }
      />
      {atrasadas > 0 && (
        <p className="aviso">
          ⚠️ {atrasadas} {atrasadas === 1 ? 'bloco atrasado' : 'blocos atrasados'}. {usar.modo === 'ciclo' ? 'No modo ciclo, ' : ''}você pode replanejar: o que já foi feito sai da fila e o restante é redistribuído a partir de hoje.{' '}
          <button className="btn peq" onClick={replanejar}>↻ Replanejar a partir de hoje</button>
        </p>
      )}
      <div className="resumos">
        <div className="card"><div className="sub">Blocos feitos</div><div className="numero">{feitas}/{sessoes.length}</div><div className="barra"><i style={{ width: `${(feitas / Math.max(1, sessoes.length)) * 100}%` }} /></div></div>
        <div className="card"><div className="sub">Carga total</div><div className="numero">{horas} h</div><div className="peq sub">{dias.filter(([, ss]) => ss.s.length).length} dias de estudo</div></div>
        <div className="card"><div className="sub">Revisões pendentes</div><div className="numero">{revPendentes}</div><div className="peq sub">{usar.revisoes?.length ? `a cada ${usar.revisoes.join(', ')} dias` : 'revisões espaçadas desligadas'}</div></div>
        <div className="card"><div className="sub">Atrasadas</div><div className="numero" style={{ color: atrasadas ? 'var(--erro)' : 'var(--ok)' }}>{atrasadas}</div><div className="peq sub">{atrasadas ? 'sessões passadas não marcadas' : 'em dia ✓'}</div></div>
      </div>
      <div className="card">
        {planoReforco ? (
          <>
            <h3 className="col-tit">📋 Reforço ativo: {planoReforco.titulo}</h3>
            <p className="peq sub">De {fmtData(usar.reforco.inicio)} até {fmtData(usar.reforco.fim)}. Aparece como uma coluna extra em cada dia, só como lembrete — não entra nas contagens de blocos acima.</p>
            <button className="btn peq" onClick={desativarReforco}>Desativar reforço</button>
          </>
        ) : (
          <>
            <h3 className="col-tit">📋 Reforço de um plano pronto</h3>
            <p className="peq sub">Mostra, dia a dia, um plano de estudo externo (de um curso, por exemplo) como lembrete junto deste cronograma — sem mudar os blocos gerados.</p>
            <div className="linha" style={{ flexWrap: 'wrap', gap: 8 }}>
              <select className="campo" value={reforcoSel} onChange={(e) => setReforcoSel(e.target.value)}>
                <option value="">Escolha um plano…</option>
                {REFORCOS.map((r) => <option key={r.id} value={r.id}>{r.titulo}</option>)}
              </select>
              <label className="campo peq">Início<input type="date" value={reforcoInicio} onChange={(e) => setReforcoInicio(e.target.value)} /></label>
              <label className="campo peq">Até<input type="date" value={reforcoFim || fimSugeridoReforco} onChange={(e) => setReforcoFim(e.target.value)} /></label>
              <button className="btn pri peq" disabled={!reforcoSel || !reforcoInicio || !(reforcoFim || fimSugeridoReforco)} onClick={() => ativarReforco(reforcoFim || fimSugeridoReforco)}>Ativar</button>
            </div>
          </>
        )}
      </div>
      {proximos.map(([d, ss]) => (
        <section key={d} className="card" style={{ borderColor: d === hoje ? 'var(--pri)' : undefined }}>
          <h2 style={{ marginBottom: 2 }}>{d === hoje ? 'Hoje · ' : ''}{nomeDia(d)}, {fmtData(d)}</h2>
          <div className="dia-colunas">
            <div>
              <h3 className="col-tit">📘 Estudos <span className="sub peq">({ss.s.filter((s) => feitos[chaveSessao(s)]).length}/{ss.s.length})</span></h3>
              <ul className="lista-sessoes">{ss.s.map((s) => <Sessao key={chaveSessao(s)} s={s} />)}</ul>
            </div>
            <div>
              <h3 className="col-tit">🔁 Revisões <span className="sub peq">({ss.r.filter((r) => feitos[chaveRevisao(r)]).length}/{ss.r.length})</span></h3>
              {ss.r.length ? <ul className="lista-sessoes">{ss.r.map((r) => <Revisao key={chaveRevisao(r)} r={r} />)}</ul> : <p className="peq sub">Nenhuma revisão para este dia.</p>}
            </div>
            {ss.f.length > 0 && (
              <div>
                <h3 className="col-tit">📋 Reforço <span className="sub peq">({ss.f.filter((f) => feitos[chaveSessao(f)]).length}/{ss.f.length})</span></h3>
                <ul className="lista-sessoes">{ss.f.map((s) => <ReforcoItem key={chaveSessao(s)} s={s} />)}</ul>
              </div>
            )}
          </div>
        </section>
      ))}
      {!proximos.length && <p className="card sub">Não há sessões futuras. Use "Ajustar" para gerar um novo período.</p>}
      <button className="btn" onClick={() => setTodos(!todos)}>{todos ? 'Mostrar só os próximos 14 dias' : `Mostrar todos os ${dias.length} dias`}</button>
      <p className="sub peq" style={{ marginTop: 10 }}>
        Para ver no Google Agenda: baixe o arquivo .ics e, no computador, abra o Google Agenda → Configurações → Importar e exportar → Importar. Se quiser, crie antes uma agenda separada (por exemplo, "Estudos") e importe nela.
      </p>
    </div>
  );
}

function FragmentoBarra({ nome, n, pct }) {
  return (
    <>
      <span>{nome}</span>
      <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <span className="trilho" style={{ flex: 1 }}><i style={{ width: `${Math.max(2, pct)}%` }} /></span>
        <span className="rot">{n} blocos · {Math.round(pct)}%</span>
      </span>
    </>
  );
}
