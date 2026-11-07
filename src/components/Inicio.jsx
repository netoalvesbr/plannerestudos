import { useMemo, useState } from 'react';
import { diasDo, POR_UID } from '../lib/dados.js';
import { diasAte, fmtData, fmtDiaMes, resumo } from '../lib/stats.js';
import { TabelaRendimento } from './Graficos.jsx';

export function EscolhaFormato({ aoEscolher }) {
  return (
    <section className="card login">
      <h1>Como você prefere estudar?</h1>
      <p className="sub">Você pode trocar depois, pelos botões no topo.</p>
      <div className="escolha">
        <button className="card bloco-card" onClick={() => aoEscolher('diarias')}>
          <h2>📅 Provas diárias</h2>
          <p className="sub">Por dia, 3 blocos de 20 questões (Manhã, Tarde e Noite), no peso da prova.</p>
        </button>
        <button className="card bloco-card" onClick={() => aoEscolher('avulsas')}>
          <h2>🎯 Questões avulsas</h2>
          <p className="sub">Escolha disciplina, assunto, dificuldade e quais questões quer ver.</p>
        </button>
      </div>
    </section>
  );
}

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
      <TabelaRendimento questoes={ctx.questoes} respostas={respostas} ordem={concurso.disciplinas.map((d) => d.nome)} />
    </div>
  );
}

export function QuestoesAvulsas({ ctx }) {
  const { concurso, respostas, abrirSessao, filtroInicial, unificado, setPrefs } = ctx;
  const questoes = unificado ? ctx.questoesUnificado : ctx.questoes;
  const [f, setF] = useState({ materia: '', assunto: '', dificuldade: '', mostrar: 'nao', origem: '', ...(filtroInicial || {}) });
  const set = (k, v) => setF((x) => ({ ...x, [k]: v, ...(k === 'materia' ? { assunto: '' } : {}) }));

  const materias = useMemo(() => [...new Set(questoes.map((q) => q.materia))], [questoes]);
  const assuntos = useMemo(() => [...new Set(questoes.filter((q) => !f.materia || q.materia === f.materia).map((q) => q.assunto))], [questoes, f.materia]);

  const lista = questoes.filter((q) => {
    const r = respostas[q.uid];
    if (f.materia && q.materia !== f.materia) return false;
    if (f.assunto && q.assunto !== f.assunto) return false;
    if (f.dificuldade && q.dificuldade !== f.dificuldade) return false;
    if (f.origem && q.origem !== f.origem) return false;
    if (f.banca && q.banca !== f.banca) return false;
    if (f.mostrar === 'nao' && r) return false;
    if (f.mostrar === 'errei' && !(r && !r[1])) return false;
    if (f.mostrar === 'acertei' && !(r && r[1])) return false;
    return true;
  });

  function resolver(aleatorio) {
    const uids = lista.map((q) => q.uid);
    if (aleatorio) {
      for (let i = uids.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [uids[i], uids[j]] = [uids[j], uids[i]];
      }
    }
    const partes = [f.materia || 'Todas as disciplinas', f.assunto].filter(Boolean).join(' · ');
    abrirSessao({ titulo: `Avulsas · ${partes}`, uids, idx: 0, modo: 'estudo' });
  }

  return (
    <div>
      <Cabecalho concurso={concurso} fase={ctx.fase} />
      <section className="card">
        <h2>Filtrar questões</h2>
        <div className="filtros">
          <label className="campo">Disciplina
            <select value={f.materia} onChange={(e) => set('materia', e.target.value)}>
              <option value="">Todas</option>
              {materias.map((m) => <option key={m}>{m}</option>)}
            </select>
          </label>
          <label className="campo">Assunto
            <select value={f.assunto} onChange={(e) => set('assunto', e.target.value)}>
              <option value="">Todos</option>
              {assuntos.map((m) => <option key={m}>{m}</option>)}
            </select>
          </label>
          <label className="campo">Dificuldade
            <select value={f.dificuldade} onChange={(e) => set('dificuldade', e.target.value)}>
              <option value="">Todas</option>
              <option value="fácil">Fácil</option>
              <option value="média">Média</option>
              <option value="difícil">Difícil</option>
            </select>
          </label>
          <label className="campo">Origem
            <select value={f.origem} onChange={(e) => set('origem', e.target.value)}>
              <option value="">Todas</option>
              <option value="inédita">Inéditas</option>
              <option value="prova_anterior">Provas anteriores</option>
            </select>
          </label>
          <label className="campo">Fonte das questões
            <select value={unificado ? 'u' : 'c'} onChange={(e) => setPrefs({ unificado: e.target.value === 'u' })}>
              <option value="c">Só deste concurso</option>
              <option value="u">Banco unificado (todos os concursos, mesmas disciplinas)</option>
            </select>
          </label>
          <label className="campo">Banca
            <select value={f.banca || ''} onChange={(e) => set('banca', e.target.value)}>
              <option value="">Todas</option>
              {[...new Set(questoes.map((q) => q.banca).filter(Boolean))].map((b) => <option key={b}>{b}</option>)}
            </select>
          </label>
          <label className="campo">Mostrar
            <select value={f.mostrar} onChange={(e) => set('mostrar', e.target.value)}>
              <option value="nao">Não resolvidas</option>
              <option value="errei">Que errei</option>
              <option value="acertei">Que acertei</option>
              <option value="todas">Todas</option>
            </select>
          </label>
        </div>
        <p style={{ marginTop: 12 }}><b>{lista.length}</b> {lista.length === 1 ? 'questão encontrada' : 'questões encontradas'}</p>
        <div className="linha">
          <button className="btn pri" disabled={!lista.length} onClick={() => resolver(false)}>Resolver na ordem</button>
          <button className="btn" disabled={!lista.length} onClick={() => resolver(true)}>Resolver em ordem aleatória</button>
        </div>
      </section>
      <TabelaRendimento questoes={ctx.questoes} respostas={respostas} ordem={concurso.disciplinas.map((d) => d.nome)} />
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
