import { useRef, useState } from 'react';
import { ADMIN_EMAILS } from '../data/config.js';
import { getConcurso } from '../data/concursos.js';
import { QUESTOES } from '../lib/dados.js';
import { fmtPct, resumo } from '../lib/stats.js';

// Cartão de questão: o formato padrão da plataforma (lista de questões, prova do dia e simulado).
// Cabeçalho com número, código e matéria; alternativas com ✂ para eliminar; botão Responder;
// depois da resposta, mostra a opção correta e abre os comentários. Embaixo: marcadores, anotações e estatísticas.
const LETRAS_AE = ['A', 'B', 'C', 'D', 'E'];
const ROTULO_CE = { C: 'Certo', E: 'Errado' };
export const MARCADORES = [
  ['favorita', '⭐ Favorita'],
  ['revisar', '🔁 Revisar depois'],
  ['duvida', '❓ Tenho dúvida'],
];
export const codigoDa = (q) => 'Q' + String(q.uid).replace(/[^a-z0-9]/gi, '').slice(0, 7).toUpperCase();
const dataHora = (ts) => new Date(ts).toLocaleDateString('pt-BR');
const fmtSeg = (s) => (s >= 60 ? `${Math.floor(s / 60)} min ${s % 60} s` : `${s} s`);

export default function CartaoQuestao({ q, numero, resp, respostas, modo = 'estudo', marcadaSim, aoResponder, aoMarcarSim, nota, aoAnotar, marcadores = [], aoMarcador }) {
  const [sel, setSel] = useState(null);
  const [cortadas, setCortadas] = useState([]);
  const [aba, setAba] = useState(null);
  const inicio = useRef(null);
  const tocar = () => { if (!inicio.current) inicio.current = Date.now(); };
  const segundos = () => (inicio.current ? Math.round((Date.now() - inicio.current) / 1000) : 0);

  const simulado = modo === 'simulado';
  const revelar = !simulado && !!resp;
  const discursiva = q.formato === 'discursiva';
  const letras = q.formato === 'CE' ? ['C', 'E'] : discursiva ? [] : LETRAS_AE.filter((l) => q.alternativas?.[l] != null && (q.formato !== 'A-D' || l !== 'E'));
  const nomeLetra = (L) => (q.formato === 'CE' ? ROTULO_CE[L] : L);
  const marcada = simulado ? marcadaSim || resp?.[0] : resp ? resp[0] : sel;
  const c = getConcurso(q.concursos?.[0]);
  const prova = q.orgao_prova_original || q.concursoRef || c?.sigla || '';
  const inedita = q.origem === 'inédita' || q.origem === 'inedita';

  function escolher(L) {
    tocar();
    if (resp) return;
    if (simulado) return aoMarcarSim?.(L, segundos());
    setSel(sel === L ? null : L);
    setCortadas(cortadas.filter((x) => x !== L));
  }
  function responder() {
    if (!sel || resp) return;
    aoResponder(sel, segundos());
    setAba('comentario');
  }
  const cortar = (L) => {
    tocar();
    setCortadas(cortadas.includes(L) ? cortadas.filter((x) => x !== L) : [...cortadas, L]);
    if (sel === L) setSel(null);
  };
  const abrir = (k) => setAba(aba === k ? null : k);
  const relato = `mailto:${ADMIN_EMAILS[0]}?subject=${encodeURIComponent(`EstudaAí – erro na questão ${codigoDa(q)}`)}&body=${encodeURIComponent(`Questão ${codigoDa(q)} (${q.materia}${q.assunto ? ' – ' + q.assunto : ''})\n\n"${q.enunciado.slice(0, 300)}…"\n\nO que está errado:\n`)}`;

  return (
    <article className="card questao" id={'q-' + q.uid}>
      <header className="q-cab">
        {numero != null && <b className="q-num">{numero}</b>}
        <span className="q-cod">{codigoDa(q)}</span>
        <span className="q-mat">
          {q.materia}
          {q.assunto ? <span className="sub"> › {q.assunto}</span> : null}
        </span>
        <span className="q-selos">
          {inedita && <span className="selo">⭐ Inédita</span>}
          {q.anulada && <span className="selo">⚠ Anulada</span>}
          {marcadores.length > 0 && <span className="selo" title="Tem marcador">🔖</span>}
          {resp && <span className="selo ok">✓ Resolvida</span>}
        </span>
      </header>
      <p className="q-meta">
        {q.ano && <span><b>Ano:</b> {q.ano}</span>}
        {q.banca && <span><b>Banca:</b> {q.banca}</span>}
        {prova && <span><b>Prova:</b> {prova}</span>}
        {q.dificuldade && <span><b>Nível:</b> {q.dificuldade}</span>}
      </p>

      <div className="enunciado">{q.enunciado}</div>

      <div className="alts" role="group" aria-label="Alternativas">
        {letras.map((L) => {
          const certa = revelar && L === q.gabarito;
          const errada = revelar && L === resp[0] && !resp[1];
          const riscada = revelar ? !certa && !errada : cortadas.includes(L);
          const cls = certa ? 'certa' : errada ? 'errada' : !revelar && marcada === L ? 'marcada' : '';
          const texto = q.formato === 'CE' ? ROTULO_CE[L] : q.alternativas[L];
          return (
            <div key={L} className="alt-linha">
              {revelar ? (
                <span className={'alt-marca' + (certa ? ' ok' : errada ? ' erro' : '')} aria-hidden="true">{certa ? '✓' : errada ? '✗' : ''}</span>
              ) : (
                <button type="button" className="tesoura" aria-pressed={cortadas.includes(L)} aria-label={`${cortadas.includes(L) ? 'Desfazer a eliminação da' : 'Eliminar a'} alternativa ${nomeLetra(L)}`} title="Riscar esta alternativa (eliminar)" disabled={!!resp} onClick={() => cortar(L)}>✂</button>
              )}
              <button type="button" className={`alt ${cls}${riscada ? ' riscada' : ''}`} disabled={!!resp} onClick={() => escolher(L)} aria-pressed={marcada === L}>
                <span className="letra">{L}</span>
                <span>
                  <span className="alt-texto">{texto}</span>
                  {certa && <b className="alt-tag ok">✓ OPÇÃO CORRETA</b>}
                  {errada && <b className="alt-tag erro">✗ Sua resposta</b>}
                </span>
              </button>
            </div>
          );
        })}
      </div>

      {discursiva && <Discursiva q={q} resp={resp} aoAvaliar={(ok) => aoResponder(ok ? 'OK' : 'X', segundos())} />}

      {!discursiva && !simulado && (
        <div className="q-resp">
          <button type="button" className="btn pri" disabled={!sel || !!resp} onClick={responder}>Responder</button>
          {resp ? (
            <span role="status">
              {resp[1] ? <b className="sobe">✓ Certa!</b> : <><b className="desce">✗ Errada!</b> Opção correta: <b>{nomeLetra(q.gabarito)}</b></>}
              <span className="sub peq"> · respondida em {dataHora(resp[2])}</span>
            </span>
          ) : (
            <span className="sub peq">{sel ? `Você marcou ${nomeLetra(sel)}. Clique em Responder para conferir.` : 'Marque uma alternativa. Use ✂ para riscar as que você eliminar.'}</span>
          )}
        </div>
      )}
      {simulado && resp && <p className="sub peq">Você já respondeu esta questão antes; vale a primeira resposta.</p>}

      <div className="q-abas" role="group" aria-label="Mais sobre a questão">
        <button type="button" aria-expanded={aba === 'comentario'} onClick={() => abrir('comentario')}>💬 Comentários</button>
        <button type="button" aria-expanded={aba === 'marcadores'} onClick={() => abrir('marcadores')}>🔖 Marcadores{marcadores.length ? ` (${marcadores.length})` : ''}</button>
        <button type="button" aria-expanded={aba === 'anotacoes'} onClick={() => abrir('anotacoes')}>📝 Anotações{nota ? ' •' : ''}</button>
        <button type="button" aria-expanded={aba === 'estatisticas'} onClick={() => abrir('estatisticas')}>📊 Estatísticas</button>
        <a href={relato} className="q-relato">⚠ Reportar erro</a>
      </div>

      {aba === 'comentario' && (
        <div className="explica q-painel">
          {!revelar && !(discursiva && resp) ? (
            <p className="sub">{simulado ? 'No simulado, o comentário aparece depois que você concluir.' : 'Responda a questão para ver o comentário e a fundamentação.'}</p>
          ) : (
            <>
              {q.comentario ? (
                <>
                  <h3>Comentário</h3>
                  <p style={{ whiteSpace: 'pre-line' }}>{q.comentario}</p>
                </>
              ) : (
                <p className="sub">Questão de prova anterior, ainda sem comentário.</p>
              )}
              {q.fonte && (
                <>
                  <h3>{q.origem === 'prova_anterior' ? 'Origem' : 'Fundamentação'}</h3>
                  <p>{q.fonte}</p>
                </>
              )}
            </>
          )}
        </div>
      )}
      {aba === 'marcadores' && (
        <div className="q-painel">
          <p className="sub peq" style={{ marginTop: 0 }}>Marque para achar esta questão depois (use o filtro “Marcadores”).</p>
          <div className="chips">
            {MARCADORES.map(([k, rot]) => (
              <button key={k} type="button" className="chip" aria-pressed={marcadores.includes(k)} onClick={() => aoMarcador?.(k)}>
                {marcadores.includes(k) ? '✓ ' : ''}{rot}
              </button>
            ))}
          </div>
        </div>
      )}
      {aba === 'anotacoes' && (
        <div className="q-painel">
          <label className="campo">
            Minha anotação (só você vê)
            <textarea defaultValue={nota || ''} rows={3} className="q-nota" onBlur={(e) => aoAnotar?.(e.target.value)} placeholder="Anote algo para revisar depois…" />
          </label>
        </div>
      )}
      {aba === 'estatisticas' && <Estatisticas q={q} resp={resp} respostas={respostas} nomeLetra={nomeLetra} oculto={simulado} />}
    </article>
  );
}

function Estatisticas({ q, resp, respostas, nomeLetra, oculto }) {
  const daMateria = resumo(QUESTOES.filter((x) => x.materia === q.materia && !x.anulada), respostas || {});
  return (
    <div className="q-painel">
      {resp && !oculto ? (
        <p style={{ marginTop: 0 }}>
          Sua resposta: <b>{nomeLetra(resp[0])}</b> – {resp[1] ? <b className="sobe">✓ certa</b> : <b className="desce">✗ errada</b>} · em {dataHora(resp[2])}
          {resp[3] ? ` · tempo: ${fmtSeg(resp[3])}` : ''}
        </p>
      ) : (
        <p className="sub" style={{ marginTop: 0 }}>{resp ? 'Você já respondeu esta questão.' : 'Você ainda não respondeu esta questão.'}</p>
      )}
      <p className="peq" style={{ marginBottom: 0 }}>
        Seu desempenho em <b>{q.materia}</b>: {fmtPct(daMateria.pct)} de acerto ({daMateria.certas} certas em {daMateria.resolvidas} resolvidas, de {daMateria.total} no banco).
      </p>
    </div>
  );
}

export function Discursiva({ q, resp, aoAvaliar }) {
  const [ver, setVer] = useState(!!resp);
  return (
    <div style={{ marginTop: 6 }}>
      {!resp && (
        <label className="campo">
          Sua resposta (rascunho – não é salvo)
          <textarea rows={6} className="q-nota" />
        </label>
      )}
      {!ver ? (
        <button className="btn pri" style={{ marginTop: 10 }} onClick={() => setVer(true)}>Ver espelho de resposta</button>
      ) : (
        <div className="explica">
          <h3>Espelho / padrão de resposta</h3>
          <p style={{ whiteSpace: 'pre-line' }}>{q.espelho || 'Esta questão ainda não tem espelho cadastrado.'}</p>
          {q.fonte && <p className="sub">{q.fonte}</p>}
          {!resp ? (
            <>
              <p><b>Comparando com o espelho, como foi a sua resposta?</b></p>
              <div className="linha">
                <button className="btn" style={{ color: 'var(--ok)', borderColor: 'var(--ok)' }} onClick={() => aoAvaliar(true)}>✓ Acertei</button>
                <button className="btn" style={{ color: 'var(--erro)', borderColor: 'var(--erro)' }} onClick={() => aoAvaliar(false)}>✗ Errei</button>
              </div>
            </>
          ) : (
            <div className={`veredito ${resp[1] ? 'ok' : 'erro'}`} role="status">{resp[1] ? '✓ Você marcou como certa.' : '✗ Você marcou como errada.'}</div>
          )}
        </div>
      )}
    </div>
  );
}
