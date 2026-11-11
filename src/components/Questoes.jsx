import { useMemo, useState } from 'react';
import { getConcurso, todosConcursos } from '../data/concursos.js';
import { diasDo, POR_UID, QUESTOES } from '../lib/dados.js';
import CartaoQuestao, { codigoDa, MARCADORES } from './CartaoQuestao.jsx';
import { fmtPct, resumo } from '../lib/stats.js';
import ImportarProva from './ImportarProva.jsx';
import { ProvasDiarias } from './Inicio.jsx';

const norm = (t) => (t || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
const ABAS = [
  ['dia', '📅 Prova do dia'],
  ['praticar', '🎯 Praticar'],
  ['importar', '📥 Importar prova'],
];

// Aba única de questões: Prova do dia, Praticar (filtro único do concurso ou do banco completo) e Importar prova.
export default function Questoes({ ctx, aba: abaPedida, filtro, aoTrocarAba, aoImportado, importar }) {
  const { concurso, cargo } = ctx;
  const temDias = diasDo(concurso.id, cargo).length > 0;
  const aba = abaPedida || (temDias ? 'dia' : 'praticar');
  const r = resumo(ctx.questoes, ctx.respostas);

  return (
    <div>
      <div className="linha entre" style={{ marginBottom: 8 }}>
        <h1 style={{ margin: 0 }}>📝 Questões</h1>
        <span className="sub peq">
          {r.resolvidas} resolvidas · {fmtPct(r.pct)} de acerto ·{' '}
          <button className="praticar peq" onClick={ctx.abrirPainel}>ver Painel</button>
        </span>
      </div>
      <div className="contador-q" role="status" aria-label="Contador de questões">
        <span>📚 Banco de questões: <b>{QUESTOES.length.toLocaleString('pt-BR')}</b></span>
        <span>🎯 Do meu concurso ({concurso.sigla}): <b>{ctx.questoes.length.toLocaleString('pt-BR')}</b></span>
        <span>✓ Resolvidas por mim: <b>{Object.keys(ctx.respostas).filter((u) => POR_UID[u]).length.toLocaleString('pt-BR')}</b></span>
        <span>⬜ Ainda não resolvidas: <b>{QUESTOES.filter((q) => !q.anulada && !ctx.respostas[q.uid]).length.toLocaleString('pt-BR')}</b></span>
      </div>
      <div className="abas" role="tablist" style={{ marginBottom: 12 }}>
        {ABAS.map(([id, rot]) => (
          <button key={id} role="tab" aria-selected={aba === id} onClick={() => aoTrocarAba(id)}>
            {rot}
          </button>
        ))}
      </div>
      {aba === 'dia' &&
        (temDias ? (
          <ProvasDiarias ctx={ctx} />
        ) : (
          <div className="card">
            <p className="sub">Este concurso ainda não tem provas do dia montadas. Use <b>🎯 Praticar</b>: ele traz as questões do seu concurso e do banco completo, inclusive as provas anteriores importadas.</p>
            <button className="btn pri" onClick={() => aoTrocarAba('praticar')}>🎯 Ir para Praticar</button>
          </div>
        ))}
      {aba === 'praticar' && <Praticar key={JSON.stringify(filtro || {})} ctx={ctx} filtroInicial={filtro} aoImportar={() => aoTrocarAba('importar')} />}
      {aba === 'importar' && (
        <ImportarProva
          concursos={todosConcursos()}
          concursoInicial={importar?.cid || concurso.id}
          faseInicial={importar?.fase ?? ctx.fase}
          areaInicial={importar?.area ?? ctx.area}
          aoCancelar={() => aoTrocarAba('praticar')}
          aoConcluir={aoImportado}
          material={importar?.material || null}
        />
      )}
    </div>
  );
}

function embaralhar(lista) {
  const a = [...lista];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------- filtro + lista de questões (formato padrão) ----------
const FILTRO_VAZIO = { escopo: 'meu', busca: '', materia: '', assunto: '', banca: '', orgao: '', ano: '', dificuldade: '', minhas: [], tipo: [], ineditas: 'todas', marc: [], comentadas: false, anotadas: false, anuladas: false };
const MINHAS = [['resolvidas', 'Resolvidas'], ['nao', 'Não resolvidas'], ['certas', 'Certas'], ['erradas', 'Erradas']];
const TIPOS = [['CE', 'Certo e errado'], ['ME', 'Múltipla escolha'], ['discursiva', 'Discursiva']];
const INEDITAS = [['todas', 'Todas as questões'], ['so', 'Apenas inéditas'], ['sem', 'Não incluir inéditas']];
const ORDENS = [['recentes', 'Mais recentes'], ['antigas', 'Mais antigas'], ['materia', 'Por disciplina'], ['aleatoria', 'Aleatória']];
const ehInedita = (q) => q.origem === 'inédita' || q.origem === 'inedita';
const orgaoDa = (q) => q.orgao_prova_original || q.concursoRef || getConcurso(q.concursos?.[0])?.sigla || '';

// filtros antigos ({ mostrar: 'nao' }) continuam valendo
function normalizarFiltro(f = {}) {
  const { mostrar, formato, origem, ...resto } = f;
  const n = { ...FILTRO_VAZIO, ...resto };
  if (mostrar && mostrar !== 'todas') n.minhas = [{ nao: 'nao', errei: 'erradas', acertei: 'certas' }[mostrar]].filter(Boolean);
  if (formato) n.tipo = [formato === 'CE' ? 'CE' : formato === 'discursiva' ? 'discursiva' : 'ME'];
  if (origem) n.ineditas = origem === 'inédita' ? 'so' : 'sem';
  return n;
}

function filtrar(fonte, f, respostas, prefs) {
  const termo = norm(f.busca.trim());
  return fonte.filter((q) => {
    const r = respostas[q.uid];
    if (q.anulada && !f.anuladas) return false;
    if (f.materia && q.materia !== f.materia) return false;
    if (f.assunto && q.assunto !== f.assunto) return false;
    if (f.banca && q.banca !== f.banca) return false;
    if (f.orgao && orgaoDa(q) !== f.orgao) return false;
    if (f.ano && String(q.ano) !== f.ano) return false;
    if (f.dificuldade && q.dificuldade !== f.dificuldade) return false;
    if (f.minhas.length && !f.minhas.some((m) => (m === 'resolvidas' ? !!r : m === 'nao' ? !r : m === 'certas' ? r && r[1] : r && !r[1]))) return false;
    if (f.tipo.length) {
      const t = q.formato === 'CE' ? 'CE' : q.formato === 'discursiva' ? 'discursiva' : 'ME';
      if (!f.tipo.includes(t)) return false;
    }
    if (f.ineditas === 'so' && !ehInedita(q)) return false;
    if (f.ineditas === 'sem' && ehInedita(q)) return false;
    if (f.marc.length && !f.marc.some((m) => prefs.marcadores?.[q.uid]?.includes(m))) return false;
    if (f.comentadas && !q.comentario) return false;
    if (f.anotadas && !prefs.notas?.[q.uid]) return false;
    if (termo && !norm(`${q.enunciado} ${q.materia} ${q.assunto} ${codigoDa(q)}`).includes(termo)) return false;
    return true;
  });
}

function ordenar(lista, ordem) {
  if (ordem === 'aleatoria') return embaralhar(lista);
  const a = [...lista];
  if (ordem === 'materia') return a.sort((x, y) => `${x.materia} ${x.assunto || ''}`.localeCompare(`${y.materia} ${y.assunto || ''}`, 'pt-BR'));
  const sinal = ordem === 'antigas' ? 1 : -1;
  return a.sort((x, y) => sinal * ((x.ano || 0) - (y.ano || 0)));
}

const Chip = ({ on, children, ...p }) => (
  <button type="button" className="chip" aria-pressed={!!on} {...p}>{on ? '✓ ' : ''}{children}</button>
);

function Praticar({ ctx, filtroInicial, aoImportar }) {
  const { concurso, respostas, abrirSessao, bancoVersao, prefs, setPrefs } = ctx;
  const guardados = prefs.filtrosQ || {};
  const [f, setF] = useState(() => normalizarFiltro(filtroInicial || { mostrar: 'nao' }));
  const [completo, setCompleto] = useState(() => window.innerWidth >= 700);
  const [ordem, setOrdem] = useState(guardados.ordem || 'recentes');
  const [porPagina, setPorPagina] = useState(guardados.porPagina || 20);
  const [pagina, setPagina] = useState(0);
  const [nSim, setNSim] = useState(20);
  const [nomeFiltro, setNomeFiltro] = useState(null);
  const [verSalvos, setVerSalvos] = useState(false);
  const fonteQ = prefs.fonteQ || 1;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const banco = useMemo(() => QUESTOES, [bancoVersao]);
  const fonteDe = (x) => (x.escopo === 'meu' ? ctx.questoes : banco);
  const fonte = fonteDe(f);
  // resultado: "fotografia" do filtro aplicado (a questão respondida continua na lista até filtrar de novo)
  const calcular = (x, o = ordem) => ordenar(filtrar(fonteDe(x), x, respostas, prefs), o).map((q) => q.uid);
  const [resultado, setResultado] = useState(() => calcular(f));
  const [aplicado, setAplicado] = useState(f);
  const pendente = JSON.stringify(f) !== JSON.stringify(aplicado);

  const aplicar = (x = f, o = ordem) => {
    setF(x);
    setAplicado(x);
    setResultado(calcular(x, o));
    setPagina(0);
    setPrefs({ filtrosQ: { ...guardados, ultimo: x, ordem: o, porPagina } });
  };
  const set = (k, v) => setF((x) => ({ ...x, [k]: v, ...(k === 'materia' || k === 'escopo' ? { assunto: '' } : {}), ...(k === 'escopo' ? { materia: '', banca: '', orgao: '', ano: '' } : {}) }));
  const alterna = (k, v) => set(k, f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v]);
  const opcoes = (pega, base = fonte) => [...new Set(base.map(pega).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'));

  const sel = (rot, k, ops, { todas = 'Todas', desativado = false } = {}) => (
    <label className="campo">
      {rot}
      <select value={f[k]} onChange={(e) => set(k, e.target.value)} disabled={desativado}>
        <option value="">{todas}</option>
        {ops.map((o) => (Array.isArray(o) ? <option key={o[0]} value={o[0]}>{o[1]}</option> : <option key={o}>{o}</option>))}
      </select>
    </label>
  );

  // etiquetas do filtro aplicado
  const etiquetas = [];
  const rot = (lista, v) => lista.find((x) => x[0] === v)?.[1] || v;
  if (aplicado.busca) etiquetas.push(['busca', `“${aplicado.busca}”`, '']);
  for (const k of ['materia', 'assunto', 'banca', 'orgao', 'ano', 'dificuldade']) if (aplicado[k]) etiquetas.push([k, aplicado[k], '']);
  aplicado.minhas.forEach((v) => etiquetas.push(['minhas', rot(MINHAS, v), v]));
  aplicado.tipo.forEach((v) => etiquetas.push(['tipo', rot(TIPOS, v), v]));
  aplicado.marc.forEach((v) => etiquetas.push(['marc', rot(MARCADORES, v), v]));
  if (aplicado.ineditas !== 'todas') etiquetas.push(['ineditas', rot(INEDITAS, aplicado.ineditas), 'todas']);
  if (aplicado.comentadas) etiquetas.push(['comentadas', 'Com comentário', false]);
  if (aplicado.anotadas) etiquetas.push(['anotadas', 'Com minha anotação', false]);
  if (aplicado.anuladas) etiquetas.push(['anuladas', 'Incluir anuladas', false]);
  const tirar = ([k, , v]) => {
    const x = { ...aplicado, [k]: Array.isArray(aplicado[k]) ? aplicado[k].filter((y) => y !== v) : v };
    if (k === 'materia') x.assunto = '';
    aplicar(x);
  };

  const titulo = [aplicado.escopo === 'meu' ? concurso.sigla : 'Banco completo', aplicado.materia, aplicado.assunto].filter(Boolean).join(' · ');
  const total = resultado.length;
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  const daPagina = resultado.slice(pagina * porPagina, (pagina + 1) * porPagina).map((u) => POR_UID[u]).filter(Boolean);
  const n = Math.max(1, Math.min(nSim, total));
  const irPagina = (p) => { setPagina(p); document.getElementById('lista-questoes')?.scrollIntoView({ block: 'start' }); };
  const erradas = fonte.filter((q) => respostas[q.uid] && !respostas[q.uid][1]).length;

  // sem questões: caminhos para achar provas na internet (sites oficiais das bancas) e importar
  const termoBusca = ['prova', 'gabarito', aplicado.banca || concurso.banca, aplicado.materia, aplicado.orgao, aplicado.ano].filter(Boolean).join(' ');
  const google = (t) => `https://www.google.com/search?q=${encodeURIComponent(t)}`;

  return (
    <div>
      <section className="card filtro-q">
        <div className="linha entre" style={{ marginBottom: 10 }}>
          <div className="linha">
            <button className="btn peq" aria-pressed={f.escopo === 'meu'} onClick={() => aplicar({ ...f, escopo: 'meu', materia: '', assunto: '', banca: '', orgao: '', ano: '' })} style={f.escopo === 'meu' ? { background: 'var(--pri)', color: 'var(--pri-txt)', borderColor: 'var(--pri)' } : {}}>
              Meu concurso: {concurso.sigla}
            </button>
            <button className="btn peq" aria-pressed={f.escopo === 'banco'} onClick={() => aplicar({ ...f, escopo: 'banco', materia: '', assunto: '', banca: '', orgao: '', ano: '' })} style={f.escopo === 'banco' ? { background: 'var(--pri)', color: 'var(--pri-txt)', borderColor: 'var(--pri)' } : {}}>
              🌐 Banco completo ({banco.filter((q) => !q.anulada).length})
            </button>
          </div>
          <div className="linha">
            {guardados.ultimo && <button className="praticar peq" onClick={() => aplicar(normalizarFiltro(guardados.ultimo))}>↺ Aplicar último filtro</button>}
            <button className="btn peq" aria-expanded={verSalvos} onClick={() => setVerSalvos(!verSalvos)}>Filtros salvos{guardados.salvos?.length ? ` (${guardados.salvos.length})` : ''}</button>
          </div>
        </div>
        {verSalvos && (
          <div className="q-painel" style={{ marginBottom: 10 }}>
            {!guardados.salvos?.length && <p className="sub peq" style={{ margin: 0 }}>Nenhum filtro salvo. Monte um filtro e clique em “Salvar filtro”.</p>}
            {(guardados.salvos || []).map((s, i) => (
              <div key={i} className="linha" style={{ marginBottom: 4 }}>
                <button className="praticar" onClick={() => { aplicar(normalizarFiltro(s.f)); setVerSalvos(false); }}>{s.nome}</button>
                <button className="btn peq" aria-label={`Excluir o filtro ${s.nome}`} onClick={() => setPrefs({ filtrosQ: { ...guardados, salvos: guardados.salvos.filter((_, j) => j !== i) } })}>🗑️</button>
              </div>
            ))}
          </div>
        )}

        <div className="filtros">
          <label className="campo" style={{ gridColumn: 'span 1' }}>Pesquisar<input type="text" value={f.busca} onChange={(e) => set('busca', e.target.value)} onKeyDown={(e) => e.key === 'Enter' && aplicar()} placeholder="🔎 Palavra ou código" /></label>
          {sel('Disciplina', 'materia', opcoes((q) => q.materia))}
          {sel('Assunto', 'assunto', opcoes((q) => q.assunto, fonte.filter((q) => q.materia === f.materia)), { todas: f.materia ? 'Todos' : 'Escolha a disciplina', desativado: !f.materia })}
          {completo && sel('Banca', 'banca', opcoes((q) => q.banca))}
          {completo && sel('Instituição', 'orgao', opcoes(orgaoDa))}
          {completo && sel('Ano', 'ano', opcoes((q) => q.ano).map(String).reverse(), { todas: 'Todos' })}
          {completo && sel('Dificuldade', 'dificuldade', [['fácil', 'Fácil'], ['média', 'Média'], ['difícil', 'Difícil']])}
        </div>

        <div className="grupos-chips">
          <div className="grupo-chips"><b>Minhas questões:</b>{MINHAS.map(([v, r]) => <Chip key={v} on={f.minhas.includes(v)} onClick={() => alterna('minhas', v)}>{r}</Chip>)}</div>
          {completo && (
            <>
              <div className="grupo-chips"><b>Questões:</b>{INEDITAS.map(([v, r]) => <Chip key={v} on={f.ineditas === v} onClick={() => set('ineditas', v)}>{r}</Chip>)}</div>
              <div className="grupo-chips"><b>Tipo de questão:</b>{TIPOS.map(([v, r]) => <Chip key={v} on={f.tipo.includes(v)} onClick={() => alterna('tipo', v)}>{r}</Chip>)}</div>
              <div className="grupo-chips"><b>Marcadores:</b>{MARCADORES.map(([v, r]) => <Chip key={v} on={f.marc.includes(v)} onClick={() => alterna('marc', v)}>{r}</Chip>)}</div>
              <div className="grupo-chips">
                <b>Comentários:</b>
                <Chip on={f.comentadas} onClick={() => set('comentadas', !f.comentadas)}>Com comentário</Chip>
                <Chip on={f.anotadas} onClick={() => set('anotadas', !f.anotadas)}>Com minha anotação</Chip>
              </div>
              <div className="grupo-chips"><b>Incluir questões:</b><Chip on={f.anuladas} onClick={() => set('anuladas', !f.anuladas)}>Anuladas</Chip></div>
            </>
          )}
        </div>
        <p style={{ textAlign: 'right', margin: '8px 0' }}>
          <button className="praticar peq" onClick={() => setCompleto(!completo)}>{completo ? '⊖ Filtro simplificado' : '⊕ Filtro completo'}</button>
        </p>

        <div className="linha entre">
          <div className="chips" aria-label="Filtros aplicados">
            {etiquetas.map((e, i) => (
              <span key={i} className="chip fixo">
                {e[1]} <button type="button" aria-label={`Tirar o filtro ${e[1]}`} onClick={() => tirar(e)}>✕</button>
              </span>
            ))}
          </div>
          <div className="linha">
            {erradas > 0 && <button className="praticar peq" onClick={() => aplicar({ ...FILTRO_VAZIO, escopo: f.escopo, minhas: ['erradas'] })}>🔁 Revisar meus erros ({erradas})</button>}
            <button className="praticar peq" onClick={() => aplicar({ ...FILTRO_VAZIO, escopo: f.escopo })}>Limpar filtro</button>
            {nomeFiltro == null ? (
              <button className="praticar peq" onClick={() => setNomeFiltro('')}>💾 Salvar filtro</button>
            ) : (
              <span className="linha" style={{ gap: 4 }}>
                <input type="text" value={nomeFiltro} onChange={(e) => setNomeFiltro(e.target.value)} placeholder="Nome do filtro" aria-label="Nome do filtro" style={{ width: 150, minHeight: 36 }} />
                <button className="btn peq" disabled={!nomeFiltro.trim()} onClick={() => { setPrefs({ filtrosQ: { ...guardados, salvos: [...(guardados.salvos || []), { nome: nomeFiltro.trim(), f }] } }); setNomeFiltro(null); }}>Salvar</button>
                <button className="btn peq" onClick={() => setNomeFiltro(null)} aria-label="Cancelar">✕</button>
              </span>
            )}
            <button className="btn pri" onClick={() => aplicar()}>Filtrar questões</button>
          </div>
        </div>
        {pendente && <p className="peq sub" role="status" style={{ textAlign: 'right', margin: '6px 0 0' }}>Você mudou o filtro: clique em “Filtrar questões” para atualizar a lista.</p>}
      </section>

      <section className="card barra-q" id="lista-questoes">
        <span><b>{total.toLocaleString('pt-BR')}</b> {total === 1 ? 'questão encontrada' : 'questões encontradas'}</span>
        <span className="linha" style={{ gap: 6 }}>
          <button className="praticar peq" disabled={!total} onClick={() => abrirSessao({ titulo: `Simulado · ${titulo}`, uids: embaralhar(resultado).slice(0, n), idx: 0, modo: 'simulado', minutos: Math.ceil(n * 3) })}>＋ Gerar simulado com</button>
          <input type="number" min="1" max={total || 1} value={nSim} onChange={(e) => setNSim(Math.max(1, +e.target.value || 1))} aria-label="Número de questões do simulado" style={{ width: 64, minHeight: 36 }} />
          <span className="sub peq">questões</span>
        </span>
        <button className="praticar peq" disabled={!total} onClick={() => abrirSessao({ titulo, uids: resultado, idx: 0, modo: 'estudo' })}>▶ Resolver uma por vez</button>
        <span className="linha" style={{ gap: 4 }}>
          <button className="btn peq" aria-label="Aumentar a letra" onClick={() => setPrefs({ fonteQ: Math.min(1.4, +(fonteQ + 0.1).toFixed(2)) })}>A+</button>
          <button className="btn peq" aria-label="Diminuir a letra" onClick={() => setPrefs({ fonteQ: Math.max(0.9, +(fonteQ - 0.1).toFixed(2)) })}>A−</button>
        </span>
        <label className="linha peq" style={{ gap: 6 }}>Questões por página
          <select value={porPagina} onChange={(e) => { setPorPagina(+e.target.value); setPagina(0); }} style={{ width: 'auto' }}>{[5, 10, 20, 50].map((x) => <option key={x}>{x}</option>)}</select>
        </label>
        <select aria-label="Ordem das questões" value={ordem} onChange={(e) => { setOrdem(e.target.value); aplicar(aplicado, e.target.value); }} style={{ width: 'auto' }}>
          {ORDENS.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
        </select>
      </section>

      {!total && (
        <section className="card">
          <h2 style={{ marginTop: 0 }}>Nenhuma questão com esse filtro</h2>
          <ul>
            <li>Tire algum filtro (por exemplo “Não resolvidas”) ou clique em <b>Limpar filtro</b>.</li>
            {aplicado.escopo === 'meu' && <li><button className="praticar" onClick={() => aplicar({ ...aplicado, escopo: 'banco', materia: '', assunto: '', banca: '', orgao: '', ano: '' })}>Procurar no 🌐 Banco completo</button> (questões de todos os concursos da plataforma).</li>}
          </ul>
          <h3>🌐 Buscar provas na internet</h3>
          <p className="sub">As bancas publicam as provas anteriores e os gabaritos em PDF. Abra a busca, baixe a prova e o gabarito e traga para cá em <b>📥 Importar prova</b>: as questões entram no banco já neste formato.</p>
          <div className="linha">
            <a className="btn" href={google(termoBusca + ' filetype:pdf')} target="_blank" rel="noreferrer">🔎 Buscar provas em PDF ↗</a>
            <a className="btn" href={google(`${aplicado.banca || concurso.banca || 'banca'} provas anteriores gabaritos site oficial`)} target="_blank" rel="noreferrer">🏛️ Site da banca ↗</a>
            <button className="btn pri" onClick={aoImportar}>📥 Importar prova</button>
          </div>
          <p className="peq sub">Busca sugerida: “{termoBusca}”.</p>
        </section>
      )}

      <div style={{ fontSize: `${fonteQ}rem` }}>
        {daPagina.map((q, i) => (
          <CartaoQuestao
            key={q.uid}
            q={q}
            numero={pagina * porPagina + i + 1}
            resp={respostas[q.uid]}
            respostas={respostas}
            aoResponder={(letra, seg) => ctx.responder(q.uid, letra, seg)}
            nota={prefs.notas?.[q.uid]}
            aoAnotar={(t) => ctx.anotar(q.uid, t)}
            marcadores={prefs.marcadores?.[q.uid] || []}
            aoMarcador={(k) => ctx.marcarQuestao(q.uid, k)}
          />
        ))}
      </div>

      {paginas > 1 && (
        <nav className="linha paginas" aria-label="Páginas de questões">
          <button className="btn" disabled={pagina === 0} onClick={() => irPagina(pagina - 1)}>← Anterior</button>
          <span>Página <b>{pagina + 1}</b> de {paginas}</span>
          <button className="btn pri" disabled={pagina >= paginas - 1} onClick={() => irPagina(pagina + 1)}>Próxima →</button>
        </nav>
      )}
    </div>
  );
}
