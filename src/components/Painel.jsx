import { useState } from 'react';
import { assuntosParaRevisar, estimarNota, fmtPct, porCampo, porDia, resumo } from '../lib/stats.js';
import { BarrasAcerto, ColunasPorDia, TabelaRendimento } from './Graficos.jsx';

const nf = (v) => (v == null ? '—' : v.toLocaleString('pt-BR', { maximumFractionDigits: 1 }));

export default function Painel({ ctx }) {
  const { concurso, questoes, respostas, abrirAvulsas, zerar, historicoTexto, prefs } = ctx;
  const [confirmar, setConfirmar] = useState(false);
  const [copiado, setCopiado] = useState(null);
  const meta = concurso.meta ?? 0.75;
  const geral = resumo(questoes, respostas);
  const u7 = resumo(questoes, respostas, 'ult7');
  const a7 = resumo(questoes, respostas, 'ant7');
  const varPP = u7.pct != null && a7.pct != null ? Math.round((u7.pct - a7.pct) * 100) : null;
  const nota = estimarNota(concurso, questoes, respostas);
  const revisar = assuntosParaRevisar(questoes, respostas, meta);
  const ordemDif = ['fácil', 'média', 'difícil'];
  // tempo estudado com o cronômetro nos últimos 7 dias
  const tempo7 = {};
  for (let i = 0; i < 7; i++) {
    const d = new Date(Date.now() - i * 86400000).toLocaleDateString('sv-SE');
    for (const [m, s] of Object.entries(prefs?.tempos?.[d] || {})) tempo7[m] = (tempo7[m] || 0) + s;
  }
  const total7 = Object.values(tempo7).reduce((a, b) => a + b, 0);
  const fmtT = (s) => { const m = Math.round(s / 60); return m >= 60 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}` : `${m} min`; };

  return (
    <div>
      <h1>Painel de desempenho</h1>
      <div className="resumos">
        <div className="card">
          <div className="sub">⏱ Estudo (7 dias)</div>
          <div className="numero">{fmtT(total7)}</div>
          <div className="peq sub">{total7 ? Object.entries(tempo7).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([m, s]) => `${m}: ${fmtT(s)}`).join(' · ') : 'use o cronômetro para registrar'}</div>
        </div>
        <div className="card">
          <div className="sub">Resolvidas</div>
          <div className="numero">{geral.resolvidas}</div>
          <div className="peq sub">de {geral.total} do banco ({fmtPct(geral.total ? geral.resolvidas / geral.total : null)})</div>
        </div>
        <div className="card">
          <div className="sub">Acerto geral</div>
          <div className="numero" style={{ color: geral.pct == null ? undefined : geral.pct >= meta ? 'var(--ok)' : 'var(--erro)' }}>{fmtPct(geral.pct)}</div>
          <div className="peq sub">meta {fmtPct(meta)}</div>
        </div>
        <div className="card">
          <div className="sub">Últimos 7 dias</div>
          <div className="numero">{fmtPct(u7.pct)}</div>
          <div className="peq">
            {u7.resolvidas} resolvidas ·{' '}
            {varPP == null ? <span className="sub">sem comparação</span> : varPP > 0 ? <span className="sobe">▲ +{varPP} p.p.</span> : varPP < 0 ? <span className="desce">▼ {varPP} p.p.</span> : '= 0 p.p.'}
          </div>
        </div>
      </div>

      {nota && (
        <section className="card">
          <h2>Estimativa de nota na objetiva</h2>
          <p className="sub">Aplica o seu acerto atual em cada bloco aos pesos oficiais da prova.</p>
          <table>
            <thead><tr><th>Bloco</th><th>Acerto</th><th>Pontos</th></tr></thead>
            <tbody>
              {nota.blocos.map((b) => (
                <tr key={b.nome}>
                  <td>{b.nome}<div className="peq sub">{b.questoes} questões × peso {b.peso} · {b.minimo}</div></td>
                  <td>{fmtPct(b.acerto)}</td>
                  <td>{nf(b.pontos)} / {b.max}</td>
                </tr>
              ))}
              <tr className="total">
                <td>Total estimado</td>
                <td />
                <td>{nf(nota.total)} / {nota.max}</td>
              </tr>
            </tbody>
          </table>
          {nota.total != null && (
            <p style={{ marginTop: 8 }}>
              {!nota.completo
                ? 'Resolva questões de todos os blocos para uma estimativa completa.'
                : nota.total >= nota.max / 2
                  ? `✓ Acima do mínimo de aprovação (${concurso.prova.aprovacao}).`
                  : `✗ Abaixo do mínimo de aprovação (${concurso.prova.aprovacao}).`}
            </p>
          )}
        </section>
      )}

      <TabelaRendimento questoes={questoes} respostas={respostas} ordem={concurso.disciplinas.map((d) => d.nome)} />

      <section className="card">
        <h2>Questões por dia (últimos 14 dias)</h2>
        <ColunasPorDia dados={porDia(questoes, respostas, 14)} />
      </section>

      <section className="card">
        <h2>Acerto por disciplina</h2>
        <BarrasAcerto linhas={porCampo(questoes, respostas, 'materia')} meta={meta} />
      </section>
      <section className="card">
        <h2>Acerto por bloco</h2>
        <BarrasAcerto linhas={porCampo(questoes, respostas, 'bloco')} meta={meta} />
      </section>
      <section className="card">
        <h2>Acerto por dificuldade</h2>
        <BarrasAcerto linhas={porCampo(questoes, respostas, 'dificuldade').sort((a, b) => ordemDif.indexOf(a.chave) - ordemDif.indexOf(b.chave))} meta={meta} />
      </section>

      <section className="card">
        <h2>Assuntos para revisar</h2>
        {!revisar.length ? (
          <p className="sub">Nenhum assunto abaixo da meta (com pelo menos 2 questões resolvidas).</p>
        ) : (
          <div className="linha">
            {revisar.map((a) => (
              <button key={a.chave} className="btn peq" onClick={() => abrirAvulsas({ materia: a.materia, assunto: a.chave, mostrar: 'errei' })}>
                {a.chave} · {fmtPct(a.pct)}
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <h2>Seus dados</h2>
        <div className="linha">
          <button
            className="btn"
            onClick={() =>
              navigator.clipboard
                .writeText(historicoTexto())
                .then(() => setCopiado('Histórico copiado. Cole num arquivo de texto para guardar uma cópia.'))
                .catch(() => setCopiado('Não foi possível copiar neste aparelho.'))
            }
          >
            📋 Copiar histórico
          </button>
          {!confirmar ? (
            <button className="btn perigo" onClick={() => setConfirmar(true)}>
              Zerar respostas
            </button>
          ) : (
            <span className="linha" role="alert">
              <span>Zerar todas as suas respostas de {concurso.sigla}? Não dá para desfazer.</span>
              <button className="btn perigo" onClick={() => { zerar(); setConfirmar(false); }}>Sim, zerar</button>
              <button className="btn" onClick={() => setConfirmar(false)}>Cancelar</button>
            </span>
          )}
        </div>
        {copiado && <p className="sub" style={{ marginTop: 8 }} aria-live="polite">{copiado}</p>}
      </section>
    </div>
  );
}
