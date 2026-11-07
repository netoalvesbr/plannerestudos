import { useEffect, useRef, useState } from 'react';
import { POR_UID } from '../lib/dados.js';
import { fmtPct, porCampo, resumo } from '../lib/stats.js';

const LETRAS_AE = ['A', 'B', 'C', 'D', 'E'];
const ROTULO_CE = { C: 'Certo', E: 'Errado' };

export default function Questao({ sessao, respostas, responder, aoSair, aoConcluir, aoAnotar, notas }) {
  const { uids, titulo, modo } = sessao;
  const [idx, setIdx] = useState(sessao.idx || 0);
  const [marcadas, setMarcadas] = useState({}); // simulado
  const [restante, setRestante] = useState(modo === 'simulado' ? (sessao.minutos || 50) * 60 : null);
  const inicio = useRef(Date.now());
  const explicacao = useRef(null);
  const q = POR_UID[uids[idx]];
  const resp = respostas[q.uid];
  const revelar = modo !== 'simulado' && !!resp;

  useEffect(() => {
    inicio.current = Date.now();
    window.scrollTo({ top: 0 });
  }, [idx]);

  useEffect(() => {
    if (modo !== 'simulado') return;
    const t = setInterval(() => setRestante((r) => r - 1), 1000);
    return () => clearInterval(t);
  }, [modo]);

  useEffect(() => {
    if (modo === 'simulado' && restante <= 0) concluir(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restante]);

  function marcar(letra) {
    const seg = Math.round((Date.now() - inicio.current) / 1000);
    if (modo === 'simulado') {
      if (resp) return;
      setMarcadas((m) => ({ ...m, [q.uid]: [letra, seg + (m[q.uid]?.[1] || 0)] }));
      return;
    }
    if (resp) return;
    responder(q.uid, letra, seg);
    setTimeout(() => explicacao.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  }

  function concluir(porTempo = false) {
    let jaRespondidas = 0;
    if (modo === 'simulado') {
      for (const u of uids) {
        if (respostas[u]) jaRespondidas++;
        else if (marcadas[u]) responder(u, marcadas[u][0], marcadas[u][1]);
      }
    }
    aoConcluir({ jaRespondidas, porTempo });
  }

  const acertosSessao = uids.filter((u) => respostas[u]?.[1]).length;
  const respondidasSessao = uids.filter((u) => respostas[u] || marcadas[u]).length;
  const letras = q.formato === 'CE' ? ['C', 'E'] : LETRAS_AE.filter((l) => q.alternativas[l] != null);
  const marcadaSim = marcadas[q.uid]?.[0];
  const mm = restante != null ? `${String(Math.max(0, Math.floor(restante / 60))).padStart(2, '0')}:${String(Math.max(0, restante % 60)).padStart(2, '0')}` : null;

  return (
    <div>
      <div className="q-topo">
        <button className="btn peq" onClick={aoSair}>Sair</button>
        <div style={{ flex: 1 }}>
          <div className="peq sub">{titulo}</div>
          <b>{idx + 1} de {uids.length}</b>
        </div>
        {modo === 'simulado' ? (
          <div aria-live="off" className={restante < 300 ? 'desce' : ''}>
            ⏱ <b>{mm}</b>
            <div className="peq sub">{respondidasSessao}/{uids.length} marcadas</div>
          </div>
        ) : (
          <div className="peq" style={{ textAlign: 'right' }}>
            ✓ <b>{acertosSessao}</b> acertos
            <div className="sub">{respondidasSessao}/{uids.length} resolvidas</div>
          </div>
        )}
        <span style={{ width: 52 }} aria-hidden="true" />
      </div>

      <article className="card">
        <div className="etiqueta">
          {[q.banca, q.ano, q.materia, q.assunto, q.dificuldade].filter(Boolean).join(' · ')}
          {q.origem === 'prova_anterior' && q.orgao_prova_original ? ` · ${q.orgao_prova_original}` : ''}
        </div>
        <div className="enunciado">{q.enunciado}</div>

        <div className="alts" role="group" aria-label="Alternativas">
          {letras.map((L) => {
            let cls = '';
            if (revelar) {
              if (L === q.gabarito) cls = 'certa';
              else if (L === resp[0]) cls = 'errada';
            } else if (modo === 'simulado' && (marcadaSim === L || resp?.[0] === L)) cls = 'marcada';
            const texto = q.formato === 'CE' ? ROTULO_CE[L] : q.alternativas[L];
            return (
              <button key={L} className={`alt ${cls}`} disabled={!!resp} onClick={() => marcar(L)} aria-pressed={resp?.[0] === L || marcadaSim === L}>
                <span className="letra">{L}</span>
                <span>
                  {texto}
                  {revelar && L === q.gabarito && <b className="oculto"> (gabarito)</b>}
                </span>
              </button>
            );
          })}
        </div>

        {modo === 'simulado' && resp && (
          <p className="sub" style={{ marginTop: 10 }}>Você já respondeu esta questão antes; vale a primeira resposta.</p>
        )}

        {revelar && (
          <div ref={explicacao} className="explica">
            {resp[1] ? (
              <div className="veredito ok" role="status">✓ Resposta certa!</div>
            ) : (
              <div className="veredito erro" role="status">✗ Resposta errada. Você marcou {resp[0]}; o gabarito é {q.gabarito}.</div>
            )}
            <h3>Comentário</h3>
            <p>{q.comentario}</p>
            <h3>Fundamentação</h3>
            <p>{q.fonte}</p>
          </div>
        )}

        <details style={{ marginTop: 12 }}>
          <summary className="sub">📝 Minha anotação</summary>
          <textarea
            defaultValue={notas?.[q.uid] || ''}
            key={q.uid}
            rows={3}
            style={{ width: '100%', marginTop: 6, borderRadius: 10, border: '1px solid var(--borda)', padding: 8, background: 'var(--card)', color: 'var(--txt)', font: 'inherit' }}
            onBlur={(e) => aoAnotar(q.uid, e.target.value)}
            placeholder="Anote algo para revisar depois…"
          />
        </details>
      </article>

      <div className="q-nav">
        <button className="btn" disabled={idx === 0} onClick={() => setIdx(idx - 1)}>← Anterior</button>
        {idx < uids.length - 1 ? (
          <button className="btn pri" onClick={() => setIdx(idx + 1)}>Próxima →</button>
        ) : (
          <button className="btn pri" onClick={() => concluir()}>Concluir</button>
        )}
      </div>
      {idx < uids.length - 1 && (
        <div className="centro" style={{ marginTop: 10 }}>
          <button className="praticar" onClick={() => concluir()}>Concluir agora</button>
        </div>
      )}
    </div>
  );
}

export function Conclusao({ sessao, info, respostas, aoRevisar, aoVoltar }) {
  const qs = sessao.uids.map((u) => POR_UID[u]);
  const t = resumo(qs, respostas);
  const linhas = porCampo(qs, respostas, 'materia');
  return (
    <div>
      <section className="card centro">
        <p className="sub">{sessao.titulo}</p>
        <h1>{t.certas} de {sessao.uids.length} certas</h1>
        <p className="numero" style={{ color: t.certas / sessao.uids.length >= 0.75 ? 'var(--ok)' : 'var(--erro)' }}>{fmtPct(t.certas / sessao.uids.length)}</p>
        {t.resolvidas > 0 && t.resolvidas < sessao.uids.length && <p className="sub">{fmtPct(t.pct)} de acerto nas respondidas</p>}
        <p className="sub">
          {t.resolvidas} resolvidas · ✓ {t.certas} certas · ✗ {t.erradas} erradas
          {t.resolvidas < sessao.uids.length && ` · ${sessao.uids.length - t.resolvidas} em branco`}
        </p>
        {info?.porTempo && <p className="aviso">O tempo do simulado acabou.</p>}
        {info?.jaRespondidas > 0 && <p className="sub">{info.jaRespondidas} questões já tinham sido respondidas antes; valeu a primeira resposta.</p>}
      </section>
      <section className="card">
        <h2>Por disciplina</h2>
        <table>
          <thead><tr><th>Disciplina</th><th>Resolvidas</th><th>Certas</th><th>Erradas</th><th>%</th></tr></thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.chave}><td>{l.chave}</td><td>{l.resolvidas}</td><td className="ok">{l.certas}</td><td className="erro">{l.erradas}</td><td>{fmtPct(l.pct)}</td></tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="card">
        <h2>Gabarito da sessão</h2>
        <div className="linha">
          {qs.map((q, i) => {
            const r = respostas[q.uid];
            const sim = r ? (r[1] ? '✓' : '✗') : '–';
            return (
              <button
                key={q.uid}
                className="btn peq"
                style={{ color: r ? (r[1] ? 'var(--ok)' : 'var(--erro)') : 'var(--sub)' }}
                onClick={() => aoRevisar(i)}
                aria-label={`Questão ${i + 1}: ${r ? (r[1] ? 'certa' : 'errada') : 'em branco'}`}
              >
                {i + 1} {sim}
              </button>
            );
          })}
        </div>
      </section>
      <button className="btn pri" onClick={aoVoltar}>Voltar ao início</button>
    </div>
  );
}
