import { useMemo } from 'react';
import { getConcurso } from '../data/concursos.js';
import { QUESTOES, questoesDo } from '../lib/dados.js';
import { chaveRevisao, chaveSessao } from '../lib/cronograma.js';
import { sessoesDoCronograma } from '../lib/cronogramaSalvo.js';
import { descreverRegistro, diasAte, fmtData, fmtPct, porCampo, porDia, resumo } from '../lib/stats.js';
import { anteriorDe, eventosDoAluno, proximaDoAnterior } from '../lib/exameAnterior.js';
import { tipoEvento } from './CalendarioGeral.jsx';
import { situacao } from './Flashcards.jsx';
import { BarrasAcerto, ColunasPorDia } from './Graficos.jsx';

// 🏠 Visão geral: concursos, datas, cronograma de hoje e desempenho num lugar só
const hojeIso = () => new Date().toLocaleDateString('sv-SE');
const fmtT = (s) => { const m = Math.round(s / 60); return m >= 60 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}` : `${m} min`; };
const faltam = (iso) => { const d = diasAte(iso); return d < 0 ? 'já passou' : d === 0 ? 'é hoje' : d === 1 ? 'amanhã' : `faltam ${d} dias`; };
const nomeCargos = (c, cargo) => {
  if (!c.cargos?.length) return '';
  const ids = cargo === 'ambos' || !cargo ? c.cargos.map((x) => x.id) : Array.isArray(cargo) ? cargo : [cargo];
  return c.cargos.filter((x) => ids.includes(x.id)).map((x) => x.nome).join(' · ');
};

export default function Dashboard({ ctx, ir, abrirCrono, estudarConcurso }) {
  const { prefs, setPrefs, respostas, usuario, abrirFicha, abrirAvulsas } = ctx;
  const hoje = hojeIso();
  const meus = (prefs.seguindo || []).map(getConcurso).filter(Boolean);

  // desempenho geral: todas as questões já respondidas, de qualquer concurso
  const todas = useMemo(() => QUESTOES.filter((q) => !q.anulada), [ctx.bancoVersao]); // eslint-disable-line react-hooks/exhaustive-deps
  const respondidas = useMemo(() => todas.filter((q) => respostas[q.uid]), [todas, respostas]);
  const geral = resumo(todas, respostas);
  const rHoje = resumo(todas, respostas, 'hoje');
  const u7 = resumo(todas, respostas, 'ult7');
  const a7 = resumo(todas, respostas, 'ant7');
  const varPP = u7.pct != null && a7.pct != null ? Math.round((u7.pct - a7.pct) * 100) : null;
  const dias14 = porDia(todas, respostas, 14);
  const materias = porCampo(respondidas, respostas, 'materia').filter((m) => m.resolvidas >= 3);
  const piores = [...materias].sort((a, b) => a.pct - b.pct).slice(0, 6);

  // tempo de estudo (cronômetro) e sequência de dias estudados
  const tempoDia = (d) => Object.values(prefs.tempos?.[d] || {}).reduce((a, b) => a + b, 0);
  let t7 = 0;
  for (let i = 0; i < 7; i++) t7 += tempoDia(new Date(Date.now() - i * 86400000).toLocaleDateString('sv-SE'));
  const diasComResposta = new Set(Object.values(respostas).map((a) => new Date(a[2]).toLocaleDateString('sv-SE')));
  let sequencia = 0;
  for (let i = 0; i < 400; i++) {
    const d = new Date(Date.now() - i * 86400000).toLocaleDateString('sv-SE');
    if (diasComResposta.has(d) || tempoDia(d) > 0) sequencia++;
    else if (i > 0) break; // hoje ainda pode não ter estudo: não quebra a sequência
  }

  // concursos: prova que a pessoa vai fazer, próxima data e desempenho
  const cartoes = meus.map((c) => {
    const pc = prefs.concursos?.[c.id] || {};
    const f = c.fases?.find((x) => x.id === pc.fase);
    const prova = f?.data || c.dataProva || '';
    const ev = eventosDoAluno(c, prefs).filter((e) => (e.fim || e.data) >= hoje);
    const prox = ev.find((e) => e.data !== prova) || ev[0];
    let qs = [];
    try { qs = questoesDo(c.id, pc.cargo, pc.fase, { area: pc.area }); } catch { qs = []; }
    return { c, pc, f, prova, prox, r: resumo(qs, respostas), meta: c.meta ?? 0.75 };
  }).sort((a, b) => (a.prova || '9999').localeCompare(b.prova || '9999'));

  const proximas = meus
    .flatMap((c) => eventosDoAluno(c, prefs).map((e) => ({ ...e, sigla: c.sigla, ...tipoEvento(e) })))
    .filter((e) => (e.fim || e.data) >= hoje && !/não vai fazer/.test(e.titulo || ''))
    .sort((a, b) => a.data.localeCompare(b.data))
    .slice(0, 8);

  // cronogramas: o que há para hoje, atrasos e revisões
  const cronos = useMemo(
    () => Object.entries(prefs.cronogramas || {}).map(([k, v]) => { try { return sessoesDoCronograma(k, v, prefs); } catch { return null; } }).filter(Boolean),
    [prefs.cronogramas, ctx.bancoVersao], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const marcar = (k, chave) => {
    const reg = prefs.cronogramas[k];
    const n = { ...(reg.feitos || {}) };
    n[chave] ? delete n[chave] : (n[chave] = 1);
    setPrefs({ cronogramas: { ...prefs.cronogramas, [k]: { ...reg, feitos: n } } });
  };

  const fc = prefs.flashcards?.cartoes || [];
  const fcRevisar = fc.filter((c) => situacao(c) === 'revisar').length;

  // o que foi registrado hoje no cronômetro (matéria, assunto, páginas, horário)
  const registrosHoje = [...(prefs.sessoesEstudo?.[hoje] || [])].sort((a, b) => (a.hora || '').localeCompare(b.hora || ''));

  return (
    <div className="dash">
      <h1 style={{ marginBottom: 2 }}>🏠 Início</h1>
      <p className="sub" style={{ marginTop: 0 }}>Olá, {usuario.nome.split(' ')[0]}! Hoje é {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}. Aqui está o resumo de tudo.</p>

      <div className="resumos">
        <div className="card">
          <div className="sub">Hoje</div>
          <div className="numero">{rHoje.resolvidas} <span className="peq sub">questões</span></div>
          <div className="peq sub">{rHoje.resolvidas ? `✓ ${rHoje.certas} certas · ✗ ${rHoje.erradas} erradas` : 'nenhuma questão ainda'} · ⏱ {fmtT(tempoDia(hoje))}</div>
        </div>
        <div className="card">
          <div className="sub">Acerto geral</div>
          <div className="numero">{fmtPct(geral.pct)}</div>
          <div className="peq sub">{geral.resolvidas} resolvidas (✓ {geral.certas} · ✗ {geral.erradas})</div>
        </div>
        <div className="card">
          <div className="sub">Últimos 7 dias</div>
          <div className="numero">{fmtPct(u7.pct)}</div>
          <div className="peq">
            {u7.resolvidas} questões · ⏱ {fmtT(t7)}
            <br />
            {varPP == null ? <span className="sub">sem comparação com a semana anterior</span> : varPP > 0 ? <span className="sobe">▲ subiu {varPP} p.p.</span> : varPP < 0 ? <span className="desce">▼ caiu {-varPP} p.p.</span> : 'igual à semana anterior'}
          </div>
        </div>
        <div className="card">
          <div className="sub">Sequência de estudo</div>
          <div className="numero">🔥 {sequencia} <span className="peq sub">{sequencia === 1 ? 'dia' : 'dias'}</span></div>
          <div className="peq sub">dias seguidos com questões ou cronômetro</div>
        </div>
      </div>

      <section className="card">
        <div className="linha entre" style={{ alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>📚 O que você estudou hoje</h2>
          <button className="btn peq" onClick={() => ir('painel')}>Ver registro de estudos</button>
        </div>
        {!registrosHoje.length ? (
          <p className="sub">Ainda não há nenhum registro salvo hoje pelo cronômetro.</p>
        ) : (
          <ul className="lista-limpa">
            {registrosHoje.map((r, i) => (
              <li key={i} style={{ padding: '6px 0', borderBottom: '1px solid var(--borda)' }}>
                <b>{descreverRegistro(r)}</b> <span className="peq sub">· {r.seg >= 60 ? `${Math.round(r.seg / 60)} min` : `${r.seg} s`}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="linha entre" style={{ alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>🏆 Meus concursos</h2>
          <button className="btn peq" onClick={() => ir('concursos')}>Ver todos / adicionar</button>
        </div>
        {!cartoes.length && <p className="card">Você ainda não acompanha nenhum concurso. Clique em “Ver todos / adicionar”.</p>}
        <div className="grade" style={{ marginTop: 8 }}>
          {cartoes.map(({ c, pc, f, prova, prox, r, meta }) => {
            const d = prova ? diasAte(prova) : null;
            return (
              <div key={c.id} className="card" style={{ borderLeft: `6px solid ${d != null && d >= 0 && d <= 30 ? 'var(--erro)' : 'var(--pri)'}` }}>
                <h3 style={{ margin: 0 }}>{c.sigla}</h3>
                <p className="sub peq" style={{ marginTop: 2 }}>
                  {c.nome}
                  {nomeCargos(c, pc.cargo) && <><br />Cargo: {nomeCargos(c, pc.cargo)}</>}
                  {f && <><br />Você estuda: {f.nome}</>}
                </p>
                {prova ? (
                  <p style={{ margin: '6px 0' }}>
                    🔴 <b>Prova: {fmtData(prova)}</b>
                    <br />
                    <span style={{ fontSize: '1.3rem', fontWeight: 800 }}>{faltam(prova)}</span>
                  </p>
                ) : (
                  <p className="sub" style={{ margin: '6px 0' }}>Data da prova ainda não informada.</p>
                )}
                {anteriorDe(prefs, c.id) && !anteriorDe(prefs, c.id).resultado && (
                  <p className="peq" style={{ margin: '4px 0' }}>
                    ⏳ Aguardando o resultado do <b>{anteriorDe(prefs, c.id).exame}</b>
                    {proximaDoAnterior(prefs, c) && <> – {proximaDoAnterior(prefs, c).titulo.split(': ').slice(1).join(': ')} em <b>{fmtData(proximaDoAnterior(prefs, c).data)}</b></>}. Se não passar, esta prova é a sua repescagem.
                  </p>
                )}
                {prox && prox.data !== prova && (
                  <p className="peq" style={{ margin: '4px 0' }}>
                    📌 Próxima data: <b>{fmtData(prox.data)}{prox.fim ? ` a ${fmtData(prox.fim)}` : ''}</b> – {prox.titulo}
                  </p>
                )}
                <p className="peq" style={{ margin: '4px 0' }}>
                  📊 Seu acerto: <b className={r.pct == null ? '' : r.pct >= meta ? 'sobe' : 'desce'}>{fmtPct(r.pct)}</b>
                  {r.pct != null && (r.pct >= meta ? ' ✓ na meta' : ' ✗ abaixo da meta')} (meta {fmtPct(meta)}) · {r.resolvidas} de {r.total} questões
                </p>
                <div className="linha" style={{ marginTop: 8 }}>
                  <button className="btn pri peq" onClick={() => estudarConcurso(c.id)}>📝 Questões</button>
                  <button className="btn peq" onClick={() => abrirFicha(c.id)}>Ficha e edital</button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="card">
        <div className="linha entre" style={{ alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>📆 Hoje no cronograma</h2>
          <button className="btn peq" onClick={() => ir('cronograma')}>Meus cronogramas</button>
        </div>
        {!cronos.length && <p className="sub">Você ainda não tem cronograma. Crie um em “Meus cronogramas”.</p>}
        {cronos.map((cr) => {
          const deHoje = cr.sessoes.filter((s) => s.data === hoje);
          const feitas = cr.sessoes.filter((s) => cr.feitos[chaveSessao(s)]).length;
          const atrasadas = cr.sessoes.filter((s) => s.data < hoje && !cr.feitos[chaveSessao(s)]).length;
          const rev = cr.revisoes.filter((r) => r.data <= hoje && !cr.feitos[chaveRevisao(r)]).length;
          const p = cr.sessoes.length ? feitas / cr.sessoes.length : 0;
          return (
            <div key={cr.k} style={{ borderTop: '1px solid var(--borda)', marginTop: 10, paddingTop: 10 }}>
              <div className="linha entre" style={{ alignItems: 'center' }}>
                <b>{cr.titulo}</b>
                <button className="btn peq" onClick={() => abrirCrono(cr.abrir)}>▶ Abrir</button>
              </div>
              <div className="peq sub">
                Progresso: {feitas}/{cr.sessoes.length} blocos ({fmtPct(p)})
                {atrasadas > 0 && <b className="desce"> · ⚠ {atrasadas} {atrasadas === 1 ? 'bloco atrasado' : 'blocos atrasados'}</b>}
                {rev > 0 && <b> · 🔁 {rev} {rev === 1 ? 'revisão pendente' : 'revisões pendentes'}</b>}
              </div>
              <div className="trilho-simples" aria-hidden="true"><i style={{ width: `${p * 100}%` }} /></div>
              {deHoje.length ? (
                <ul className="lista-limpa">
                  {deHoje.map((s) => {
                    const ch = chaveSessao(s);
                    const ok = !!cr.feitos[ch];
                    return (
                      <li key={ch} className="sessao">
                        <input type="checkbox" checked={ok} onChange={() => marcar(cr.k, ch)} aria-label={`Concluída: ${s.disciplina} às ${s.ini}`} />
                        <div style={{ flex: 1, opacity: ok ? 0.6 : 1 }}>
                          <div className="peq sub">{s.ini}–{s.fim} {s.origemSigla && <span>· {s.origemSigla}</span>} {ok && <b className="sobe">· ✓ feito</b>}</div>
                          <b>{s.disciplina}</b>
                          <div className="peq">{s.tema}</div>
                        </div>
                        <button className="praticar peq" onClick={() => abrirAvulsas({ materia: s.disciplina, mostrar: 'nao' })}>✎ questões</button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="peq sub" style={{ marginBottom: 0 }}>Sem blocos de estudo marcados para hoje neste cronograma.</p>
              )}
            </div>
          );
        })}
      </section>

      <div className="grade">
        <section className="card">
          <div className="linha entre" style={{ alignItems: 'center' }}>
            <h2 style={{ margin: 0 }}>📅 Próximas datas</h2>
            <button className="btn peq" onClick={() => ir('calendario')}>Calendário</button>
          </div>
          {!proximas.length && <p className="sub">Nenhuma data futura cadastrada.</p>}
          <ul className="lista-limpa">
            {proximas.map((e, i) => (
              <li key={i} style={{ padding: '7px 0', borderBottom: '1px solid var(--borda)' }}>
                <b>{e.ico} {fmtData(e.data)}{e.fim && e.fim !== e.data ? ` a ${fmtData(e.fim)}` : ''}</b> <span className="peq sub">· {e.data <= hoje ? 'em andamento' : faltam(e.data)}</span>
                <div className="peq">{e.anterior ? e.titulo : `${e.sigla}: ${e.titulo}`}{e.prova ? ' (dia de prova)' : ''}</div>
              </li>
            ))}
          </ul>
        </section>

        <section className="card">
          <h2 style={{ marginTop: 0 }}>🃏 Revisões e flashcards</h2>
          <p style={{ marginTop: 0 }}>
            {fc.length ? (fcRevisar ? <><b>{fcRevisar}</b> {fcRevisar === 1 ? 'cartão' : 'cartões'} para revisar hoje (de {fc.length}).</> : <>✓ Nenhum cartão para revisar hoje (você tem {fc.length}).</>) : 'Você ainda não criou flashcards.'}
          </p>
          <button className="btn peq" onClick={() => { setPrefs({ estudarAba: 'flashcards' }); ir('mapas'); }}>Abrir flashcards</button>
          <h3>⏱ Tempo de estudo (7 dias)</h3>
          <p className="numero" style={{ margin: 0 }}>{fmtT(t7)}</p>
          <p className="peq sub">Registrado pelo cronômetro flutuante (botão ⏱ no topo).</p>
        </section>
      </div>

      <section className="card">
        <div className="linha entre" style={{ alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>📊 Meu desempenho</h2>
          <button className="btn peq" onClick={() => ir('painel')}>Painel completo</button>
        </div>
        <h3>Questões por dia (últimos 14 dias)</h3>
        <ColunasPorDia dados={dias14} />
        <h3>Matérias que mais precisam de atenção</h3>
        <p className="peq sub" style={{ marginTop: 0 }}>Considera todas as suas respostas, de todos os concursos (matérias com 3 ou mais questões resolvidas).</p>
        <BarrasAcerto linhas={piores} meta={0.75} vazio="Resolva algumas questões para ver aqui as matérias em que você mais erra." />
      </section>
    </div>
  );
}
