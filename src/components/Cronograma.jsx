import { getConcurso } from '../data/concursos.js';
import { useMemo, useState } from 'react';
import { disciplinasDo } from '../lib/dados.js';
import { chaveRevisao, chaveSessao, configPadrao, DIAS_SEMANA, gerarCronograma, gerarIcs, gerarRevisoes, gerarSessoesReforco, INTERVALOS_REVISAO, materiasAtivas, NIVEIS, pesoDa, somarDias } from '../lib/cronograma.js';
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
const blocosNoDia = (cfg, dow) => {
  const [a, b] = cfg.janelas[dow];
  const t = minutos(b) - minutos(a);
  return t >= cfg.bloco ? Math.floor((t + (cfg.pausa || 0)) / (cfg.bloco + (cfg.pausa || 0))) : 0;
};
const fmtHoras = (m) => (m % 60 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}` : `${m / 60}h`);

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
export function mesclarConcursos(itens) {
  const mapa = new Map();
  for (const it of itens) {
    const c = getConcurso(it.cid);
    if (!c) continue;
    // matéria da área da 2ª fase da OAB: conteúdo exclusivo (peça prático-profissional),
    // não é a mesma coisa que uma matéria de mesmo nome de outro concurso (ex.: "Direito
    // Constitucional" da OAB 2ª fase ≠ "Direito Constitucional" da PC/AC) — nunca mescla,
    // fica com um nome próprio pra aparecer separado no cronograma combinado.
    const ehAreaOAB2 = it.fase === 'f2' && !!it.area;
    for (const d of disciplinasDo(it.cid, it.cargo || 'ambos', it.fase || '', it.area || '')) {
      const k = ehAreaOAB2 ? `${normNome(d.nome)}::${it.cid}::${it.area}` : normNome(d.nome);
      const nomeExibido = ehAreaOAB2 ? `${d.nome} (${c.sigla})` : d.nome;
      const e = mapa.get(k) || { nome: nomeExibido, topicos: [], origens: [] };
      for (const t of d.topicos || []) if (!e.topicos.some((x) => normNome(x) === normNome(t))) e.topicos.push(t);
      if (!e.origens.includes(c.sigla)) e.origens.push(c.sigla);
      mapa.set(k, e);
    }
  }
  return [...mapa.values()];
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
  const usar = editando ? cfg : normalizar(salvo?.cfg, dataProva);
  // cargos: o cronograma pode juntar as matérias de um ou vários cargos
  const listaCargos = concurso.cargos || [];
  const temCargos = listaCargos.length > 1;
  const cargosPadrao = cargo === 'ambos' || !cargo ? listaCargos.map((c) => c.id) : Array.isArray(cargo) ? cargo : [cargo];
  const cargosSel = (usar.cargos?.length ? usar.cargos : cargosPadrao).filter((id) => listaCargos.some((c) => c.id === id));
  const nomeCargo = (id) => listaCargos.find((c) => c.id === id)?.nome || id;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const discsMix = useMemo(() => (combinado ? mesclarConcursos(combinado.itens) : null), [combinado?.chave]);
  const discs = discsMix || (vert ? vert.disciplinas : disciplinasDo(concurso.id, temCargos ? (cargosSel.length ? cargosSel : 'ambos') : cargo, fase, area));
  const discursiva = (faseObj?.formato || concurso.formato) === 'discursiva';

  // combinado sequencial: uma prova inteira antes da próxima, pela ordem de prioridade escolhida
  const itensPriorizados = useMemo(
    () => (combinado ? itensNaOrdem(combinado.itens, usar.ordemItens) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [combinado?.chave, (usar.ordemItens || []).join()],
  );
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

  const salvar = (novo) => setPrefs({ cronogramas: { ...(prefs.cronogramas || {}), [chave]: { ...novo, ...(combinado ? { mix: combinado.itens, nome: combinado.nome } : {}) } } });
  const marcar = (k) => {
    const n = { ...feitos };
    n[k] ? delete n[k] : (n[k] = 1);
    salvar({ ...salvo, feitos: n });
  };

  const titulo = combinado ? `🔀 ${combinado.nome}` : `${concurso.sigla}${faseObj ? ` – ${faseObj.nome}` : ''}${areaObj ? ` – ${areaObj.nome}` : ''}`;
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
    const ordenadas = materiasAtivas({ ...cfg, materias: {} }, discs);
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

    const confirmar = () => { salvar({ cfg, feitos: salvo?.feitos || {} }); setEditando(false); };

    return (
      <div>
        {voltar && <button className="btn peq" onClick={voltar} style={{ marginBottom: 8 }}>← Meus cronogramas</button>}
        <h1>📆 {salvo ? 'Ajustar cronograma' : 'Montar meu cronograma'}</h1>
        <p className="sub">{titulo} · {discs.length} {discs.length === 1 ? 'matéria' : 'matérias'} · {discs.reduce((s, d) => s + (d.topicos?.length || 0), 0)} tópicos{dataProva ? ` · prova em ${fmtData(dataProva)}` : ''}</p>
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
              {!sequencial && (
                <label className="campo">Até (véspera da prova)<input type="date" style={campo} value={cfg.fim} onChange={(e) => set('fim', e.target.value)} /></label>
              )}
            </div>
            {!dataProva && !sequencial && <p className="sub peq">A data da prova ainda não está cadastrada; escolha a data final acima.</p>}
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
            {cfg.sequencial && (
              <>
                <p className="sub peq" style={{ marginTop: 12 }}>
                  Defina qual prova é mais importante pra você: a primeira da lista é estudada até terminar (deixando a folga de dias abaixo antes dela), depois o cronograma passa pra próxima.
                </p>
                <ul className="lista-materias">
                  {itensPriorizados.map((it, i) => {
                    const c = getConcurso(it.cid);
                    const seg = segmentos?.[i];
                    return (
                      <li key={chaveItem(it)} className="linha" style={{ alignItems: 'center' }}>
                        <span style={{ flex: 1 }}>
                          <b>{i + 1}º: {c?.sigla}</b>
                          {seg && (
                            <span className="peq sub" style={{ display: 'block' }}>
                              {seg.prova ? `Prova em ${fmtData(seg.prova)} · estuda ` : 'Sem data de prova cadastrada · estuda '}
                              de {fmtData(seg.inicio)} a {fmtData(seg.fim)}
                            </span>
                          )}
                        </span>
                        <button className="btn peq" aria-label={`Subir prioridade de ${c?.sigla}`} disabled={i === 0} onClick={() => reordenarItem(i, -1)}>↑</button>
                        <button className="btn peq" aria-label={`Baixar prioridade de ${c?.sigla}`} disabled={i === itensPriorizados.length - 1} onClick={() => reordenarItem(i, 1)}>↓</button>
                      </li>
                    );
                  })}
                </ul>
                <label className="campo" style={{ maxWidth: 320, marginTop: 8 }}>
                  Parar de estudar cada prova quantos dias antes dela
                  <input type="number" min="0" max="15" style={campo} value={cfg.folgaDias ?? 2} onChange={(e) => set('folgaDias', Math.max(0, +e.target.value || 0))} />
                </label>
              </>
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
            <ul className="lista-materias">
              {ORDEM_DIAS.map((d) => {
                const on = cfg.dias.includes(d);
                const [a, b] = cfg.janelas[d];
                const n = blocosNoDia(cfg, d);
                const setJ = (i, v) => set('janelas', { ...cfg.janelas, [d]: i === 0 ? [v, b] : [a, v] });
                return (
                  <li key={d} className="linha" style={{ alignItems: 'center', opacity: on ? 1 : 0.55 }}>
                    <label style={{ minWidth: 110, display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input type="checkbox" checked={on} onChange={() => set('dias', on ? cfg.dias.filter((x) => x !== d) : [...cfg.dias, d].sort())} style={{ width: 20, height: 20 }} />
                      <b>{NOME_DIA[d]}</b>
                    </label>
                    {on && (
                      <>
                        <input type="time" aria-label={`${NOME_DIA[d]}: início`} style={{ ...campo, width: 'auto' }} value={a} onChange={(e) => setJ(0, e.target.value)} />
                        <span>até</span>
                        <input type="time" aria-label={`${NOME_DIA[d]}: fim`} style={{ ...campo, width: 'auto' }} value={b} onChange={(e) => setJ(1, e.target.value)} />
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
        <input type="checkbox" checked={ok} onChange={() => marcar(k)} aria-label={`Concluída: ${s.disciplina} às ${s.ini}`} />
        <div style={{ flex: 1, opacity: ok ? 0.6 : 1 }}>
          <div className="peq sub">{s.ini}–{s.fim} {s.origemSigla && <span>· {s.origemSigla}</span>} {s.tipo !== 'estudo' && <span>· 🔁 revisão</span>} {ok && <b className="sobe">· ✓ feito</b>}</div>
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
