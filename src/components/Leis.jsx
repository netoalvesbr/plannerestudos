import { useEffect, useMemo, useRef, useState } from 'react';
import { getLei, leisPorMateria } from '../data/leis.js';
import { lerLeiHtml, separarNotas } from '../lib/leiParser.js';
import { anotacoesDaLei, excluirAnotacao, salvarAnotacoes } from '../lib/remoto.js';

// ⚖️ Leis: texto oficial do Planalto, artigo por artigo, com jurisprudência/doutrina ligada a cada artigo.
const cacheLeis = new Map();
async function carregarLei(lei) {
  if (cacheLeis.has(lei.id)) return cacheLeis.get(lei.id);
  const r = await fetch(`/api/lei?url=${encodeURIComponent(lei.url)}`);
  if (!r.ok) {
    let msg = `Erro ${r.status}`;
    try {
      msg = (await r.json()).erro || msg;
    } catch {
      /* resposta sem JSON */
    }
    throw new Error(msg);
  }
  const doc = lerLeiHtml(await r.text());
  if (!doc.itens.some((i) => i.tipo === 'artigo')) throw new Error('Não consegui separar os artigos desta lei. Abra no site do Planalto pelo link abaixo.');
  cacheLeis.set(lei.id, doc);
  return doc;
}

export const TIPOS_ANOTACAO = {
  jurisprudencia: '⚖️ Jurisprudência',
  sumula: '📌 Súmula',
  julgado: '🏛️ Julgado / informativo',
  doutrina: '📚 Doutrina',
  nota: '💡 Dica de prova',
};

export default function Leis({ ctx }) {
  const { prefs, setPrefs } = ctx;
  const estado = prefs.leis || {};
  const [aberta, setAberta] = useState(null); // { id, art }
  const [busca, setBusca] = useState('');
  const grupos = leisPorMateria(busca);
  const recentes = (estado.recentes || []).map((r) => ({ ...r, lei: getLei(r.id) })).filter((r) => r.lei);
  const [fechados, setFechados] = useState({});

  const abrir = (id, art) => {
    setAberta({ id, art });
    setPrefs({ leis: { ...estado, recentes: [{ id, art: art || null }, ...(estado.recentes || []).filter((r) => r.id !== id)].slice(0, 6) } });
    window.scrollTo(0, 0);
  };

  if (aberta) return <LeitorLei ctx={ctx} lei={getLei(aberta.id)} artInicial={aberta.art} voltar={() => setAberta(null)} />;

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>⚖️ Leis</h2>
      <p className="sub">Texto oficial e atualizado, direto do site do Planalto (sem os trechos revogados). Navegue artigo por artigo e veja jurisprudência, súmulas e doutrina de cada artigo.</p>
      {recentes.length > 0 && (
        <section className="card">
          <h3 style={{ marginTop: 0 }}>Abertos recentemente</h3>
          <div className="linha">
            {recentes.map((r) => (
              <button key={r.id} className="btn peq" onClick={() => abrir(r.id, r.art)}>
                {r.lei.curto || r.lei.nome.split(' – ')[0]}{r.art ? ` · ${r.art.replace('art', 'art. ')}` : ''} → Retomar
              </button>
            ))}
          </div>
        </section>
      )}
      <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="🔎 Procurar lei (ex.: drogas, 8.112, CPP)" aria-label="Procurar lei" style={{ width: '100%', marginBottom: 10 }} />
      {grupos.map(([materia, leis]) => {
        const fechado = fechados[materia] && !busca;
        return (
          <section key={materia} className="card grupo-leis">
            <button className="cab-grupo" aria-expanded={!fechado} onClick={() => setFechados({ ...fechados, [materia]: !fechados[materia] })}>
              <b>{materia}</b> <span className="sub peq">{leis.length} {leis.length === 1 ? 'lei' : 'leis'} {fechado ? '▸' : '▾'}</span>
            </button>
            {!fechado && (
              <ul className="lista-leis">
                {leis.map((l) => {
                  const lidos = (estado.lidos?.[l.id] || []).length;
                  return (
                    <li key={l.id}>
                      <span>Lei seca – {l.nome}{lidos > 0 && <span className="peq sub"> · ✓ {lidos} artigos lidos</span>}</span>
                      <button className="btn peq" onClick={() => abrir(l.id, estado.ultimo?.[l.id])}>{estado.ultimo?.[l.id] ? 'Retomar' : 'Começar'}</button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
      {!grupos.length && <p className="sub">Nenhuma lei encontrada. Use 💡 Sugestões para pedir a inclusão de uma lei.</p>}
    </div>
  );
}

function LeitorLei({ ctx, lei, artInicial, voltar }) {
  const { prefs, setPrefs, usuario } = ctx;
  const estado = prefs.leis || {};
  const [doc, setDoc] = useState(null);
  const [erro, setErro] = useState(null);
  const [anot, setAnot] = useState([]);
  const [erroAnot, setErroAnot] = useState(null);
  const [indice, setIndice] = useState(false);
  const [ir, setIr] = useState('');
  const [notas, setNotas] = useState(false);
  const [aberto, setAberto] = useState(null); // artigo com o painel de jurisprudência aberto
  const [filtro, setFiltro] = useState('');
  const [fonte, setFonte] = useState(estado.fonte || 1);
  const topo = useRef(null);

  useEffect(() => {
    let vivo = true;
    carregarLei(lei)
      .then((d) => vivo && setDoc(d))
      .catch((e) => vivo && setErro(e.message));
    anotacoesDaLei(lei.id)
      .then((a) => vivo && setAnot(a))
      .catch((e) => vivo && setErroAnot(e.message));
    return () => {
      vivo = false;
    };
  }, [lei]);

  // vai para o artigo em que parou
  useEffect(() => {
    if (doc && artInicial) setTimeout(() => document.getElementById(`a-${artInicial}`)?.scrollIntoView({ block: 'start' }), 50);
  }, [doc, artInicial]);

  const lidos = new Set(estado.lidos?.[lei.id] || []);
  const marcarLido = (id) => {
    const n = new Set(lidos);
    n.has(id) ? n.delete(id) : n.add(id);
    setPrefs({ leis: { ...estado, lidos: { ...(estado.lidos || {}), [lei.id]: [...n] }, ultimo: { ...(estado.ultimo || {}), [lei.id]: id } } });
  };
  const porArt = useMemo(() => {
    const m = {};
    for (const a of anot) (m[a.artigo] ||= []).push(a);
    return m;
  }, [anot]);

  const artigos = doc ? doc.itens.filter((i) => i.tipo === 'artigo') : [];
  const termo = filtro.trim().toLowerCase();
  const visiveis = doc ? doc.itens.filter((i) => !termo || (i.tipo === 'artigo' && `${i.rotulo} ${i.rubrica || ''} ${i.linhas.join(' ')}`.toLowerCase().includes(termo))) : [];

  function irPara(e) {
    e.preventDefault();
    const n = ir.replace(/\D+/g, ' ').trim().split(' ')[0];
    const suf = (ir.match(/\d\s*-\s*([a-z])/i) || [])[1];
    const id = `art${n}${suf ? '-' + suf.toLowerCase() : ''}`;
    const el = document.getElementById(`a-${id}`);
    if (el) {
      setFiltro('');
      el.scrollIntoView({ block: 'start' });
      setPrefs({ leis: { ...estado, ultimo: { ...(estado.ultimo || {}), [lei.id]: id } } });
    } else setErro(`Não encontrei o art. ${ir} nesta lei.`);
  }
  const mudarFonte = (d) => {
    const f = Math.min(1.5, Math.max(0.85, +(fonte + d).toFixed(2)));
    setFonte(f);
    setPrefs({ leis: { ...estado, fonte: f } });
  };

  const cabecalhos = doc ? doc.itens.filter((i) => i.tipo === 'cabecalho' && i.nivel <= 3) : [];
  const pct = artigos.length ? Math.round((artigos.filter((a) => lidos.has(a.id)).length / artigos.length) * 100) : 0;

  return (
    <div ref={topo}>
      <div className="linha entre" style={{ alignItems: 'center' }}>
        <button className="btn peq" onClick={voltar}>← Leis</button>
        <span className="peq sub">{pct}% lido · {lidos.size} de {artigos.length} artigos</span>
      </div>
      <h2 style={{ marginBottom: 2 }}>Lei seca – {lei.nome}</h2>
      {doc?.ementa && <p className="sub peq" style={{ marginTop: 0 }}>{doc.ementa}</p>}
      <p className="peq sub" style={{ marginTop: 0 }}>
        Fonte oficial: <a href={lei.url} target="_blank" rel="noreferrer">Planalto ↗</a> · texto compilado, sem os trechos revogados.
      </p>

      <div className="barra-lei">
        <form onSubmit={irPara} className="linha" style={{ gap: 6 }}>
          <input value={ir} onChange={(e) => setIr(e.target.value)} placeholder="Ir para art. (ex.: 5)" aria-label="Ir para o artigo" style={{ width: 150 }} inputMode="text" />
          <button className="btn peq">Ir</button>
        </form>
        <input type="search" value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="🔎 Procurar palavra na lei" aria-label="Procurar palavra na lei" style={{ flex: 1, minWidth: 160 }} />
        <button className="btn peq" aria-expanded={indice} onClick={() => setIndice(!indice)}>☰ Índice</button>
        <button className="btn peq" aria-pressed={notas} onClick={() => setNotas(!notas)} title="Mostrar ou esconder as notas de alteração (Redação dada pela Lei...)">{notas ? '✓ ' : ''}Notas</button>
        <button className="btn peq" onClick={() => mudarFonte(-0.1)} aria-label="Diminuir letra">A−</button>
        <button className="btn peq" onClick={() => mudarFonte(0.1)} aria-label="Aumentar letra">A+</button>
      </div>

      {indice && cabecalhos.length > 0 && (
        <nav className="card indice-lei" aria-label="Índice da lei">
          {cabecalhos.map((c, i) => (
            <button key={i} className="link" style={{ paddingLeft: Math.max(0, c.nivel - 1) * 14 }} onClick={() => { setIndice(false); setFiltro(''); document.getElementById(`c-${doc.itens.indexOf(c)}`)?.scrollIntoView({ block: 'start' }); }}>
              {separarNotas(c.texto).texto}{c.nome ? ` – ${c.nome}` : ''}
            </button>
          ))}
        </nav>
      )}

      {erroAnot && <p className="aviso peq">⚠️ {erroAnot}</p>}
      {erro && !doc && (
        <div className="aviso" role="alert">
          ✗ Não foi possível carregar a lei: {erro}
          <div className="linha" style={{ marginTop: 6 }}>
            <a className="btn peq" href={lei.url} target="_blank" rel="noreferrer">Abrir no site do Planalto ↗</a>
          </div>
        </div>
      )}
      {erro && doc && <p className="aviso" role="alert" onClick={() => setErro(null)}>{erro}</p>}
      {!doc && !erro && <p className="sub">Buscando o texto oficial no site do Planalto…</p>}
      {termo && <p className="sub peq">{visiveis.length} artigos com “{filtro}”.</p>}

      <div className="texto-lei" style={{ fontSize: `${fonte}rem` }}>
        {visiveis.map((it, i) =>
          it.tipo === 'cabecalho' ? (
            <h3 key={`c${i}`} id={`c-${doc.itens.indexOf(it)}`} className={`cab-lei n${it.nivel}`}>
              {separarNotas(it.texto).texto}
              {it.nome && <span>{it.nome}</span>}
            </h3>
          ) : (
            <Artigo
              key={it.id}
              lei={lei}
              art={it}
              notas={notas}
              lido={lidos.has(it.id)}
              marcar={() => marcarLido(it.id)}
              anotacoes={porArt[it.id] || []}
              aberto={aberto === it.id}
              alternar={() => setAberto(aberto === it.id ? null : it.id)}
              usuario={usuario}
              aoMudar={setAnot}
              termo={termo}
            />
          ),
        )}
      </div>
      {doc && (
        <p className="peq sub" style={{ marginTop: 16 }}>
          Texto carregado do Planalto. Em caso de dúvida, confira sempre a <a href={lei.url} target="_blank" rel="noreferrer">publicação oficial</a>.
        </p>
      )}
    </div>
  );
}

const realce = (txt, termo) => {
  if (!termo) return txt;
  const i = txt.toLowerCase().indexOf(termo);
  if (i < 0) return txt;
  return (
    <>
      {txt.slice(0, i)}
      <mark>{txt.slice(i, i + termo.length)}</mark>
      {txt.slice(i + termo.length)}
    </>
  );
};

function Linha({ texto, notas, termo, primeira, rotulo }) {
  if (texto.startsWith('#')) return <p className="rubrica-lei">{texto.slice(1)}</p>;
  const { texto: t, notas: ns } = separarNotas(texto);
  const recuo = /^([IVXLC]+\s*[-–]|[a-z]\)|\d+\s*[.)–-])/.test(t) ? (/^[a-z]\)/.test(t) ? 2 : /^\d/.test(t) ? 3 : 1) : 0;
  const m = t.match(/^(§\s*\d+[º°]?(?:-[A-Z])?\.?|Par[áa]grafo [úu]nico\.?)\s*/);
  return (
    <p className={`linha-lei r${recuo}`}>
      {primeira && <b className="rot-art">{rotulo} </b>}
      {m ? (
        <>
          <b>{m[1]}</b> {realce(t.slice(m[0].length), termo)}
        </>
      ) : (
        realce(t, termo)
      )}
      {notas && ns.length > 0 && <span className="nota-lei"> {ns.join(' ')}</span>}
    </p>
  );
}

function Artigo({ lei, art, notas, lido, marcar, anotacoes, aberto, alternar, usuario, aoMudar, termo }) {
  const n = anotacoes.length;
  return (
    <article id={`a-${art.id}`} className={`artigo-lei${lido ? ' lido' : ''}`}>
      {art.rubrica && <p className="rubrica-lei">{art.rubrica}</p>}
      {art.linhas.map((l, i) => (
        <Linha key={i} texto={l} notas={notas} termo={termo} primeira={i === 0} rotulo={art.rotulo} />
      ))}
      <div className="acoes-art">
        <button className="praticar peq" aria-pressed={lido} onClick={marcar}>{lido ? '✓ Lido' : '○ Marcar como lido'}</button>
        <button className="praticar peq" aria-expanded={aberto} onClick={alternar}>⚖️ Jurisprudência e doutrina{n ? ` (${n})` : ''}</button>
      </div>
      {aberto && <PainelArtigo lei={lei} art={art} anotacoes={anotacoes} usuario={usuario} aoMudar={aoMudar} />}
    </article>
  );
}

function PainelArtigo({ lei, art, anotacoes, usuario, aoMudar }) {
  const [form, setForm] = useState(false);
  const [novo, setNovo] = useState({ tipo: 'jurisprudencia', titulo: '', texto: '', fonte: '', url: '' });
  const [msg, setMsg] = useState(null);
  const [colar, setColar] = useState(false);
  const [resposta, setResposta] = useState('');
  const numero = art.rotulo.replace('Art. ', 'art. ');
  const busca = encodeURIComponent(`"${numero}" ${lei.curto || lei.nome.split(' – ')[0]}`);

  async function salvar(lista) {
    setMsg(null);
    try {
      const salvas = await salvarAnotacoes(lista.map((a) => ({ ...a, lei: lei.id, artigo: art.id })));
      aoMudar((v) => [...v, ...salvas]);
      setForm(false);
      setColar(false);
      setResposta('');
      setNovo({ tipo: 'jurisprudencia', titulo: '', texto: '', fonte: '', url: '' });
      setMsg(`✓ ${salvas.length} ${salvas.length === 1 ? 'item salvo' : 'itens salvos'} neste artigo, para todos os usuários.`);
    } catch (e) {
      setMsg('✗ ' + e.message);
    }
  }
  async function excluir(id) {
    try {
      await excluirAnotacao(id);
      aoMudar((v) => v.filter((a) => a.id !== id));
    } catch (e) {
      setMsg('✗ ' + e.message);
    }
  }
  const pedido = `Você é professor de ${lei.materia} para concursos. Sobre o ${numero} da ${lei.nome}, cujo texto é:\n\n"${art.linhas.filter((l) => !l.startsWith('#')).join('\n')}"\n\nListe de 3 a 6 itens REAIS e verificáveis, com a jurisprudência e a doutrina mais cobradas em prova sobre esse artigo: súmulas (com número e tribunal), teses de repercussão geral/repetitivos e julgados importantes (com número do processo). Não invente números: se não tiver certeza, não inclua.\nResponda APENAS com um bloco JSON:\n\`\`\`json\n[{"tipo":"sumula|jurisprudencia|julgado|doutrina|nota","titulo":"Súmula Vinculante 11 (STF)","texto":"resumo do entendimento em até 4 linhas","fonte":"STF, Súmula Vinculante 11"}]\n\`\`\``;
  function importar() {
    try {
      const t = resposta.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1] || resposta.slice(resposta.indexOf('['), resposta.lastIndexOf(']') + 1);
      const lista = JSON.parse(t);
      if (!Array.isArray(lista) || !lista.length) throw new Error();
      salvar(lista.filter((a) => a.texto).map((a) => ({ tipo: TIPOS_ANOTACAO[a.tipo] ? a.tipo : 'jurisprudencia', titulo: a.titulo || null, texto: a.texto, fonte: a.fonte ? `${a.fonte} (sugerido pelo Claude – confira)` : 'Sugerido pelo Claude – confira', url: null })));
    } catch {
      setMsg('✗ Não entendi a resposta. Copie a resposta inteira do Claude, com o bloco JSON.');
    }
  }

  return (
    <div className="painel-art">
      {art.stf && (
        <a className="link-stf" href={art.stf} target="_blank" rel="noreferrer">
          🏛️ <b>A Constituição e o Supremo</b> – decisões do STF sobre o {numero} (site oficial do STF) ↗
        </a>
      )}
      <div className="linha peq" style={{ margin: '6px 0' }}>
        <a href={`https://jurisprudencia.stf.jus.br/pages/search?base=acordaos&queryString=${busca}`} target="_blank" rel="noreferrer">Pesquisar no STF ↗</a>
        <a href={`https://scon.stj.jus.br/SCON/pesquisar.jsp?livre=${busca}`} target="_blank" rel="noreferrer">Pesquisar no STJ ↗</a>
      </div>
      {anotacoes.length === 0 && <p className="peq sub">Ainda não há jurisprudência ou doutrina cadastrada neste artigo. Seja o primeiro a adicionar.</p>}
      {anotacoes.map((a) => (
        <div key={a.id} className={`anot anot-${a.tipo}`}>
          <div className="peq"><b>{TIPOS_ANOTACAO[a.tipo] || a.tipo}</b>{a.titulo ? ` · ${a.titulo}` : ''}</div>
          <div>{a.texto}</div>
          {(a.fonte || a.url) && (
            <div className="peq sub">
              {a.fonte}
              {a.url && (
                <>
                  {' '}
                  <a href={a.url} target="_blank" rel="noreferrer">abrir ↗</a>
                </>
              )}
            </div>
          )}
          {(a.criado_por === usuario?.id || a.criado_por === 'local' || usuario?.admin) && (
            <button className="link peq" onClick={() => excluir(a.id)}>Excluir</button>
          )}
        </div>
      ))}
      {msg && <p className="peq" role="status">{msg}</p>}
      <div className="linha" style={{ marginTop: 6 }}>
        <button className="btn peq" onClick={() => { setForm(!form); setColar(false); }}>+ Adicionar</button>
        <button className="btn peq" onClick={() => { setColar(!colar); setForm(false); }}>✨ Sugerir com o Claude</button>
      </div>
      {form && (
        <form className="form-anot" onSubmit={(e) => { e.preventDefault(); if (novo.texto.trim()) salvar([{ ...novo, titulo: novo.titulo || null, fonte: novo.fonte || null, url: novo.url || null }]); }}>
          <label className="campo">Tipo
            <select value={novo.tipo} onChange={(e) => setNovo({ ...novo, tipo: e.target.value })}>
              {Object.entries(TIPOS_ANOTACAO).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="campo">Título (ex.: Súmula 711 do STF)<input value={novo.titulo} onChange={(e) => setNovo({ ...novo, titulo: e.target.value })} /></label>
          <label className="campo">Texto / entendimento *<textarea rows="3" required value={novo.texto} onChange={(e) => setNovo({ ...novo, texto: e.target.value })} /></label>
          <label className="campo">Fonte (tribunal, processo, autor)<input value={novo.fonte} onChange={(e) => setNovo({ ...novo, fonte: e.target.value })} /></label>
          <label className="campo">Link (opcional)<input type="url" value={novo.url} onChange={(e) => setNovo({ ...novo, url: e.target.value })} /></label>
          <button className="btn pri peq">Salvar neste artigo</button>
        </form>
      )}
      {colar && (
        <div className="form-anot">
          <p className="peq">1. Copie o pedido e cole numa conversa com o Claude. 2. Cole a resposta abaixo. Confira cada item antes de salvar: ele aparece para todos os usuários.</p>
          <div className="linha">
            <button className="btn peq" onClick={() => navigator.clipboard?.writeText(pedido).then(() => setMsg('✓ Pedido copiado. Cole no Claude.'))}>📋 Copiar pedido</button>
            <a className="btn peq" href="https://claude.ai/new" target="_blank" rel="noreferrer">Abrir o Claude ↗</a>
          </div>
          <textarea rows="4" value={resposta} onChange={(e) => setResposta(e.target.value)} placeholder="Cole aqui a resposta do Claude" style={{ width: '100%', marginTop: 6 }} />
          <button className="btn pri peq" disabled={!resposta.trim()} onClick={importar}>Salvar sugestões</button>
        </div>
      )}
    </div>
  );
}
