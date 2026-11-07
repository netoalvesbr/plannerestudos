import { useState } from 'react';
import { fmtPct, porCampo, resumo } from '../lib/stats.js';

export function TabelaRendimento({ questoes, respostas, ordem, titulo = 'Seu rendimento por disciplina' }) {
  let linhas = porCampo(questoes, respostas, 'materia');
  if (ordem) linhas.sort((a, b) => ordem.indexOf(a.chave) - ordem.indexOf(b.chave));
  const t = resumo(questoes, respostas);
  return (
    <section className="card" aria-label={titulo}>
      <h2>{titulo}</h2>
      {!linhas.length ? (
        <p className="sub">Ainda não há questões neste concurso.</p>
      ) : (
        <div className="tabela-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Disciplina</th>
                <th scope="col">Resolvidas</th>
                <th scope="col">Certas</th>
                <th scope="col">Erradas</th>
                <th scope="col">%</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.chave}>
                  <td>{l.chave}</td>
                  <td>{l.resolvidas}</td>
                  <td className="ok">{l.certas}</td>
                  <td className="erro">{l.erradas}</td>
                  <td>{fmtPct(l.pct)}</td>
                </tr>
              ))}
              <tr className="total">
                <td>Total</td>
                <td>{t.resolvidas}</td>
                <td className="ok">{t.certas}</td>
                <td className="erro">{t.erradas}</td>
                <td>{fmtPct(t.pct)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// Colunas agrupadas: certas e erradas por dia
export function ColunasPorDia({ dados }) {
  const [dica, setDica] = useState(null);
  const W = 440;
  const H = 230;
  const m = { t: 10, r: 8, b: 34, l: 34 };
  const max = Math.max(4, ...dados.map((d) => Math.max(d.certas, d.erradas)));
  const passo = (W - m.l - m.r) / dados.length;
  const bw = Math.max(4, passo / 2 - 3);
  const y = (v) => H - m.b - (v / max) * (H - m.t - m.b);
  const ticks = [0, Math.round(max / 2), max];
  return (
    <div className="grafico">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Questões certas e erradas por dia nos últimos 14 dias">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={m.l} x2={W - m.r} y1={y(t)} y2={y(t)} stroke="var(--borda)" />
            <text x={m.l - 6} y={y(t) + 4} fontSize="13" textAnchor="end" fill="var(--sub)">{t}</text>
          </g>
        ))}
        {dados.map((d, i) => {
          const x0 = m.l + i * passo + passo / 2 - bw - 1;
          const rot = `${String(d.data.getDate()).padStart(2, '0')}/${String(d.data.getMonth() + 1).padStart(2, '0')}`;
          return (
            <g
              key={i}
              onMouseEnter={() => setDica({ i, rot, ...d })}
              onMouseLeave={() => setDica(null)}
              onClick={() => setDica({ i, rot, ...d })}
            >
              <rect x={m.l + i * passo} y={m.t} width={passo} height={H - m.t - m.b} fill="transparent" />
              <rect x={x0} y={y(d.certas)} width={bw} height={H - m.b - y(d.certas)} fill="var(--ok)" rx="2" />
              <rect x={x0 + bw + 2} y={y(d.erradas)} width={bw} height={H - m.b - y(d.erradas)} fill="var(--erro)" rx="2" />
              {(i % 3 === 1 || dados.length <= 7) && (
                <text x={m.l + i * passo + passo / 2} y={H - 10} fontSize="13" textAnchor="middle" fill="var(--sub)">{rot}</text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="legenda">
        <span><i style={{ background: 'var(--ok)' }} />Certas</span>
        <span><i style={{ background: 'var(--erro)' }} />Erradas</span>
        {dica && (
          <span aria-live="polite" style={{ marginLeft: 'auto', color: 'var(--txt)' }}>
            <b>{dica.rot}</b>: ✓ {dica.certas} certas · ✗ {dica.erradas} erradas
          </span>
        )}
      </div>
    </div>
  );
}

// Barras horizontais com linha da meta, da pior para a melhor
export function BarrasAcerto({ linhas, meta, vazio = 'Sem respostas ainda.' }) {
  const com = linhas.filter((l) => l.resolvidas > 0).sort((a, b) => a.pct - b.pct);
  if (!com.length) return <p className="sub">{vazio}</p>;
  return (
    <div className="hbar">
      {com.map((l) => {
        const abaixo = l.pct < meta;
        return (
          <div key={l.chave} style={{ display: 'contents' }}>
            <div>
              {l.chave}
              <div className="rot">
                {fmtPct(l.pct)} · {l.certas}/{l.resolvidas} {abaixo && <b className="desce">▼ abaixo da meta</b>}
              </div>
            </div>
            <div className="trilho" aria-label={`${l.chave}: ${fmtPct(l.pct)}`}>
              <i className={abaixo ? 'abaixo' : ''} style={{ width: `${Math.max(2, l.pct * 100)}%` }} />
              <span className="meta" style={{ left: `${meta * 100}%` }} title={`Meta ${fmtPct(meta)}`} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export const MiniBarra = ({ v }) => (
  <span className="mini" aria-hidden="true">
    <i style={{ width: `${(v ?? 0) * 100}%` }} />
  </span>
);
