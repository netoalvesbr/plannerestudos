import { useMemo, useState } from 'react';
import { getConcurso, todosConcursos } from '../data/concursos.js';
import { QUESTOES, questoesDo } from '../lib/dados.js';

const norm = (t) => (t || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');

// Aba "Questões": busca no banco unificado (todas as questões de todos os concursos) e importação de provas.
export default function BancoQuestoes({ ctx }) {
  const { respostas, abrirSessao, abrirImportarProva, bancoVersao, prefs } = ctx;
  const [f, setF] = useState({ busca: '', concurso: '', materia: '', banca: '', ano: '', formato: '', mostrar: 'todas' });
  const set = (k, v) => setF((x) => ({ ...x, [k]: v, ...(k === 'concurso' ? { materia: '' } : {}) }));

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const base = useMemo(() => QUESTOES.filter((q) => !q.anulada), [bancoVersao]);
  const pc = prefs.concursos?.[f.concurso] || {};
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const doConcurso = useMemo(() => (f.concurso ? questoesDo(f.concurso, pc.cargo || 'ambos', pc.fase || null, { area: pc.area || null }) : base), [f.concurso, base, pc.cargo, pc.fase, pc.area]);
  const opcoes = (campo) => [...new Set(doConcurso.map((q) => q[campo]).filter(Boolean))].sort();

  const termo = norm(f.busca.trim());
  const lista = doConcurso.filter((q) => {
    const r = respostas[q.uid];
    if (f.materia && q.materia !== f.materia) return false;
    if (f.banca && q.banca !== f.banca) return false;
    if (f.ano && String(q.ano) !== f.ano) return false;
    if (f.formato && (q.formato || 'A-E') !== f.formato) return false;
    if (f.mostrar === 'nao' && r) return false;
    if (f.mostrar === 'errei' && !(r && !r[1])) return false;
    if (f.mostrar === 'acertei' && !(r && r[1])) return false;
    if (termo && !norm(`${q.enunciado} ${q.materia} ${q.assunto}`).includes(termo)) return false;
    return true;
  });

  const resolver = (idx = 0) =>
    abrirSessao({ titulo: `Questões · ${f.materia || (f.concurso ? getConcurso(f.concurso)?.sigla : 'Banco unificado')}`, uids: lista.map((q) => q.uid), idx, modo: 'estudo' });

  return (
    <div>
      <div className="linha entre" style={{ marginBottom: 6 }}>
        <h1 style={{ margin: 0 }}>📝 Banco de questões</h1>
        <button className="btn pri" onClick={() => abrirImportarProva()}>📥 Importar prova</button>
      </div>
      <p className="sub">Todas as questões da plataforma, de todos os concursos, num só lugar. Quem importa uma prova aumenta o banco para todos.</p>

      <section className="card">
        <input type="text" value={f.busca} onChange={(e) => set('busca', e.target.value)} placeholder="🔎 Buscar por palavra no enunciado, disciplina ou assunto…" aria-label="Buscar questões" style={{ marginBottom: 10 }} />
        <div className="filtros">
          <label className="campo">Concurso
            <select value={f.concurso} onChange={(e) => set('concurso', e.target.value)}>
              <option value="">Todos (banco completo)</option>
              {todosConcursos().map((c) => <option key={c.id} value={c.id}>Meu: {c.sigla}</option>)}
            </select>
          </label>
          <label className="campo">Disciplina
            <select value={f.materia} onChange={(e) => set('materia', e.target.value)}>
              <option value="">Todas</option>
              {opcoes('materia').map((m) => <option key={m}>{m}</option>)}
            </select>
          </label>
          <label className="campo">Banca
            <select value={f.banca} onChange={(e) => set('banca', e.target.value)}>
              <option value="">Todas</option>
              {opcoes('banca').map((m) => <option key={m}>{m}</option>)}
            </select>
          </label>
          <label className="campo">Ano
            <select value={f.ano} onChange={(e) => set('ano', e.target.value)}>
              <option value="">Todos</option>
              {opcoes('ano').map((m) => <option key={m}>{m}</option>)}
            </select>
          </label>
          <label className="campo">Tipo
            <select value={f.formato} onChange={(e) => set('formato', e.target.value)}>
              <option value="">Todos</option>
              <option value="A-E">A a E</option>
              <option value="A-D">A a D</option>
              <option value="CE">Certo/Errado</option>
              <option value="discursiva">Discursiva</option>
            </select>
          </label>
          <label className="campo">Mostrar
            <select value={f.mostrar} onChange={(e) => set('mostrar', e.target.value)}>
              <option value="todas">Todas</option>
              <option value="nao">Não resolvidas</option>
              <option value="errei">Que errei</option>
              <option value="acertei">Que acertei</option>
            </select>
          </label>
        </div>
        <p style={{ marginTop: 12 }}><b>{lista.length}</b> {lista.length === 1 ? 'questão encontrada' : 'questões encontradas'} <span className="sub">de {base.length} no banco</span></p>
        <button className="btn pri" disabled={!lista.length} onClick={() => resolver(0)}>Resolver {lista.length ? `estas ${lista.length}` : ''}</button>
      </section>

      {lista.slice(0, 40).map((q, i) => {
        const r = respostas[q.uid];
        const c = getConcurso(q.concursos[0]);
        return (
          <button key={q.uid} className="card bloco-card" onClick={() => resolver(i)} style={{ display: 'block' }}>
            <div className="etiqueta" style={{ marginBottom: 6 }}>
              {[c?.sigla || q.concursoRef || q.orgao_prova_original, q.banca, q.ano, q.materia].filter(Boolean).join(' · ')}
            </div>
            <div className="peq" style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{q.enunciado}</div>
            <div className="peq" style={{ marginTop: 6, color: r ? (r[1] ? 'var(--ok)' : 'var(--erro)') : 'var(--sub)' }}>
              {r ? (r[1] ? '✓ Você acertou' : '✗ Você errou') : 'Não resolvida'}
            </div>
          </button>
        );
      })}
      {lista.length > 40 && <p className="sub">Mostrando 40 de {lista.length}. Use os filtros ou clique em "Resolver" para percorrer todas.</p>}
    </div>
  );
}
