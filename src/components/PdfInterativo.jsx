import { useEffect, useMemo, useRef, useState } from 'react';
import { disciplinasDo } from '../lib/dados.js';
import { todosConcursos } from '../data/concursos.js';
import { excluirEstudo, lerEstudo, listarEstudos, salvarEstudo } from '../lib/remoto.js';
import { imprimir } from '../lib/materiais.js';
import exemploPenal from '../data/estudos/lei-penal-no-tempo.js';

// 📘 PDF interativo: texto de estudo por tópico, com caixas de lei seca, doutrina,
// jurisprudência, caso concreto, pegadinhas e perguntas de fixação.
const BASE = [exemploPenal];
const combina = (a, b) => {
  const x = norm(a);
  const y = norm(b);
  return x === y || (x.length > 6 && y.length > 6 && (x.includes(y) || y.includes(x)));
};
const norm = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export const CAIXAS = {
  lei: ['📜', 'Lei seca'],
  doutrina: ['📚', 'Doutrina'],
  jurisprudencia: ['⚖️', 'Jurisprudência'],
  caso: ['🔎', 'Caso concreto'],
  atencao: ['⚠️', 'Atenção'],
  dica: ['💡', 'Dica'],
  resumo: ['📝', 'Resumo'],
  pergunta: ['❓', 'Pergunta'],
};

export default function PdfInterativo({ ctx }) {
  const { prefs, setPrefs, concurso, cargo, fase, area } = ctx;
  const seguindo = (prefs.seguindo || []).map((id) => todosConcursos().find((c) => c.id === id)).filter(Boolean);
  const [cid, setCid] = useState(concurso?.id || seguindo[0]?.id || '');
  const conc = seguindo.find((c) => c.id === cid) || concurso;
  const pc = prefs.concursos?.[conc?.id] || {};
  const discs = conc ? disciplinasDo(conc.id, conc.id === concurso?.id ? cargo : pc.cargo, conc.id === concurso?.id ? fase : pc.fase, conc.id === concurso?.id ? area : pc.area) : [];
  const [remotos, setRemotos] = useState([]);
  const [erro, setErro] = useState(null);
  const [materia, setMateria] = useState(null);
  const [aberto, setAberto] = useState(null);
  const [gerar, setGerar] = useState(null);
  const [busca, setBusca] = useState('');
  const progresso = prefs.pdfs || {};

  const recarregar = () => listarEstudos().then(setRemotos).catch((e) => setErro(e.message));
  useEffect(() => {
    recarregar();
  }, []);

  const todos = useMemo(() => [...BASE, ...remotos], [remotos]);
  const porMateria = (m) => todos.filter((e) => combina(e.materia, m));
  const materias = [...new Set([...discs.map((d) => d.nome), ...todos.map((e) => e.materia).filter((m) => !discs.some((d) => combina(d.nome, m)))])];
  const matSel = materia || materias[0];

  if (aberto) {
    return (
      <Leitor
        estudo={aberto}
        progresso={progresso[aberto.id] || {}}
        salvarProgresso={(p) => setPrefs({ pdfs: { ...progresso, [aberto.id]: { ...(progresso[aberto.id] || {}), ...p, visto: new Date().toISOString() } } })}
        voltar={() => setAberto(null)}
        usuario={ctx.usuario}
        aoExcluir={() => { setAberto(null); recarregar(); }}
      />
    );
  }
  if (gerar) return <Gerar alvo={gerar} concurso={conc} voltar={() => setGerar(null)} aoSalvar={(e) => { setGerar(null); recarregar(); setAberto(e); }} />;

  const disc = discs.find((d) => norm(d.nome) === norm(matSel));
  const topicos = disc?.topicos?.length ? disc.topicos : [];
  const prontos = porMateria(matSel);
  const doTopico = (t) => prontos.filter((e) => norm(e.topico) === norm(t));
  const extras = prontos.filter((e) => !topicos.some((t) => norm(t) === norm(e.topico)));
  const abrir = async (e) => {
    try {
      setAberto(e.conteudo ? e : await lerEstudo(e.id));
    } catch (er) {
      setErro(er.message);
    }
  };
  const termo = norm(busca);
  const filtrar = (t) => !termo || norm(t).includes(termo);
  const recentes = Object.entries(progresso)
    .sort((a, b) => String(b[1].visto).localeCompare(String(a[1].visto)))
    .slice(0, 3)
    .map(([id, p]) => ({ ...todos.find((e) => e.id === id), p }))
    .filter((e) => e.id);

  const Linha = ({ t, e }) => {
    const p = e && progresso[e.id];
    return (
      <li>
        <span>
          {t}
          {p?.concluido && <b className="sobe peq"> · ✓ concluído</b>}
          {e && !p?.concluido && p?.lidas?.length > 0 && <span className="peq sub"> · {p.lidas.length} seções lidas</span>}
        </span>
        {e ? (
          <button className="btn peq" onClick={() => abrir(e)}>{p ? (p.concluido ? 'Rever' : 'Retomar') : 'Começar'}</button>
        ) : (
          <button className="btn peq" onClick={() => setGerar({ materia: matSel, topico: t })} title="Criar o PDF interativo deste tópico com o Claude">✨ Criar</button>
        )}
      </li>
    );
  };

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>📘 PDF interativo</h2>
      <p className="sub">Escolha a matéria e o tópico e clique em <b>Começar</b>: explicação, lei seca, doutrina, jurisprudência, casos concretos e perguntas de fixação.</p>
      {erro && <p className="aviso peq">⚠️ {erro}</p>}
      {recentes.length > 0 && (
        <div className="linha" style={{ marginBottom: 10 }}>
          <span className="peq sub">Últimos acessos:</span>
          {recentes.map((e) => <button key={e.id} className="btn peq" onClick={() => abrir(e)}>{e.topico} → {e.p.concluido ? 'Rever' : 'Retomar'}</button>)}
        </div>
      )}
      {seguindo.length > 1 && (
        <label className="campo" style={{ maxWidth: 420 }}>Concurso
          <select value={cid} onChange={(e) => { setCid(e.target.value); setMateria(null); }}>
            {seguindo.map((c) => <option key={c.id} value={c.id}>{c.sigla} – {c.nome}</option>)}
          </select>
        </label>
      )}
      <div className="pdf-layout">
        <nav className="card lista-disc" aria-label="Disciplinas">
          <b>Disciplinas</b>
          {materias.map((m) => {
            const n = porMateria(m).length;
            return (
              <button key={m} aria-current={norm(m) === norm(matSel)} onClick={() => setMateria(m)}>
                {m}
                <span className="peq sub">{n} {n === 1 ? 'PDF' : 'PDFs'}</span>
              </button>
            );
          })}
        </nav>
        <section className="card">
          <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="🔎 Digite para pesquisar" aria-label="Pesquisar tópico" style={{ width: '100%' }} />
          <ul className="lista-leis">
            {topicos.filter(filtrar).map((t) => <Linha key={t} t={t} e={doTopico(t).at(-1)} />)}
            {extras.filter((e) => filtrar(e.topico)).map((e) => <Linha key={e.id} t={e.topico} e={e} />)}
          </ul>
          {!topicos.length && !extras.length && <p className="sub peq">Esta matéria ainda não tem tópicos cadastrados. Crie um PDF interativo para qualquer tema abaixo.</p>}
          <form className="linha" style={{ marginTop: 10 }} onSubmit={(e) => { e.preventDefault(); const t = e.target.tema.value.trim(); if (t) setGerar({ materia: matSel, topico: t }); }}>
            <input name="tema" placeholder="Outro tema desta matéria" aria-label="Outro tema" style={{ flex: 1 }} />
            <button className="btn peq">✨ Criar PDF deste tema</button>
          </form>
        </section>
      </div>
    </div>
  );
}

// ---------- leitura ----------
function blocos(md) {
  // separa o texto em seções (##) e, dentro delas, em parágrafos/listas e caixas :::tipo
  const linhas = md.replace(/\r/g, '').split('\n');
  const secoes = [];
  let titulo = '';
  let atual = null;
  let caixa = null;
  for (const l of linhas) {
    if (caixa) {
      if (/^:::\s*$/.test(l)) {
        atual.itens.push(caixa);
        caixa = null;
      } else caixa.linhas.push(l);
      continue;
    }
    const h1 = l.match(/^#\s+(.*)/);
    const h2 = l.match(/^##\s+(.*)/);
    const cx = l.match(/^:::\s*(\w+)\s*(.*)$/);
    if (h1 && !titulo) titulo = h1[1];
    else if (h2) {
      atual = { titulo: h2[1], itens: [] };
      secoes.push(atual);
    } else {
      if (!atual) {
        atual = { titulo: 'Introdução', itens: [] };
        secoes.push(atual);
      }
      if (cx) caixa = { tipo: cx[1].toLowerCase(), titulo: cx[2], linhas: [] };
      else atual.itens.push(l);
    }
  }
  if (caixa) atual.itens.push(caixa);
  return { titulo, secoes: secoes.filter((s) => s.itens.some((i) => typeof i !== 'string' || i.trim())) };
}

const inline = (t) => {
  const partes = [];
  const re = /(\*\*(.+?)\*\*|\*(.+?)\*)/g;
  let i = 0;
  let m;
  while ((m = re.exec(t))) {
    if (m.index > i) partes.push(t.slice(i, m.index));
    partes.push(m[2] ? <b key={m.index}>{m[2]}</b> : <i key={m.index}>{m[3]}</i>);
    i = m.index + m[0].length;
  }
  partes.push(t.slice(i));
  return partes;
};

function Texto({ linhas }) {
  const out = [];
  let lista = null;
  linhas.forEach((l, k) => {
    const li = l.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)/);
    if (li) {
      (lista ||= []).push(<li key={k}>{inline(li[1])}</li>);
      return;
    }
    if (lista) {
      out.push(<ul key={`u${k}`}>{lista}</ul>);
      lista = null;
    }
    const h = l.match(/^###\s+(.*)/);
    if (h) out.push(<h4 key={k}>{inline(h[1])}</h4>);
    else if (l.trim()) out.push(<p key={k}>{inline(l)}</p>);
  });
  if (lista) out.push(<ul key="uf">{lista}</ul>);
  return out;
}

function Caixa({ c }) {
  const [ico, rot] = CAIXAS[c.tipo] || ['📌', c.tipo];
  if (c.tipo === 'pergunta') {
    const i = c.linhas.findIndex((l) => /^---\s*$/.test(l));
    const p = i >= 0 ? c.linhas.slice(0, i) : c.linhas;
    const r = i >= 0 ? c.linhas.slice(i + 1) : [];
    return (
      <details className="caixa caixa-pergunta">
        <summary>
          <b>{ico} </b>
          {inline(p.join(' ').trim())}
          <span className="peq sub"> (clique para ver a resposta)</span>
        </summary>
        <div className="resposta"><Texto linhas={r} /></div>
      </details>
    );
  }
  return (
    <aside className={`caixa caixa-${c.tipo}`}>
      <div className="caixa-tit">{ico} {rot}{c.titulo ? `: ${c.titulo}` : ''}</div>
      <Texto linhas={c.linhas} />
    </aside>
  );
}

function Leitor({ estudo, progresso, salvarProgresso, voltar, usuario, aoExcluir }) {
  const { titulo, secoes } = useMemo(() => blocos(estudo.conteudo), [estudo]);
  const [fonte, setFonte] = useState(1);
  const [conf, setConf] = useState(false);
  const corpo = useRef(null);
  const lidas = new Set(progresso.lidas || []);
  const pct = secoes.length ? Math.round((lidas.size / secoes.length) * 100) : 0;
  const marcar = (i) => {
    const n = new Set(lidas);
    n.has(i) ? n.delete(i) : n.add(i);
    salvarProgresso({ lidas: [...n], concluido: n.size === secoes.length || progresso.concluido });
  };
  useEffect(() => {
    salvarProgresso({});
    window.scrollTo(0, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const podeExcluir = !estudo.id.startsWith('base:') && (estudo.criado_por === usuario?.id || estudo.criado_por === 'local' || usuario?.admin);
  const baixar = () => imprimir(titulo || estudo.topico, `<style>.caixa{border-left:4px solid #1d3f9e;background:#f3f6fd;padding:8px 12px;margin:10px 0;border-radius:6px}.caixa-lei{border-color:#2e7d32;background:#eef7ef}.caixa-jurisprudencia{border-color:#6a1b9a;background:#f6eefa}.caixa-atencao{border-color:#c62828;background:#fdeeee}.caixa-caso{border-color:#ef6c00;background:#fff4e8}.caixa-tit{font-weight:700;margin-bottom:4px}details .resposta{display:block}.acoes-sec,.peq.sub{display:none}</style><h1>${titulo || estudo.topico}</h1>${corpo.current.innerHTML.replace(/<details/g, '<div').replace(/<\/details>/g, '</div>').replace(/<summary/g, '<div').replace(/<\/summary>/g, '</div>')}`);

  return (
    <div>
      <div className="linha entre" style={{ alignItems: 'center' }}>
        <button className="btn peq" onClick={voltar}>← PDF interativo</button>
        <div className="linha">
          <label className="peq" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="checkbox" checked={!!progresso.concluido} onChange={() => salvarProgresso({ concluido: !progresso.concluido })} style={{ width: 20, height: 20 }} /> Concluído
          </label>
          <button className="btn peq" onClick={() => setFonte(Math.max(0.85, fonte - 0.1))} aria-label="Diminuir letra">A−</button>
          <button className="btn peq" onClick={() => setFonte(Math.min(1.5, fonte + 0.1))} aria-label="Aumentar letra">A+</button>
          <button className="btn peq" onClick={baixar}>⬇️ Baixar PDF</button>
        </div>
      </div>
      <div className="barra" style={{ margin: '8px 0' }} aria-label={`${pct}% lido`}><i style={{ width: `${pct}%` }} /></div>
      <p className="peq sub" style={{ margin: 0 }}>{estudo.materia} · {pct}% lido{estudo.id.startsWith('base:') ? ' · conteúdo da plataforma' : ' · criado com o Claude por um usuário – confira as fontes'}</p>
      <div className="pdf-folha" style={{ fontSize: `${fonte}rem` }} ref={corpo}>
        <h1>{titulo || estudo.topico}</h1>
        <nav className="sumario-pdf" aria-label="Sumário">
          {secoes.map((s, i) => (
            <a key={i} href={`#sec-${i}`} onClick={(e) => { e.preventDefault(); document.getElementById(`sec-${i}`)?.scrollIntoView({ block: 'start' }); }}>
              {lidas.has(i) ? '✓' : '○'} {s.titulo}
            </a>
          ))}
        </nav>
        {secoes.map((s, i) => (
          <section key={i} id={`sec-${i}`} className="secao-pdf">
            <h2>{s.titulo}</h2>
            {(() => {
              const out = [];
              let buf = [];
              s.itens.forEach((it, k) => {
                if (typeof it === 'string') buf.push(it);
                else {
                  if (buf.length) out.push(<Texto key={`t${k}`} linhas={buf} />);
                  buf = [];
                  out.push(<Caixa key={k} c={it} />);
                }
              });
              if (buf.length) out.push(<Texto key="tf" linhas={buf} />);
              return out;
            })()}
            <div className="acoes-sec">
              <button className="praticar peq" aria-pressed={lidas.has(i)} onClick={() => marcar(i)}>{lidas.has(i) ? '✓ Seção lida' : '○ Marcar seção como lida'}</button>
            </div>
          </section>
        ))}
      </div>
      {podeExcluir && (
        <div style={{ marginTop: 12 }}>
          {conf ? (
            <span className="linha">
              <button className="btn perigo peq" onClick={() => excluirEstudo(estudo.id).then(aoExcluir)}>Sim, excluir este PDF</button>
              <button className="btn peq" onClick={() => setConf(false)}>Cancelar</button>
            </span>
          ) : (
            <button className="btn peq" onClick={() => setConf(true)}>🗑️ Excluir este PDF interativo</button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- criação com o Claude ----------
function Gerar({ alvo, concurso, voltar, aoSalvar }) {
  const [resposta, setResposta] = useState('');
  const [msg, setMsg] = useState(null);
  const pedido = `Você é um professor especialista em ${alvo.materia} para concursos públicos no Brasil${concurso ? ` (foco: ${concurso.nome}${concurso.banca ? `, banca ${concurso.banca}` : ''})` : ''}.
Escreva um material de estudo completo e didático sobre o tema "${alvo.topico}", no formato abaixo. Use a legislação VIGENTE (confira alterações recentes). NÃO invente números de processos, súmulas ou citações: se não tiver certeza, explique o entendimento sem citar número.

FORMATO (Markdown com caixas):
# Título
## 1. Seção (crie de 8 a 12 seções: visão geral, conceitos, regras e exceções, lei seca, doutrina, jurisprudência, casos concretos, pegadinhas, questões de fixação e resumo)
Texto explicativo com **negrito** nos pontos-chave e listas com "-".

Caixas especiais (abra com ":::tipo Título" e feche com ":::" sozinho na linha):
:::lei Código Penal, art. 2º
texto literal do artigo
:::
:::doutrina Nome do conceito
explicação da doutrina majoritária e das correntes
:::
:::jurisprudencia Súmula 711 do STF
entendimento do tribunal
:::
:::caso Caso 1 – título
situação prática resolvida passo a passo
:::
:::atencao Pegadinhas
lista de armadilhas de prova
:::
:::dica Macete
dica de memorização
:::
:::pergunta
pergunta de fixação
---
resposta comentada
:::
:::resumo
resumo final em até 6 linhas
:::

Inclua pelo menos: 3 caixas de lei, 2 de jurisprudência, 2 casos concretos e 4 perguntas de fixação. Responda APENAS com o material em Markdown.`;

  async function salvar() {
    setMsg(null);
    let md = resposta.trim();
    const m = md.match(/```(?:markdown|md)?\s*\n([\s\S]*?)```/);
    if (m) md = m[1].trim();
    const { secoes } = blocos(md);
    if (secoes.length < 2) return setMsg('✗ Não reconheci o material. Copie a resposta inteira do Claude.');
    try {
      const e = await salvarEstudo({ materia: alvo.materia, topico: alvo.topico, concurso_ref: concurso?.sigla || null, conteudo: md });
      aoSalvar(e);
    } catch (er) {
      setMsg('✗ ' + er.message);
    }
  }

  return (
    <div>
      <button className="btn peq" onClick={voltar}>← PDF interativo</button>
      <h2>✨ Criar PDF interativo</h2>
      <p><b>{alvo.materia}</b> · {alvo.topico}</p>
      <ol className="peq">
        <li>Clique em <b>Copiar pedido</b> e cole numa conversa com o Claude (sem custo).</li>
        <li>Copie a resposta inteira do Claude e cole no campo abaixo.</li>
        <li>Clique em <b>Salvar</b>. O PDF fica disponível para todos os usuários que estudam esta matéria.</li>
      </ol>
      <div className="linha">
        <button className="btn pri" onClick={() => navigator.clipboard?.writeText(pedido).then(() => setMsg('✓ Pedido copiado. Cole no Claude.'))}>📋 Copiar pedido</button>
        <a className="btn" href="https://claude.ai/new" target="_blank" rel="noreferrer">Abrir o Claude ↗</a>
      </div>
      <textarea rows="10" value={resposta} onChange={(e) => setResposta(e.target.value)} placeholder="Cole aqui a resposta do Claude" style={{ width: '100%', marginTop: 10 }} />
      {msg && <p className="aviso peq" role="status">{msg}</p>}
      <button className="btn pri" disabled={!resposta.trim()} onClick={salvar}>Salvar PDF interativo</button>
    </div>
  );
}
