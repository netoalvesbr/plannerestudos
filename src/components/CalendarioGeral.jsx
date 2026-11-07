import { useEffect, useMemo, useRef, useState } from 'react';
import { getConcurso } from '../data/concursos.js';
import { fmtData } from '../lib/stats.js';
import { eventosDoConcurso } from './Calendario.jsx';

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const DIA = 86400000;
const isoDe = (d) => d.toLocaleDateString('sv-SE');
const dataDe = (iso) => new Date(iso + 'T12:00:00');
const hojeIso = () => isoDe(new Date());

// Tipo do evento a partir do texto do edital
export function tipoEvento(e) {
  const t = (e.titulo || '').toLowerCase();
  if (e.prova) return { rot: 'Dia de prova', ico: '🔴' };
  if (/pagamento|boleto|taxa/.test(t)) return { rot: 'Pagamento da inscrição', ico: '💳' };
  if (/isen[çc]/.test(t)) return { rot: 'Isenção da taxa', ico: '🆓' };
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

  const lembrar = (parcial) => setPrefs({ calendario: { ...(prefs.calendario || {}), filtro, visao, ...parcial } });
  const escolherFiltro = (v) => { setFiltro(v); lembrar({ filtro: v }); };
  const escolherVisao = (v) => { setVisao(v); lembrar({ visao: v }); setRef(hojeIso()); };

  // todos os eventos dos concursos escolhidos, com a sigla do concurso
  const eventos = useMemo(() => {
    const lista = filtro === 'todos' ? meus : meus.filter((c) => c.id === filtro);
    return lista
      .flatMap((c) => eventosDoConcurso(c).map((e) => ({ ...e, concurso: c.sigla, concursoNome: c.nome, ...tipoEvento(e) })))
      .sort((a, b) => a.data.localeCompare(b.data));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtro, prefs.seguindo, ctx.bancoVersao]);

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
        {filtro === 'todos' && <span className="etiqueta" style={{ margin: '0 6px 0 0', padding: '1px 8px' }}>{e.concurso}</span>}
        {e.ico} {e.rot}{e.marca || ''}
      </div>
      <div>{e.titulo}</div>
    </button>
  );

  // ---------- visões ----------
  let corpo;
  if (visao === 'hoje') {
    const evs = porDia.get(ref) || [];
    corpo = (
      <>
        <h2>{ref === hoje ? 'Hoje · ' : ''}{SEMANA[dataDe(ref).getDay()]}, {fmtData(ref)}</h2>
        {evs.length ? evs.map((e, i) => <ItemEvento key={i} e={e} />) : <p className="sub">Nenhuma data de concurso neste dia.</p>}
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
              <b className={evs.some((e) => e.prova) ? 'desce' : ''}>{SEMANA[dataDe(k).getDay()]}, {fmtData(k)}{k === hoje ? ' · hoje' : ''}</b>
              {evs.length ? evs.map((e, i) => <ItemEvento key={i} e={e} />) : <div className="sub peq">—</div>}
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
            return (
              <button
                key={i}
                disabled={!evs.length}
                onClick={() => setAberto(k)}
                aria-label={`${n} de ${MESES[mes]}${evs.length ? ': ' + evs.map((e) => `${e.concurso} – ${e.rot}`).join('; ') : ''}`}
                style={{
                  minHeight: 48,
                  borderRadius: 10,
                  border: k === hoje ? '2px solid var(--pri)' : '1px solid var(--borda)',
                  background: prova ? 'var(--erro-bg)' : evs.length ? 'var(--pri-claro)' : 'var(--card)',
                  fontWeight: evs.length || k === hoje ? 800 : 400,
                  cursor: evs.length ? 'pointer' : 'default',
                  color: 'var(--txt)',
                  padding: '4px 0',
                }}
              >
                {n}
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
            {[{ id: 'todos', sigla: '🗂️ Todos os meus concursos' }, ...meus].map((c) => (
              <button key={c.id} className="btn peq" aria-pressed={filtro === c.id} onClick={() => escolherFiltro(c.id)} style={filtro === c.id ? { background: 'var(--pri)', color: 'var(--pri-txt)', borderColor: 'var(--pri)' } : {}}>
                {c.sigla}
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
              <div className="sub peq">Próxima data{filtro === 'todos' ? ` · ${proximos[0].concurso}` : ''}</div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800 }}>
                {proximos[0].ico} {fmtData(proximos[0].data)}{proximos[0].fim && proximos[0].fim !== proximos[0].data ? ` a ${fmtData(proximos[0].fim)}` : ''}
              </div>
              <div>{proximos[0].titulo.toLowerCase().startsWith(proximos[0].rot.toLowerCase()) ? proximos[0].titulo : `${proximos[0].rot}: ${proximos[0].titulo}`}</div>
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
            {(porDia.get(aberto) || []).map((e, i) => (
              <div key={i} className={e.prova ? 'veredito erro' : 'aviso'} style={e.prova ? {} : { background: 'var(--pri-claro)', color: 'var(--txt)' }}>
                <div className="peq" style={{ fontWeight: 700 }}>{e.concursoNome || e.concurso}</div>
                <div>{e.ico} <b>{e.rot}{e.marca || ''}</b></div>
                <div className="peq">{e.titulo}{e.fim && e.fim !== e.data ? ` (${fmtData(e.data)} a ${fmtData(e.fim)})` : ''}</div>
              </div>
            ))}
            <button ref={fechar} className="btn" style={{ marginTop: 8 }} onClick={() => setAberto(null)}>Fechar</button>
          </div>
        </>
      )}
    </div>
  );
}
