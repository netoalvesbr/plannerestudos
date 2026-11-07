import { useEffect, useMemo, useRef, useState } from 'react';
import { fmtData } from '../lib/stats.js';

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const iso = (a, m, d) => `${a}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const hojeIso = () => new Date().toLocaleDateString('sv-SE');
const diasEntre = (de, ate) => Math.round((new Date(ate + 'T12:00:00') - new Date(de + 'T12:00:00')) / 86400000);

// Eventos do concurso: datas do edital + datas das provas (em vermelho)
export function eventosDoConcurso(concurso) {
  const ev = [];
  const nome = concurso.nome || concurso.sigla;
  // provas das fases primeiro: o nome da fase é o título preferido para o dia da prova
  for (const f of concurso.fases || []) if (f.data) ev.push({ data: f.data, titulo: f.nome.includes('–') ? f.nome.replace(/–/, 'do ' + (concurso.nome || concurso.sigla).replace(/ – OAB$/, '') + ' –') : `${f.nome} – ${nome}`, prova: true });
  // se o candidato apagou uma fase, as datas que são só daquela fase não aparecem
  const fases = concurso.fases || [];
  const temFase = (n) => fases.some((f) => new RegExp(`^${n}`).test(f.nome));
  const ignorar = (t) =>
    fases.length > 0 &&
    ((!temFase('1') && /objetiva|1[ªa] fase|primeira fase/i.test(t) && !/pr[áa]tico|2[ªa] fase/i.test(t)) ||
      (!temFase('2') && /pr[áa]tico|2[ªa] fase|segunda fase/i.test(t) && !/objetiva|1[ªa] fase/i.test(t)));
  for (const e of concurso.cronograma || []) {
    if (!e.data || ignorar(e.evento)) continue;
    const prova = /aplica|realiza[çc][ãa]o d[ao]s? prova|prova (objetiva|pr[áa]tico|discursiva)|[12][ªa] fase/i.test(e.evento) && !/divulga|local|gabarito|padr|resultado|recurso/i.test(e.evento);
    ev.push({ data: e.data, fim: e.fim || '', titulo: e.evento, prova });
  }
  if (!concurso.fases?.length && concurso.dataProva) ev.push({ data: concurso.dataProva, titulo: `Prova – ${nome}`, prova: true });
  // remove repetidos (mesma data e prova já representada pela fase)
  const vistos = new Set();
  return ev
    .filter((e) => {
      const k = e.prova ? `${e.data}#prova` : `${e.data}#${e.titulo}`;
      if (vistos.has(k)) return false;
      vistos.add(k);
      return true;
    })
    .sort((a, b) => a.data.localeCompare(b.data));
}

export function ProximaData({ eventos }) {
  const hoje = hojeIso();
  const prox = eventos.find((e) => (e.fim || e.data) >= hoje);
  if (!prox) return null;
  const emAndamento = prox.data < hoje;
  const faltam = diasEntre(hoje, prox.data);
  return (
    <div className="card" style={{ borderLeft: `6px solid ${prox.prova ? 'var(--erro)' : 'var(--pri)'}`, marginBottom: 12 }} role="status">
      <div className="sub peq">{emAndamento ? 'Acontecendo agora' : 'Próxima data'}</div>
      <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>
        {prox.prova ? '🔴 ' : '📌 '}
        {fmtData(prox.data)}
        {prox.fim ? ` a ${fmtData(prox.fim)}` : ''}
      </div>
      <div>{prox.titulo}</div>
      {!emAndamento && <div className="sub peq">{faltam === 0 ? 'É hoje!' : faltam === 1 ? 'Amanhã' : `Faltam ${faltam} dias`}</div>}
    </div>
  );
}

export default function Calendario({ eventos }) {
  const hoje = hojeIso();
  const prox = eventos.find((e) => (e.fim || e.data) >= hoje);
  const inicial = new Date((prox?.data || hoje) + 'T12:00:00');
  const [ano, setAno] = useState(new Date().getFullYear());
  const [mes, setMes] = useState(new Date().getMonth());
  const [aberto, setAberto] = useState(null); // data iso
  const fechar = useRef(null);

  // mapa data -> eventos (eventos com período marcam todos os dias)
  const porDia = useMemo(() => {
    const m = new Map();
    for (const e of eventos) {
      const ini = new Date(e.data + 'T12:00:00');
      const fim = new Date((e.fim || e.data) + 'T12:00:00');
      for (let d = ini; d <= fim; d = new Date(d.getTime() + 86400000)) {
        const k = d.toLocaleDateString('sv-SE');
        if (!m.has(k)) m.set(k, []);
        m.get(k).push(e);
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

  const mover = (n) => {
    const d = new Date(ano, mes + n, 1);
    setAno(d.getFullYear());
    setMes(d.getMonth());
  };
  const primeiroDia = new Date(ano, mes, 1).getDay();
  const nDias = new Date(ano, mes + 1, 0).getDate();
  const celulas = [...Array(primeiroDia).fill(null), ...Array.from({ length: nDias }, (_, i) => i + 1)];
  const evMes = eventos.filter((e) => e.data.slice(0, 7) === iso(ano, mes, 1).slice(0, 7) || (e.fim && e.fim.slice(0, 7) === iso(ano, mes, 1).slice(0, 7)));

  return (
    <div>
      <div className="linha entre" style={{ marginBottom: 8 }}>
        <button className="btn peq" onClick={() => mover(-1)} aria-label="Mês anterior">‹</button>
        <b style={{ fontSize: '1.05rem' }}>{MESES[mes]} de {ano}</b>
        <button className="btn peq" onClick={() => mover(1)} aria-label="Próximo mês">›</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, textAlign: 'center' }} role="grid" aria-label={`Calendário de ${MESES[mes]} de ${ano}`}>
        {SEMANA.map((d, i) => <div key={i} className="sub peq" style={{ fontWeight: 700 }}>{d}</div>)}
        {celulas.map((d, i) => {
          if (!d) return <div key={i} />;
          const k = iso(ano, mes, d);
          const evs = porDia.get(k) || [];
          const prova = evs.some((e) => e.prova);
          const ehHoje = k === hoje;
          return (
            <button
              key={i}
              onClick={() => evs.length && setAberto(k)}
              disabled={!evs.length}
              aria-label={`${d} de ${MESES[mes]}${evs.length ? `: ${evs.map((e) => e.titulo).join('; ')}` : ''}`}
              style={{
                minHeight: 42,
                borderRadius: 10,
                border: ehHoje ? '2px solid var(--pri)' : '1px solid var(--borda)',
                background: prova ? 'var(--erro)' : evs.length ? 'var(--pri-claro)' : 'var(--card)',
                color: prova ? '#fff' : 'var(--txt)',
                fontWeight: evs.length || ehHoje ? 800 : 400,
                cursor: evs.length ? 'pointer' : 'default',
                opacity: 1,
                position: 'relative',
              }}
            >
              {d}
              {evs.length > 0 && !prova && <span aria-hidden="true" style={{ position: 'absolute', bottom: 3, left: '50%', transform: 'translateX(-50%)', width: 5, height: 5, borderRadius: 9, background: 'var(--pri)' }} />}
            </button>
          );
        })}
      </div>
      <div className="legenda" style={{ marginTop: 8 }}>
        <span><i style={{ background: 'var(--erro)' }} />Prova</span>
        <span><i style={{ background: 'var(--pri-claro)', border: '1px solid var(--pri)' }} />Outras datas</span>
        <span><i style={{ border: '2px solid var(--pri)' }} />Hoje</span>
      </div>
      {evMes.length > 0 && (
        <ul className="peq" style={{ paddingLeft: 18, marginTop: 8 }}>
          {evMes.map((e, i) => (
            <li key={i}>
              <button className="praticar" style={{ textDecoration: 'none', color: e.prova ? 'var(--erro)' : 'var(--txt)' }} onClick={() => setAberto(e.data)}>
                {e.prova ? '🔴' : '•'} {fmtData(e.data)}{e.fim ? ` a ${fmtData(e.fim)}` : ''} – {e.titulo}
              </button>
            </li>
          ))}
        </ul>
      )}
      {!evMes.length && <p className="sub peq" style={{ marginTop: 8 }}>Nenhuma data neste mês. {prox && inicial.getMonth() !== mes && <button className="praticar" onClick={() => { setAno(inicial.getFullYear()); setMes(inicial.getMonth()); }}>Ir para a próxima data</button>}</p>}

      {aberto && (
        <>
          <div className="pop-fundo" onClick={() => setAberto(null)} />
          <div className="pop" role="dialog" aria-modal="true" aria-label={`Datas de ${fmtData(aberto)}`} style={{ top: '30%', left: '50%', right: 'auto', transform: 'translateX(-50%)' }}>
            <h2>{fmtData(aberto)}</h2>
            {(porDia.get(aberto) || []).map((e, i) => (
              <div key={i} className={e.prova ? 'veredito erro' : 'aviso'} style={e.prova ? {} : { background: 'var(--pri-claro)', color: 'var(--txt)' }}>
                {e.prova ? '🔴 Dia de prova: ' : '📌 '}
                {e.titulo}
                {e.fim && e.fim !== e.data ? ` (${fmtData(e.data)} a ${fmtData(e.fim)})` : ''}
              </div>
            ))}
            <button ref={fechar} className="btn" style={{ marginTop: 8 }} onClick={() => setAberto(null)}>Fechar</button>
          </div>
        </>
      )}
    </div>
  );
}
