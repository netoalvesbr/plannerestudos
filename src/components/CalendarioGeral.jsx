import { useEffect, useMemo, useRef, useState } from 'react';
import { getConcurso } from '../data/concursos.js';
import { fmtData } from '../lib/stats.js';
import { eventosDoAluno } from '../lib/exameAnterior.js';
import { horarioDaProva, textoHorario } from '../lib/horarioProva.js';

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const DIA = 86400000;
const isoDe = (d) => d.toLocaleDateString('sv-SE');
const dataDe = (iso) => new Date(iso + 'T12:00:00');
const hojeIso = () => isoDe(new Date());

// Quando dois concursos têm a mesma sigla (ex.: dois editais da Câmara, um por cargo),
// o rótulo ganha o cargo pra dar pra saber de qual calendário se trata: "CMRB / Procurador"
const abreviarCargo = (nome) => {
  const base = (nome || '').split(/\s[–—-]\s/)[0].trim();
  return base.length > 26 ? `${base.slice(0, 25)}…` : base;
};
export function rotuloDoConcurso(c, todos, prefs) {
  if (todos.filter((x) => x.sigla === c.sigla).length < 2) return c.sigla;
  const escolhido = prefs?.concursos?.[c.id]?.cargo;
  const ids = Array.isArray(escolhido) ? escolhido : escolhido && escolhido !== 'ambos' ? [escolhido] : (c.cargos || []).map((k) => k.id);
  const nomes = ids.map((id) => (c.cargos || []).find((k) => k.id === id)?.nome).filter(Boolean);
  if (nomes.length) return `${c.sigla} / ${abreviarCargo(nomes[0])}${nomes.length > 1 ? ` +${nomes.length - 1}` : ''}`;
  // sem cargo cadastrado, o número do edital já separa um concurso do outro
  const n = /n[ºo°]?\s*(\d{1,3}\/\d{4})/i.exec(c.edital || '');
  return n ? `${c.sigla} / Edital ${n[1]}` : c.sigla;
}

// Tipo do evento a partir do texto do edital
export function tipoEvento(e) {
  const t = (e.titulo || '').toLowerCase();
  if (e.prova) return { rot: 'Dia de prova', ico: '🔴' };
  // isenção vem antes: "isenção da taxa" também casa com /taxa/, mas não é pagamento
  if (/isen[çc]/.test(t)) return { rot: 'Isenção da taxa', ico: '🆓' };
  if (/pagamento|boleto|taxa/.test(t)) return { rot: 'Pagamento da inscrição', ico: '💳' };
  if (/inscri[çc]/.test(t)) return { rot: 'Inscrições', ico: '📝' };
  if (/loca(l|is)/.test(t)) return { rot: 'Local de prova', ico: '📍' };
  if (/gabarito|padr[ãa]o de resposta/.test(t)) return { rot: 'Gabarito / padrão de resposta', ico: '✅' };
  if (/recurso/.test(t)) return { rot: 'Recursos', ico: '⚖️' };
  if (/resultado/.test(t)) return { rot: /preliminar/.test(t) ? 'Resultado preliminar' : /definitiv|final/.test(t) ? 'Resultado definitivo' : 'Resultado', ico: '📊' };
  if (/edital|publica/.test(t)) return { rot: 'Edital', ico: '📄' };
  if (/convoca|matr[íi]cula|curso de forma|t[íi]tulos|teste|exame|per[íi]cia|investiga/.test(t)) return { rot: 'Etapa do concurso', ico: '📌' };
  return { rot: 'Data importante', ico: '📌' };
}

export default function CalendarioGeral({ ctx }) {
  const { prefs, setPrefs } = ctx;
  const meus = (prefs.seguindo || []).map(getConcurso).filter(Boolean);
  const [filtro, setFiltro] = useState(prefs.calendario?.filtro || 'todos');
  const [visao, setVisao] = useState(prefs.calendario?.visao || 'mes');
  const [ref, setRef] = useState(hojeIso());
  const [aberto, setAberto] = useState(null);
  const fechar = useRef(null);

  const [novaTarefa, setNovaTarefa] = useState('');

  // tarefas e recados que o usuário anota em cada dia (prefs.tarefas = { '2026-11-12': [...] })
  const tarefas = prefs.tarefas || {};
  const tarefasDe = (dia) => tarefas[dia] || [];
  const salvarTarefas = (dia, lista) => {
    const n = { ...tarefas };
    if (lista.length) n[dia] = lista;
    else delete n[dia];
    setPrefs({ tarefas: n });
  };
  const adicionarTarefa = (dia, texto) => {
    const t = (texto || '').trim();
    if (!t) return;
    salvarTarefas(dia, [...tarefasDe(dia), { id: `${Date.now()}`, texto: t, feita: false }]);
    setNovaTarefa('');
  };
  const alternarTarefa = (dia, id) => salvarTarefas(dia, tarefasDe(dia).map((t) => (t.id === id ? { ...t, feita: !t.feita } : t)));
  const excluirTarefa = (dia, id) => salvarTarefas(dia, tarefasDe(dia).filter((t) => t.id !== id));

  const lembrar = (parcial) => setPrefs({ calendario: { ...(prefs.calendario || {}), filtro, visao, ...parcial } });
  const escolherFiltro = (v) => { setFiltro(v); lembrar({ filtro: v }); };
  const escolherVisao = (v) => { setVisao(v); lembrar({ visao: v }); setRef(hojeIso()); };

  // todos os eventos dos concursos escolhidos, com a sigla do concurso
  const eventos = useMemo(() => {
    const lista = filtro === 'todos' ? meus : meus.filter((c) => c.id === filtro);
    return lista
      .flatMap((c) => {
        const pc = prefs.concursos?.[c.id] || {};
        const h = horarioDaProva(c, { fase: pc.fase, cargo: pc.cargo });
        return eventosDoAluno(c, prefs).map((e) => ({
          ...e,
          concurso: rotuloDoConcurso(c, meus, prefs),
          concursoNome: c.nome,
          // horário do edital só interessa no dia da prova
          horario: e.prova ? textoHorario(h, e.data) : null,
          ...tipoEvento(e),
        }));
      })
      .sort((a, b) => a.data.localeCompare(b.data));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtro, prefs.seguindo, prefs.exameAnterior, prefs.concursos, ctx.bancoVersao]);

  // eventos por dia (períodos marcam todos os dias; o início e o fim ficam indicados)
  const porDia = useMemo(() => {
    const m = new Map();
    for (const e of eventos) {
      const fim = e.fim || e.data;
      for (let t = dataDe(e.data).getTime(); t <= dataDe(fim).getTime(); t += DIA) {
        const k = isoDe(new Date(t));
        const marca = e.fim && e.fim !== e.data ? (k === e.data ? ' (início)' : k === fim ? ' (último dia)' : ' (em andamento)') : '';
        if (!m.has(k)) m.set(k, []);
        m.get(k).push({ ...e, marca });
      }
    }
    return m;
  }, [eventos]);

  useEffect(() => {
    if (!aberto) return;
    const esc = (e) => e.key === 'Escape' && setAberto(null);
    document.addEventListener('keydown', esc);
    fechar.current?.focus();
    return () => document.removeEventListener('keydown', esc);
  }, [aberto]);

  const hoje = hojeIso();
  const proximos = eventos.filter((e) => (e.fim || e.data) >= hoje).slice(0, 8);

  const mover = (n) => {
    const d = dataDe(ref);
    if (visao === 'mes') d.setMonth(d.getMonth() + n, 1);
    else if (visao === 'semana') d.setDate(d.getDate() + 7 * n);
    else d.setDate(d.getDate() + n);
    setRef(isoDe(d));
  };

  const Bolinhas = ({ evs }) => {
    if (!evs.length) return null;
    const prova = evs.some((e) => e.prova);
    const outros = evs.some((e) => !e.prova);
    return (
      <span aria-hidden="true" style={{ display: 'flex', gap: 3, justifyContent: 'center', marginTop: 2 }}>
        {prova && <i style={{ width: 8, height: 8, borderRadius: 9, background: 'var(--erro)', display: 'block' }} />}
        {outros && <i style={{ width: 8, height: 8, borderRadius: 9, background: 'var(--pri)', display: 'block' }} />}
      </span>
    );
  };

  const ItemEvento = ({ e, comData }) => (
    <button className="card bloco-card" style={{ margin: '6px 0', padding: '10px 12px', boxShadow: 'none', borderLeft: `5px solid ${e.prova ? 'var(--erro)' : 'var(--pri)'}` }} onClick={() => setAberto(e.data)}>
      <div className="peq sub">
        {comData && <b>{fmtData(e.data)}{e.fim && e.fim !== e.data ? ` a ${fmtData(e.fim)}` : ''} · </b>}
        <span className="etiqueta" style={{ margin: '0 6px 0 0', padding: '1px 8px' }}>{e.concurso}</span>
        {e.ico} {e.rot}{e.marca || ''}
      </div>
      <div>{e.titulo}</div>
      {e.horario && (
        <div className="peq" style={{ marginTop: 2, fontWeight: 700 }}>
          🕐 {e.horario.edital}
          {e.horario.local && <span style={{ display: 'block', fontWeight: 400 }}>{e.horario.local}</span>}
        </div>
      )}
    </button>
  );

  // JSX criado por função (e não componente declarado aqui dentro), senão o React remonta
  // o bloco a cada tecla digitada e o campo de texto perde o foco
  const listaTarefas = (dia) => {
    const lista = tarefasDe(dia);
    if (!lista.length) return null;
    return (
      <ul className="lista-limpa peq" style={{ marginTop: 4 }}>
        {lista.map((t) => (
          <li key={t.id} style={{ padding: '2px 0' }}>
            <span style={{ opacity: t.feita ? 0.6 : 1, textDecoration: t.feita ? 'line-through' : 'none' }}>
              📝 {t.texto}{t.feita ? ' · ✓ feita' : ''}
            </span>
          </li>
        ))}
      </ul>
    );
  };

  // bloco completo de tarefas do dia: marcar, excluir e adicionar
  const blocoTarefas = (dia) => {
    const lista = tarefasDe(dia);
    return (
      <section style={{ marginTop: 10, borderTop: '1px solid var(--borda)', paddingTop: 8 }}>
        <h3 style={{ margin: '0 0 6px' }}>📝 Minhas tarefas e recados</h3>
        {!lista.length && <p className="sub peq" style={{ margin: '0 0 6px' }}>Nada anotado para este dia ainda.</p>}
        <ul className="lista-limpa">
          {lista.map((t) => (
            <li key={t.id} className="linha" style={{ alignItems: 'center', padding: '4px 0' }}>
              <label style={{ flex: 1, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <input type="checkbox" checked={t.feita} onChange={() => alternarTarefa(dia, t.id)} style={{ width: 20, height: 20 }} aria-label={`Tarefa feita: ${t.texto}`} />
                <span style={{ opacity: t.feita ? 0.6 : 1, textDecoration: t.feita ? 'line-through' : 'none' }}>
                  {t.texto}{t.feita ? ' · ✓ feita' : ''}
                </span>
              </label>
              <button className="btn peq" aria-label={`Excluir tarefa: ${t.texto}`} onClick={() => excluirTarefa(dia, t.id)}>🗑️</button>
            </li>
          ))}
        </ul>
        <form
          className="linha"
          style={{ marginTop: 6, alignItems: 'center' }}
          onSubmit={(ev) => { ev.preventDefault(); adicionarTarefa(dia, novaTarefa); }}
        >
          <input
            type="text"
            value={novaTarefa}
            onChange={(ev) => setNovaTarefa(ev.target.value)}
            placeholder="Ex.: pagar o boleto da inscrição"
            aria-label={`Nova tarefa para ${fmtData(dia)}`}
            style={{ flex: 1, minWidth: 0, minHeight: 40, padding: '6px 9px', borderRadius: 9, border: '1px solid var(--borda)', background: 'var(--card)', color: 'var(--txt)', font: 'inherit' }}
          />
          <button type="submit" className="btn peq pri" disabled={!novaTarefa.trim()}>+ Adicionar</button>
        </form>
      </section>
    );
  };

  // ---------- visões ----------
  let corpo;
  if (visao === 'hoje') {
    const evs = porDia.get(ref) || [];
    corpo = (
      <>
        <h2>{ref === hoje ? 'Hoje · ' : ''}{SEMANA[dataDe(ref).getDay()]}, {fmtData(ref)}</h2>
        {evs.length ? evs.map((e, i) => <ItemEvento key={i} e={e} />) : <p className="sub">Nenhuma data de concurso neste dia.</p>}
        {blocoTarefas(ref)}
      </>
    );
  } else if (visao === 'semana') {
    const d0 = dataDe(ref);
    d0.setDate(d0.getDate() - d0.getDay());
    const dias = Array.from({ length: 7 }, (_, i) => isoDe(new Date(d0.getTime() + i * DIA)));
    corpo = (
      <>
        <h2>Semana de {fmtData(dias[0])} a {fmtData(dias[6])}</h2>
        {dias.map((k) => {
          const evs = porDia.get(k) || [];
          return (
            <div key={k} style={{ borderTop: '1px solid var(--borda)', padding: '8px 0', background: k === hoje ? 'var(--pri-claro)' : undefined, borderRadius: k === hoje ? 8 : 0, paddingLeft: k === hoje ? 8 : 0 }}>
              <div className="linha entre" style={{ alignItems: 'center' }}>
                <b className={evs.some((e) => e.prova) ? 'desce' : ''}>{SEMANA[dataDe(k).getDay()]}, {fmtData(k)}{k === hoje ? ' · hoje' : ''}</b>
                <button className="btn peq" onClick={() => setAberto(k)}>📝 tarefa</button>
              </div>
              {evs.length ? evs.map((e, i) => <ItemEvento key={i} e={e} />) : !tarefasDe(k).length && <div className="sub peq">—</div>}
              {listaTarefas(k)}
            </div>
          );
        })}
      </>
    );
  } else {
    const d = dataDe(ref);
    const ano = d.getFullYear();
    const mes = d.getMonth();
    const primeiro = new Date(ano, mes, 1).getDay();
    const nDias = new Date(ano, mes + 1, 0).getDate();
    const celulas = [...Array(primeiro).fill(null), ...Array.from({ length: nDias }, (_, i) => i + 1)];
    const doMes = eventos.filter((e) => e.data.slice(0, 7) === `${ano}-${String(mes + 1).padStart(2, '0')}` || (e.fim || '').slice(0, 7) === `${ano}-${String(mes + 1).padStart(2, '0')}`);
    corpo = (
      <>
        <h2>{MESES[mes]} de {ano}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, textAlign: 'center' }} role="grid" aria-label={`${MESES[mes]} de ${ano}`}>
          {SEMANA.map((s) => <div key={s} className="sub peq" style={{ fontWeight: 700 }}>{s[0]}</div>)}
          {celulas.map((n, i) => {
            if (!n) return <div key={i} />;
            const k = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(n).padStart(2, '0')}`;
            const evs = porDia.get(k) || [];
            const prova = evs.some((e) => e.prova);
            const tars = tarefasDe(k);
            const aFazer = tars.filter((t) => !t.feita).length;
            return (
              <button
                key={i}
                onClick={() => setAberto(k)}
                aria-label={`${n} de ${MESES[mes]}${evs.length ? ': ' + evs.map((e) => `${e.concurso} – ${e.rot}`).join('; ') : ''}${tars.length ? `${evs.length ? '. ' : ': '}${tars.length} ${tars.length === 1 ? 'tarefa' : 'tarefas'}${aFazer ? `, ${aFazer} a fazer` : ', todas feitas'}` : ''}. Abrir o dia para ver e anotar tarefas`}
                style={{
                  minHeight: 48,
                  borderRadius: 10,
                  border: k === hoje ? '2px solid var(--pri)' : '1px solid var(--borda)',
                  background: prova ? 'var(--erro-bg)' : evs.length ? 'var(--pri-claro)' : 'var(--card)',
                  fontWeight: evs.length || tars.length || k === hoje ? 800 : 400,
                  cursor: 'pointer',
                  color: 'var(--txt)',
                  padding: '4px 0',
                }}
              >
                {n}{tars.length > 0 && <span aria-hidden="true"> 📝</span>}
                <Bolinhas evs={evs} />
              </button>
            );
          })}
        </div>
        {doMes.length > 0 && (
          <div style={{ marginTop: 10 }}>
            {doMes.map((e, i) => <ItemEvento key={i} e={e} comData />)}
          </div>
        )}
        {!doMes.length && <p className="sub peq" style={{ marginTop: 8 }}>Nenhuma data neste mês.</p>}
      </>
    );
  }

  return (
    <div>
      <h1>📅 Calendário</h1>
      {!meus.length ? (
        <p className="card sub">Você ainda não acompanha nenhum concurso. Vá em 🏆 Concursos e adicione os seus.</p>
      ) : (
        <>
          <div className="linha" role="group" aria-label="Qual calendário" style={{ marginBottom: 8 }}>
            {[{ id: 'todos', rotulo: '🗂️ Todos os meus concursos' }, ...meus.map((c) => ({ id: c.id, rotulo: rotuloDoConcurso(c, meus, prefs) }))].map((c) => (
              <button key={c.id} className="btn peq" aria-pressed={filtro === c.id} onClick={() => escolherFiltro(c.id)} style={filtro === c.id ? { background: 'var(--pri)', color: 'var(--pri-txt)', borderColor: 'var(--pri)' } : {}}>
                {c.rotulo}
              </button>
            ))}
          </div>
          <div className="abas" role="tablist" style={{ marginBottom: 10 }}>
            {[['hoje', 'Hoje'], ['semana', 'Semana'], ['mes', 'Mês']].map(([v, r]) => (
              <button key={v} role="tab" aria-selected={visao === v} onClick={() => escolherVisao(v)}>{r}</button>
            ))}
          </div>

          {proximos[0] && (
            <div className="card" style={{ borderLeft: `6px solid ${proximos[0].prova ? 'var(--erro)' : 'var(--pri)'}` }} role="status">
              <div className="sub peq">Próxima data · {proximos[0].concurso}</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>
                {proximos[0].ico} {fmtData(proximos[0].data)}{proximos[0].fim && proximos[0].fim !== proximos[0].data ? ` a ${fmtData(proximos[0].fim)}` : ''}
              </div>
              <div>{proximos[0].titulo.toLowerCase().startsWith(proximos[0].rot.toLowerCase()) ? proximos[0].titulo : `${proximos[0].rot}: ${proximos[0].titulo}`}</div>
              {proximos[0].horario && (
                <div style={{ marginTop: 4 }}>
                  <b>🕐 {proximos[0].horario.edital}</b>
                  {proximos[0].horario.local && <div className="peq">{proximos[0].horario.local}</div>}
                </div>
              )}
              <div className="sub peq">
                {(() => {
                  const n = Math.round((dataDe(proximos[0].data) - dataDe(hoje)) / DIA);
                  return n <= 0 ? 'Acontecendo agora' : n === 1 ? 'Amanhã' : `Faltam ${n} dias`;
                })()}
              </div>
            </div>
          )}

          <section className="card">
            <div className="linha entre" style={{ marginBottom: 8 }}>
              <button className="btn peq" onClick={() => mover(-1)} aria-label="Anterior">‹ Anterior</button>
              <button className="btn peq" onClick={() => setRef(hoje)}>Hoje</button>
              <button className="btn peq" onClick={() => mover(1)} aria-label="Próximo">Próximo ›</button>
            </div>
            {corpo}
            <div className="legenda" style={{ marginTop: 10 }}>
              <span><i style={{ background: 'var(--erro)', borderRadius: 9 }} />Prova</span>
              <span><i style={{ background: 'var(--pri)', borderRadius: 9 }} />Outras datas do edital</span>
              <span><i style={{ background: 'transparent' }} />📝 Dia com tarefa anotada</span>
            </div>
          </section>

          {visao !== 'mes' && proximos.length > 0 && (
            <section className="card">
              <h2>Próximas datas</h2>
              {proximos.map((e, i) => <ItemEvento key={i} e={e} comData />)}
            </section>
          )}
        </>
      )}

      {aberto && (
        <>
          <div className="pop-fundo" onClick={() => setAberto(null)} />
          <div className="pop" role="dialog" aria-modal="true" aria-label={`Datas de ${fmtData(aberto)}`} style={{ top: '25%', left: '50%', right: 'auto', transform: 'translateX(-50%)' }}>
            <h2>{SEMANA[dataDe(aberto).getDay()]}, {fmtData(aberto)}</h2>
            {!(porDia.get(aberto) || []).length && <p className="sub peq">Nenhuma data de concurso neste dia.</p>}
            {(porDia.get(aberto) || []).map((e, i) => (
              <div key={i} className={e.prova ? 'veredito erro' : 'aviso'} style={e.prova ? {} : { background: 'var(--pri-claro)', color: 'var(--txt)' }}>
                <div className="peq" style={{ fontWeight: 700 }}>{e.concursoNome || e.concurso}</div>
                <div>{e.ico} <b>{e.rot}{e.marca || ''}</b></div>
                <div className="peq">{e.titulo}{e.fim && e.fim !== e.data ? ` (${fmtData(e.data)} a ${fmtData(e.fim)})` : ''}</div>
                {e.horario && (
                  <div className="peq" style={{ marginTop: 2 }}>
                    <b>🕐 {e.horario.edital}</b>
                    {e.horario.local && <div>{e.horario.local}</div>}
                  </div>
                )}
              </div>
            ))}
            {blocoTarefas(aberto)}
            <button ref={fechar} className="btn" style={{ marginTop: 8 }} onClick={() => setAberto(null)}>Fechar</button>
          </div>
        </>
      )}
    </div>
  );
}
