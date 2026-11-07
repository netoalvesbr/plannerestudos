import { textoDoPdf } from '../lib/leitorPdf.js';
import { useEffect, useState } from 'react';
import { compartilharVerticalizado, excluirVerticalizado, listarVerticalizados } from '../lib/remoto.js';
import { SUGESTOES_OAB } from '../data/modelos.js';
import { disciplinasDo } from '../lib/dados.js';
import { lerVerticalizado } from '../lib/leitura.js';

export const chaveVert = (cid, fase, area) => [cid, fase || '', area || ''].join('|');

// Edital verticalizado do usuário (pessoal): importado de outra plataforma ou sugerido pelo sistema.
export function verticalizadoDe(prefs, cid, fase, area) {
  return prefs.verticalizados?.[chaveVert(cid, fase, area)] || null;
}

function sugerir(concurso, cargo, fase, area) {
  return disciplinasDo(concurso.id, cargo, fase, area).map((d) => ({
    nome: d.nome,
    topicos: d.topicos?.length ? d.topicos : SUGESTOES_OAB[d.nome] || [`${d.nome}: visão geral e questões`],
  }));
}

const campo = { width: '100%', minHeight: 40, padding: '6px 9px', borderRadius: 9, border: '1px solid var(--borda)', background: 'var(--card)', color: 'var(--txt)', font: 'inherit' };

export default function EditalVerticalizado({ ctx, concurso, cargo, fase, area }) {
  const faseObj = concurso.fases?.find((f) => f.id === fase);
  const ctxTitulo = [faseObj?.nome?.split(' –')[0], faseObj?.areas?.find((a) => a.id === area)?.nome].filter(Boolean).join(' – ');
  const { prefs, setPrefs, usuario } = ctx;
  const chave = chaveVert(concurso.id, fase, area);
  const vert = prefs.verticalizados?.[chave] || null;
  const [modo, setModo] = useState(null); // null | 'importar' | 'biblioteca' | 'compartilhar'
  const [biblioteca, setBiblioteca] = useState(null);
  const [busca, setBusca] = useState('');
  const [tituloComp, setTituloComp] = useState('');
  useEffect(() => {
    if (modo !== 'biblioteca') return;
    setBiblioteca(null);
    listarVerticalizados().then(setBiblioteca).catch((e) => { setBiblioteca([]); setStatus('Não foi possível carregar a biblioteca: ' + e.message); });
  }, [modo]);
  const [previa, setPrevia] = useState(null);
  const [texto, setTexto] = useState('');
  const [status, setStatus] = useState(null);
  const [confirmarApagar, setConfirmarApagar] = useState(false);

  const salvar = (v) => setPrefs({ verticalizados: { ...(prefs.verticalizados || {}), [chave]: v } });
  const apagar = () => {
    const n = { ...(prefs.verticalizados || {}) };
    delete n[chave];
    setPrefs({ verticalizados: n });
    setConfirmarApagar(false);
  };

  async function lerPdf(arquivo) {
    if (!arquivo) return;
    setStatus('Lendo o PDF…');
    try {
      const linhas = await textoDoPdf(arquivo);
      const r = lerVerticalizado(linhas);
      setPrevia(r);
      setStatus(r.length ? null : 'Não encontrei disciplinas e tópicos nesse arquivo. Tente colar o texto.');
    } catch (e) {
      setStatus('Não foi possível ler o PDF: ' + e.message);
    }
  }

  // ---------- ainda não tem ----------
  if (modo === 'biblioteca') {
    const t = busca.trim().toLowerCase();
    const lista = (biblioteca || []).filter((v) => !t || `${v.titulo} ${v.descricao || ''}`.toLowerCase().includes(t));
    return (
      <div>
        <input type="text" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="🔎 Procurar (ex.: OAB 2ª fase Constitucional, PC/AC Papiloscopista)…" aria-label="Procurar edital verticalizado" style={{ marginBottom: 10 }} />
        {status && <p className="aviso">{status}</p>}
        {!biblioteca && <p className="sub">Carregando…</p>}
        {biblioteca && !lista.length && <p className="sub">Nenhum edital verticalizado compartilhado {t ? 'com esse termo' : 'ainda'}.</p>}
        {lista.map((v) => (
          <div key={v.id} className="card" style={{ boxShadow: 'none' }}>
            <b>{v.titulo}</b>
            <div className="sub peq">{v.disciplinas.length} matérias · {v.disciplinas.reduce((a, d) => a + (d.topicos?.length || 0), 0)} tópicos{v.autor_nome ? ` · por ${v.autor_nome}` : ''}</div>
            {v.descricao && <p className="peq">{v.descricao}</p>}
            <div className="linha" style={{ marginTop: 6 }}>
              <button className="btn peq pri" onClick={() => { salvar({ origem: 'baixado', titulo: v.titulo, disciplinas: v.disciplinas, feitos: {} }); setModo(null); }}>Usar este</button>
              {(v.criado_por === usuario?.id || usuario?.admin) && (
                <button className="btn peq perigo" onClick={() => excluirVerticalizado(v.id).then(() => setBiblioteca((b) => b.filter((x) => x.id !== v.id)))}>Remover da biblioteca</button>
              )}
            </div>
          </div>
        ))}
        <button className="btn" onClick={() => setModo(null)}>Voltar</button>
      </div>
    );
  }

  if (modo === 'compartilhar' && vert) {
    return (
      <div>
        <p className="sub">Seu edital verticalizado ficará disponível para outros usuários baixarem (só a lista de matérias e tópicos; o seu progresso continua privado).</p>
        <label className="campo">Título
          <input type="text" value={tituloComp} onChange={(e) => setTituloComp(e.target.value)} />
        </label>
        {status && <p className="aviso">{status}</p>}
        <div className="linha" style={{ marginTop: 10 }}>
          <button className="btn pri" disabled={!tituloComp.trim()} onClick={async () => {
            try {
              await compartilharVerticalizado({ titulo: tituloComp.trim(), disciplinas: vert.disciplinas, autorNome: usuario?.nome?.split(' ')[0] });
              salvar({ ...vert, compartilhado: true });
              setStatus(null);
              setModo(null);
            } catch (e) {
              setStatus('Não foi possível compartilhar: ' + e.message);
            }
          }}>Compartilhar</button>
          <button className="btn" onClick={() => setModo(null)}>Cancelar</button>
        </div>
      </div>
    );
  }

  if (!vert && modo !== 'importar') {
    return (
      <div>
        <p className="sub">
          O edital verticalizado é a lista de tudo o que você precisa estudar, matéria por matéria, para marcar o que já foi visto. Ele também alimenta o seu cronograma.
        </p>
        <div className="escolha">
          <button className="card bloco-card" style={{ margin: 0 }} onClick={() => salvar({ origem: 'sugerido', disciplinas: sugerir(concurso, cargo, fase, area), feitos: {} })}>
            <h3>✨ Sugerir um edital verticalizado</h3>
            <p className="sub" style={{ margin: 0 }}>Montamos a partir das matérias e do conteúdo programático deste concurso{area ? ' (da sua área)' : ''}. Você pode trocar depois.</p>
          </button>
          <button className="card bloco-card" style={{ margin: 0 }} onClick={() => setModo('importar')}>
            <h3>📥 Importar um edital verticalizado pronto</h3>
            <p className="sub" style={{ margin: 0 }}>De outra plataforma ou feito por você: PDF ou texto com as matérias e os tópicos.</p>
          </button>
          <button className="card bloco-card" style={{ margin: 0 }} onClick={() => setModo('biblioteca')}>
            <h3>🌐 Baixar de outro usuário</h3>
            <p className="sub" style={{ margin: 0 }}>Editais verticalizados que outros usuários compartilharam na plataforma.</p>
          </button>
        </div>
      </div>
    );
  }

  // ---------- importar ----------
  if (modo === 'importar') {
    return (
      <div>
        <label className="campo">PDF do edital verticalizado
          <input type="file" accept="application/pdf" onChange={(e) => lerPdf(e.target.files[0])} style={{ display: 'block', marginTop: 6 }} />
        </label>
        <details style={{ marginTop: 10 }}>
          <summary className="sub">Ou cole o texto</summary>
          <textarea rows={8} style={{ ...campo, marginTop: 6 }} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={'DIREITO CIVIL\n1. Parte geral\n2. Obrigações\n...'} />
          <button className="btn peq" disabled={!texto.trim()} onClick={() => setPrevia(lerVerticalizado(texto.split('\n')))}>Ler texto</button>
        </details>
        {status && <p className="aviso" style={{ marginTop: 10 }}>{status}</p>}
        {previa && previa.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <p>Encontrei <b>{previa.length} matérias</b> e <b>{previa.reduce((s, d) => s + d.topicos.length, 0)} tópicos</b>:</p>
            <ul className="peq">{previa.map((d) => <li key={d.nome}>{d.nome} · {d.topicos.length} tópicos</li>)}</ul>
            <button className="btn pri" onClick={() => { salvar({ origem: 'importado', disciplinas: previa, feitos: {} }); setModo(null); setPrevia(null); }}>Usar este edital verticalizado</button>
          </div>
        )}
        <button className="btn" style={{ marginTop: 10 }} onClick={() => { setModo(null); setPrevia(null); }}>Cancelar</button>
      </div>
    );
  }

  // ---------- já tem ----------
  const feitos = vert.feitos || {};
  const total = vert.disciplinas.reduce((s, d) => s + d.topicos.length, 0);
  const ok = Object.keys(feitos).length;
  const marcar = (k) => {
    const n = { ...feitos };
    n[k] ? delete n[k] : (n[k] = 1);
    salvar({ ...vert, feitos: n });
  };
  return (
    <div>
      <p className="sub">
        {vert.origem === 'importado' ? 'Importado por você.' : vert.origem === 'baixado' ? `Baixado da biblioteca: ${vert.titulo}.` : 'Sugerido pela plataforma.'}{vert.compartilhado ? ' · ✓ compartilhado' : ''} Progresso: <b>{ok} de {total}</b> tópicos ({Math.round((ok / Math.max(1, total)) * 100)}%)
      </p>
      <div className="barra" aria-hidden="true"><i style={{ width: `${(ok / Math.max(1, total)) * 100}%` }} /></div>
      {vert.disciplinas.map((d) => {
        const feitosD = d.topicos.filter((_, i) => feitos[`${d.nome}#${i}`]).length;
        return (
          <details key={d.nome} style={{ borderTop: '1px solid var(--borda)', padding: '8px 0' }}>
            <summary>
              <b>{d.nome}</b> <span className="sub peq">· {feitosD}/{d.topicos.length} {feitosD === d.topicos.length ? '✓' : ''}</span>
            </summary>
            <ul style={{ listStyle: 'none', paddingLeft: 4, margin: '8px 0 0' }}>
              {d.topicos.map((t, i) => (
                <li key={i} style={{ margin: '4px 0' }}>
                  <label className="linha" style={{ gap: 8, alignItems: 'flex-start', flexWrap: 'nowrap' }}>
                    <input type="checkbox" checked={!!feitos[`${d.nome}#${i}`]} onChange={() => marcar(`${d.nome}#${i}`)} style={{ marginTop: 4 }} />
                    <span>{t}</span>
                  </label>
                </li>
              ))}
            </ul>
          </details>
        );
      })}
      <div className="linha" style={{ marginTop: 10 }}>
        <button className="btn peq" onClick={() => setModo('importar')}>📥 Importar outro</button>
        <button className="btn peq" onClick={() => setModo('biblioteca')}>🌐 Baixar de outro usuário</button>
        {!vert.compartilhado && vert.origem !== 'baixado' && (
          <button className="btn peq" onClick={() => { setTituloComp([concurso.sigla, ctxTitulo].filter(Boolean).join(' – ')); setModo('compartilhar'); }}>🔗 Compartilhar com outros usuários</button>
        )}
        <button className="btn peq" onClick={() => salvar({ origem: 'sugerido', disciplinas: sugerir(concurso, cargo, fase, area), feitos: vert.feitos || {} })}>✨ Refazer sugestão</button>
        {!confirmarApagar ? (
          <button className="btn peq perigo" onClick={() => setConfirmarApagar(true)}>Apagar</button>
        ) : (
          <span className="linha">
            <span className="peq">Apagar o edital verticalizado e o progresso?</span>
            <button className="btn peq perigo" onClick={apagar}>Sim</button>
            <button className="btn peq" onClick={() => setConfirmarApagar(false)}>Não</button>
          </span>
        )}
      </div>
    </div>
  );
}
