import { useMemo, useState } from 'react';
import { getConcurso, todosConcursos } from '../data/concursos.js';
import { diasDo, QUESTOES } from '../lib/dados.js';
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
      {aba === 'praticar' && <Praticar key={JSON.stringify(filtro || {})} ctx={ctx} filtroInicial={filtro} />}
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

function Praticar({ ctx, filtroInicial }) {
  const { concurso, respostas, abrirSessao, bancoVersao } = ctx;
  const [f, setF] = useState({
    escopo: 'meu',
    busca: '',
    materia: '',
    assunto: '',
    banca: '',
    ano: '',
    formato: '',
    dificuldade: '',
    origem: '',
    mostrar: 'nao',
    ...(filtroInicial || {}),
  });
  const [nSim, setNSim] = useState(20);
  const [verLista, setVerLista] = useState(false);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v, ...(k === 'materia' || k === 'escopo' ? { assunto: '' } : {}), ...(k === 'escopo' ? { materia: '' } : {}) }));

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const banco = useMemo(() => QUESTOES.filter((q) => !q.anulada), [bancoVersao]);
  const fonte = f.escopo === 'meu' ? ctx.questoes : banco;
  const opcoes = (campo, base = fonte) => [...new Set(base.map((q) => q[campo]).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
  const termo = norm(f.busca.trim());

  const lista = fonte.filter((q) => {
    const r = respostas[q.uid];
    if (f.materia && q.materia !== f.materia) return false;
    if (f.assunto && q.assunto !== f.assunto) return false;
    if (f.banca && q.banca !== f.banca) return false;
    if (f.ano && String(q.ano) !== f.ano) return false;
    if (f.formato && (q.formato || 'A-E') !== f.formato) return false;
    if (f.dificuldade && q.dificuldade !== f.dificuldade) return false;
    if (f.origem && q.origem !== f.origem) return false;
    if (f.mostrar === 'nao' && r) return false;
    if (f.mostrar === 'errei' && !(r && !r[1])) return false;
    if (f.mostrar === 'acertei' && !(r && r[1])) return false;
    if (termo && !norm(`${q.enunciado} ${q.materia} ${q.assunto}`).includes(termo)) return false;
    return true;
  });
  const erradas = fonte.filter((q) => respostas[q.uid] && !respostas[q.uid][1]).length;

  const titulo = [f.escopo === 'meu' ? concurso.sigla : 'Banco completo', f.materia, f.assunto].filter(Boolean).join(' · ');
  const resolver = (uids, extra = {}) => abrirSessao({ titulo, uids, idx: 0, modo: 'estudo', ...extra });
  const n = Math.max(1, Math.min(nSim, lista.length));

  const sel = (rot, k, ops, todas = 'Todas') => (
    <label className="campo">
      {rot}
      <select value={f[k]} onChange={(e) => set(k, e.target.value)}>
        <option value="">{todas}</option>
        {ops.map((o) => (Array.isArray(o) ? <option key={o[0]} value={o[0]}>{o[1]}</option> : <option key={o}>{o}</option>))}
      </select>
    </label>
  );

  return (
    <div>
      <section className="card">
        <div className="linha" style={{ marginBottom: 10 }}>
          <button className="btn peq" aria-pressed={f.escopo === 'meu'} onClick={() => set('escopo', 'meu')} style={f.escopo === 'meu' ? { background: 'var(--pri)', color: 'var(--pri-txt)', borderColor: 'var(--pri)' } : {}}>
            Meu concurso: {concurso.sigla}
          </button>
          <button className="btn peq" aria-pressed={f.escopo === 'banco'} onClick={() => set('escopo', 'banco')} style={f.escopo === 'banco' ? { background: 'var(--pri)', color: 'var(--pri-txt)', borderColor: 'var(--pri)' } : {}}>
            🌐 Banco completo ({banco.length})
          </button>
          {erradas > 0 && (
            <button className="btn peq" style={{ marginLeft: 'auto', color: 'var(--erro)', borderColor: 'var(--erro)' }} onClick={() => setF((x) => ({ ...x, mostrar: 'errei', busca: '', materia: '', assunto: '' }))}>
              🔁 Revisar meus erros ({erradas})
            </button>
          )}
        </div>
        <input type="text" value={f.busca} onChange={(e) => set('busca', e.target.value)} placeholder="🔎 Buscar por palavra no enunciado, disciplina ou assunto…" aria-label="Buscar questões" style={{ marginBottom: 10 }} />
        <div className="filtros">
          {sel('Disciplina', 'materia', opcoes('materia'))}
          {sel('Assunto', 'assunto', opcoes('assunto', fonte.filter((q) => !f.materia || q.materia === f.materia)), 'Todos')}
          {sel('Banca', 'banca', opcoes('banca'))}
          {sel('Ano', 'ano', opcoes('ano').map(String), 'Todos')}
          {sel('Tipo', 'formato', [['A-E', 'A a E'], ['A-D', 'A a D'], ['CE', 'Certo/Errado'], ['discursiva', 'Discursiva']], 'Todos')}
          {sel('Dificuldade', 'dificuldade', [['fácil', 'Fácil'], ['média', 'Média'], ['difícil', 'Difícil']])}
          {sel('Origem', 'origem', [['inédita', 'Inéditas'], ['prova_anterior', 'Provas anteriores']])}
          <label className="campo">
            Situação
            <select value={f.mostrar} onChange={(e) => set('mostrar', e.target.value)}>
              <option value="nao">Não resolvidas</option>
              <option value="errei">Que errei</option>
              <option value="acertei">Que acertei</option>
              <option value="todas">Todas</option>
            </select>
          </label>
        </div>
        <p style={{ marginTop: 12 }}>
          <b>{lista.length}</b> {lista.length === 1 ? 'questão encontrada' : 'questões encontradas'}
        </p>
        <div className="linha">
          <button className="btn pri" disabled={!lista.length} onClick={() => resolver(lista.map((q) => q.uid))}>Resolver na ordem</button>
          <button className="btn" disabled={!lista.length} onClick={() => resolver(embaralhar(lista).map((q) => q.uid))}>🔀 Aleatória</button>
          <span className="linha" style={{ gap: 6 }}>
            <button className="btn" disabled={!lista.length} onClick={() => resolver(embaralhar(lista).slice(0, n).map((q) => q.uid), { modo: 'simulado', minutos: Math.ceil(n * 3), titulo: `Simulado · ${titulo}` })}>
              ⏱ Simulado com
            </button>
            <input type="number" min="1" max={lista.length || 1} value={nSim} onChange={(e) => setNSim(Math.max(1, +e.target.value || 1))} aria-label="Número de questões do simulado" style={{ width: 70, minHeight: 44, borderRadius: 10, border: '1px solid var(--borda)', padding: '0 8px', background: 'var(--card)' }} />
            <span className="sub peq">questões · {Math.ceil(n * 3)} min</span>
          </span>
        </div>
      </section>

      {lista.length > 0 && (
        <section className="card">
          <button className="praticar" onClick={() => setVerLista(!verLista)}>{verLista ? '▾ Esconder a lista' : `▸ Ver a lista das questões (${Math.min(lista.length, 40)} primeiras)`}</button>
          {verLista &&
            lista.slice(0, 40).map((q, i) => {
              const r = respostas[q.uid];
              const c = getConcurso(q.concursos[0]);
              return (
                <button key={q.uid} className="card bloco-card" style={{ display: 'block', marginTop: 8, boxShadow: 'none' }} onClick={() => abrirSessao({ titulo, uids: lista.map((x) => x.uid), idx: i, modo: 'estudo' })}>
                  <div className="etiqueta" style={{ marginBottom: 6 }}>{[c?.sigla || q.concursoRef || q.orgao_prova_original, q.banca, q.ano, q.materia].filter(Boolean).join(' · ')}</div>
                  <div className="peq" style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{q.enunciado}</div>
                  <div className="peq" style={{ marginTop: 6, color: r ? (r[1] ? 'var(--ok)' : 'var(--erro)') : 'var(--sub)' }}>{r ? (r[1] ? '✓ Você acertou' : '✗ Você errou') : 'Não resolvida'}</div>
                </button>
              );
            })}
        </section>
      )}
    </div>
  );
}
