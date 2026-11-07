import { useState } from 'react';
import { diasDo, POR_UID } from '../lib/dados.js';
import { diasAte, fmtData, fmtDiaMes, resumo } from '../lib/stats.js';

function Cabecalho({ concurso, fase }) {
  const faseObj = concurso.fases?.find((f) => f.id === fase);
  const data = faseObj?.data || concurso.dataProva;
  const faltam = data ? diasAte(data) : null;
  return (
    <div className="linha entre" style={{ marginBottom: 10 }}>
      <div>
        <h1 style={{ marginBottom: 0 }}>{concurso.sigla}{concurso.banca ? ` · ${concurso.banca}` : ''}{faseObj ? ` · ${faseObj.nome}` : ''}</h1>
        <div className="sub">{data ? `Prova em ${fmtData(data)}` : 'Data da prova a definir'}</div>
      </div>
      {faltam != null && faltam >= 0 && <div className="contagem">{faltam === 0 ? 'A prova é hoje!' : `Faltam ${faltam} dias`}</div>}
    </div>
  );
}

export function ProvasDiarias({ ctx }) {
  const { concurso, cargo, questoes, respostas, abrirSessao } = ctx;
  const dias = diasDo(concurso.id, cargo);
  const hojeIso = new Date().toLocaleDateString('sv-SE');
  const padrao = Math.max(0, dias.findLastIndex((d) => d.data <= hojeIso));
  const [sel, setSel] = useState(padrao);
  const dia = dias[sel];

  return (
    <div>
      <Cabecalho concurso={concurso} fase={ctx.fase} />
      {concurso.cargos?.length > 1 && <SeletorCargos ctx={ctx} />}
      {!dias.length ? (
        <div className="card">
          <p className="sub">Este concurso ainda não tem provas diárias montadas. Use as <b>questões avulsas</b>: elas trazem todo o banco de questões deste concurso, incluindo as provas anteriores importadas.</p>
          <button className="btn pri" onClick={() => ctx.irAvulsas()}>🎯 Ir para questões avulsas</button>
        </div>
      ) : (
        <>
          <div className="dias" role="group" aria-label="Escolha o dia">
            {dias.map((d, i) => (
              <button key={d.data} aria-pressed={i === sel} onClick={() => setSel(i)}>
                Dia {d.dia} · {fmtDiaMes(d.data)}
              </button>
            ))}
          </div>
          <div className="grade" style={{ marginBottom: 14 }}>
            {[...dia.provas]
              .sort((a, b) => (concurso.cargos || []).findIndex((c) => c.id === a.cargos?.[0]) - (concurso.cargos || []).findIndex((c) => c.id === b.cargos?.[0]))
              .map((p) => {
              const qs = p.uids.map((u) => POR_UID[u]);
              const s = resumo(qs, respostas);
              const primeiraAberta = p.uids.findIndex((u) => !respostas[u]);
              const completo = primeiraAberta === -1;
              return (
                <div key={p.id} className="card">
                  {p.cargos?.length > 0 && concurso.cargos?.length > 1 && (
                    <div className="etiqueta" style={{ marginBottom: 6 }}>👤 {p.cargos.map((id) => concurso.cargos.find((c) => c.id === id)?.nome || id).join(' / ')}</div>
                  )}
                  <h2>Dia {dia.dia} · {p.titulo.replace(/\s*\((Papiloscopista|Oficial Investigador)\)\s*$/, '')}</h2>
                  <div className="barra" aria-hidden="true"><i style={{ width: `${(s.resolvidas / p.uids.length) * 100}%` }} /></div>
                  <p className="sub">
                    {s.resolvidas}/{p.uids.length} resolvidas · {s.certas} certas · {s.erradas} erradas
                  </p>
                  <div className="linha">
                    <button
                      className="btn pri"
                      onClick={() =>
                        abrirSessao({ titulo: `Dia ${dia.dia} · ${p.titulo}`, uids: p.uids, idx: completo ? 0 : primeiraAberta, modo: 'estudo' })
                      }
                    >
                      {completo ? 'Revisar' : s.resolvidas ? 'Continuar' : 'Começar'}
                    </button>
                    {!s.resolvidas && (
                      <button className="btn" onClick={() => abrirSessao({ titulo: `Simulado · Dia ${dia.dia} · ${p.titulo}`, uids: p.uids, idx: 0, modo: 'simulado', minutos: 50 })}>
                        ⏱ Simulado
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {dia.provas.length < 3 * (cargo === 'ambos' ? concurso.cargos?.length || 1 : 1) && (
              <div className="card sub">Os demais blocos deste dia (Tarde e Noite) serão publicados em breve.</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// Seleção de cargos (pode marcar mais de um). Salvo como 'ambos' quando todos estão marcados.
export function SeletorCargos({ ctx }) {
  const { concurso, cargo, prefs, setPrefs } = ctx;
  const ids = concurso.cargos.map((c) => c.id);
  const marcados = cargo === 'ambos' || !cargo ? ids : [cargo];
  const alternar = (id) => {
    const n = marcados.includes(id) ? marcados.filter((x) => x !== id) : [...marcados, id];
    if (!n.length) return;
    const valor = n.length === ids.length ? 'ambos' : n[0];
    setPrefs({ concursos: { ...(prefs.concursos || {}), [concurso.id]: { ...(prefs.concursos?.[concurso.id] || {}), cargo: valor } } });
  };
  return (
    <div className="linha" role="group" aria-label="Meus cargos" style={{ marginBottom: 10 }}>
      <span className="sub peq">Meus cargos:</span>
      {concurso.cargos.map((c) => {
        const ok = marcados.includes(c.id);
        return (
          <button key={c.id} className="btn peq" aria-pressed={ok} onClick={() => alternar(c.id)} style={ok ? { background: 'var(--pri)', color: 'var(--pri-txt)', borderColor: 'var(--pri)' } : {}}>
            {ok ? '☑' : '☐'} {c.nome}
          </button>
        );
      })}
    </div>
  );
}
