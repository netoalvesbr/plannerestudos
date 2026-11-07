import { useState } from 'react';
import { MAPAS } from '../data/mapas.js';
import { disciplinasDo } from '../lib/dados.js';
import { fmtPct, resumo } from '../lib/stats.js';

const CORES = [0, 1, 2, 3, 4, 5].map((i) => `var(--m${i})`);

export function ListaMapas({ ctx }) {
  const { concurso, cargo, fase, area, questoes, respostas, abrirMapa } = ctx;
  const discs = disciplinasDo(concurso.id, cargo, fase, area);
  const grupos = [...new Set(discs.map((d) => d.grupo))];
  return (
    <div>
      <h1>🧠 Mapas mentais</h1>
      {grupos.map((g) => (
        <section key={g} style={{ marginBottom: 18 }}>
          <h2>{g}</h2>
          <div className="grade">
            {discs.filter((d) => d.grupo === g).map((d) => {
              const qs = questoes.filter((q) => q.materia === d.nome);
              const s = resumo(qs, respostas);
              const tem = !!MAPAS[d.nome];
              return (
                <button key={d.nome} className="card bloco-card" disabled={!tem} onClick={() => abrirMapa(d.nome)} style={{ opacity: tem ? 1 : 0.6 }}>
                  <h3>{d.nome}</h3>
                  <div className="sub peq">
                    {!qs.length ? 'Questões nas próximas semanas' : s.resolvidas ? `Acerto atual: ${fmtPct(s.pct)} (${s.certas}/${s.resolvidas})` : `${qs.length} questões no banco`}
                  </div>
                  {!tem && <div className="peq sub">Mapa em preparação</div>}
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function No({ no, cor, aberto, alternar, caminho, assuntosComQuestao, praticar }) {
  const temFilhos = !!no.c?.length;
  const estaAberto = aberto.has(caminho);
  return (
    <li className="no">
      <div className="no-cab">
        {temFilhos ? (
          <button className="tog" aria-expanded={estaAberto} aria-label={estaAberto ? `Recolher ${no.t}` : `Expandir ${no.t}`} onClick={() => alternar(caminho)}>
            {estaAberto ? '−' : '+'}
          </button>
        ) : (
          <span style={{ flex: '0 0 30px', textAlign: 'center', color: cor }} aria-hidden="true">●</span>
        )}
        <div>
          <span className="no-tit" style={{ color: cor }}>{no.t}</span>
          {no.assunto && assuntosComQuestao.has(no.assunto) && (
            <button className="praticar peq" onClick={() => praticar(no.assunto)}>✎ praticar</button>
          )}
          {no.n && <div className="no-nota">{no.n}</div>}
        </div>
      </div>
      {temFilhos && estaAberto && (
        <ul className="arvore">
          {no.c.map((f, i) => (
            <No key={i} no={f} cor={cor} aberto={aberto} alternar={alternar} caminho={`${caminho}.${i}`} assuntosComQuestao={assuntosComQuestao} praticar={praticar} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function Mapa({ ctx, disciplina }) {
  const { questoes, abrirAvulsas, voltar } = ctx;
  const mapa = MAPAS[disciplina];
  const todos = [];
  const coletar = (nos, pre) => nos?.forEach((n, i) => { if (n.c?.length) { todos.push(`${pre}${i}`); coletar(n.c, `${pre}${i}.`); } });
  coletar(mapa.c, '');
  const [aberto, setAberto] = useState(() => new Set(mapa.c.map((_, i) => String(i))));
  const alternar = (k) => setAberto((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const assuntosComQuestao = new Set(questoes.filter((q) => q.materia === disciplina).map((q) => q.assunto));
  const praticar = (assunto) => abrirAvulsas({ materia: disciplina, assunto, mostrar: 'todas' });

  return (
    <div>
      <div className="linha entre" style={{ marginBottom: 10 }}>
        <button className="btn peq" onClick={voltar}>← Mapas</button>
        <div className="linha">
          <button className="btn peq" onClick={() => setAberto(new Set(todos))}>Expandir tudo</button>
          <button className="btn peq" onClick={() => setAberto(new Set())}>Recolher</button>
        </div>
      </div>
      <div className="card">
        <div className="raiz">{disciplina}</div>
        <ul className="arvore">
          {mapa.c.map((n, i) => (
            <No key={i} no={n} cor={CORES[i % CORES.length]} aberto={aberto} alternar={alternar} caminho={String(i)} assuntosComQuestao={assuntosComQuestao} praticar={praticar} />
          ))}
        </ul>
      </div>
    </div>
  );
}
