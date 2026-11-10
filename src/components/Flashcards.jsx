import { useMemo, useState } from 'react';
import { disciplinasDo } from '../lib/dados.js';

// 🃏 Flashcards com repetição espaçada (cada acerto aumenta o intervalo até a próxima revisão)
const INTERVALOS = [0, 1, 3, 7, 14, 30, 60, 120]; // dias, por "caixa"
const DIA = 86400000;
const hojeIso = () => new Date().toLocaleDateString('sv-SE');
const somarDias = (n) => new Date(Date.now() + n * DIA).toLocaleDateString('sv-SE');
const fmtInt = (n) => (n === 0 ? 'hoje' : n === 1 ? '1 dia' : n < 30 ? `${n} dias` : n < 60 ? '1 mês' : `${Math.round(n / 30)} meses`);
const novoId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export const situacao = (c) => {
  const cx = c.rev?.caixa || 0;
  if (!c.rev || c.rev.proxima <= hojeIso()) return 'revisar';
  return cx >= 4 ? 'longo' : 'curto';
};

export default function Flashcards({ ctx }) {
  const { prefs, setPrefs, concurso, cargo, fase, area, questoes, respostas } = ctx;
  const dados = prefs.flashcards || { cartoes: [], historico: {} };
  const cartoes = dados.cartoes || [];
  const [tela, setTela] = useState('inicio');
  const [filtro, setFiltro] = useState({ materia: '', tema: '' });
  const salvar = (n) => setPrefs({ flashcards: { ...dados, ...n } });
  const materiasConc = concurso ? disciplinasDo(concurso.id, cargo, fase, area).map((d) => d.nome) : [];
  const materias = [...new Set([...materiasConc, ...cartoes.map((c) => c.materia)])].filter(Boolean).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const temas = [...new Set(cartoes.filter((c) => !filtro.materia || c.materia === filtro.materia).map((c) => c.tema).filter(Boolean))].sort();
  const doFiltro = cartoes.filter((c) => (!filtro.materia || c.materia === filtro.materia) && (!filtro.tema || c.tema === filtro.tema));
  const cont = { revisar: 0, curto: 0, longo: 0 };
  doFiltro.forEach((c) => cont[situacao(c)]++);
  const ultimos7 = [...Array(7)].map((_, i) => somarDias(i - 6));
  const maxDia = Math.max(1, ...ultimos7.map((d) => dados.historico?.[d] || 0));

  if (tela === 'estudar') return <Estudo cartoes={doFiltro.filter((c) => situacao(c) === 'revisar')} dados={dados} salvar={salvar} voltar={() => setTela('inicio')} />;
  if (tela === 'criar') return <Criar materias={materias} filtro={filtro} dados={dados} salvar={salvar} voltar={() => setTela('inicio')} questoes={questoes} respostas={respostas} concurso={concurso} />;
  if (tela === 'lista') return <Lista cartoes={doFiltro} dados={dados} salvar={salvar} voltar={() => setTela('inicio')} />;

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>🃏 Flashcards</h2>
      <div className="filtros">
        <label className="campo">Matéria
          <select value={filtro.materia} onChange={(e) => setFiltro({ materia: e.target.value, tema: '' })}>
            <option value="">Todas</option>
            {materias.map((m) => <option key={m}>{m}</option>)}
          </select>
        </label>
        <label className="campo">Tema
          <select value={filtro.tema} onChange={(e) => setFiltro({ ...filtro, tema: e.target.value })}>
            <option value="">Todos</option>
            {temas.map((t) => <option key={t}>{t}</option>)}
          </select>
        </label>
      </div>
      <div className="grade">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>🔁 Revisão</h3>
          <p className="sub peq">{cont.revisar ? `${cont.revisar} ${cont.revisar === 1 ? 'cartão para revisar' : 'cartões para revisar'} hoje` : 'Nada para revisar hoje ✓'}</p>
          <button className="btn pri" disabled={!cont.revisar} onClick={() => setTela('estudar')}>Revisar agora</button>
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>🗂️ Meus flashcards</h3>
          <p className="sub peq">{doFiltro.length} {doFiltro.length === 1 ? 'cartão' : 'cartões'}</p>
          <button className="btn" onClick={() => setTela('lista')} disabled={!doFiltro.length}>Ver e editar</button>
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>➕ Criar</h3>
          <p className="sub peq">À mão, pelo Claude ou a partir das questões que você errou.</p>
          <button className="btn" onClick={() => setTela('criar')}>Criar flashcards</button>
        </div>
      </div>
      <section className="card">
        <h3 style={{ marginTop: 0 }}>Meu desempenho</h3>
        <ul className="lista-leitura">
          <li>🔁 <b>{cont.revisar}</b> em revisão (para hoje)</li>
          <li>🟡 <b>{cont.curto}</b> na memória de curto prazo (intervalo de até 7 dias)</li>
          <li>🟢 <b>{cont.longo}</b> na memória de longo prazo (14 dias ou mais)</li>
        </ul>
        <h4 style={{ marginBottom: 4 }}>Revisados por dia (7 dias)</h4>
        <div className="barras-dias" style={{ height: 110 }} role="img" aria-label="Cartões revisados por dia nos últimos 7 dias">
          {ultimos7.map((d) => (
            <div key={d} className="barra-dia">
              <span className="valor">{dados.historico?.[d] || ''}</span>
              <i style={{ height: `${((dados.historico?.[d] || 0) / maxDia) * 100}%` }} />
              <span className="rot">{d.slice(8)}/{d.slice(5, 7)}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Estudo({ cartoes, dados, salvar, voltar }) {
  const [fila, setFila] = useState(() => [...cartoes].sort(() => Math.random() - 0.5).map((c) => c.id));
  const [virado, setVirado] = useState(false);
  const [feitos, setFeitos] = useState(0);
  const atual = dados.cartoes.find((c) => c.id === fila[0]);
  if (!atual) {
    return (
      <div className="card" style={{ textAlign: 'center' }}>
        <h2>✓ Revisão concluída!</h2>
        <p>{feitos} {feitos === 1 ? 'cartão revisado' : 'cartões revisados'}. Volte amanhã para as próximas revisões.</p>
        <button className="btn pri" onClick={voltar}>Voltar</button>
      </div>
    );
  }
  const cx = atual.rev?.caixa || 0;
  const opcoes = [
    ['errei', '✗ Errei', 0],
    ['dificil', 'Difícil', Math.max(1, cx)],
    ['bom', 'Bom', Math.min(cx + 1, INTERVALOS.length - 1)],
    ['facil', 'Fácil', Math.min(cx + 2, INTERVALOS.length - 1)],
  ];
  const responder = (nova, tipo) => {
    const hoje = hojeIso();
    const rev = { caixa: nova, proxima: somarDias(INTERVALOS[nova]), acertos: (atual.rev?.acertos || 0) + (tipo === 'errei' ? 0 : 1), erros: (atual.rev?.erros || 0) + (tipo === 'errei' ? 1 : 0), ultima: hoje };
    salvar({ cartoes: dados.cartoes.map((c) => (c.id === atual.id ? { ...c, rev } : c)), historico: { ...(dados.historico || {}), [hoje]: (dados.historico?.[hoje] || 0) + 1 } });
    setFeitos(feitos + 1);
    setVirado(false);
    // errou: o cartão volta no fim desta mesma sessão
    setFila(tipo === 'errei' ? [...fila.slice(1), atual.id] : fila.slice(1));
  };
  return (
    <div>
      <div className="linha entre" style={{ alignItems: 'center' }}>
        <button className="btn peq" onClick={voltar}>← Sair</button>
        <span className="peq sub">Faltam {fila.length} · {atual.materia}{atual.tema ? ` · ${atual.tema}` : ''}</span>
      </div>
      <button className={`flashcard${virado ? ' virado' : ''}`} onClick={() => setVirado(!virado)} aria-label={virado ? 'Resposta. Clique para ver a pergunta' : 'Pergunta. Clique para ver a resposta'}>
        <span className="peq sub">{virado ? 'RESPOSTA' : 'PERGUNTA'}</span>
        <span className="texto-card">{virado ? atual.verso : atual.frente}</span>
        {!virado && <span className="peq sub">Toque para ver a resposta</span>}
      </button>
      {virado ? (
        <div className="botoes-rev">
          {opcoes.map(([k, rot, nova]) => (
            <button key={k} className={`btn${k === 'bom' ? ' pri' : ''}`} onClick={() => responder(nova, k)}>
              {rot}
              <span className="peq">{k === 'errei' ? 'de novo agora' : `em ${fmtInt(INTERVALOS[nova])}`}</span>
            </button>
          ))}
        </div>
      ) : (
        <div style={{ textAlign: 'center' }}><button className="btn pri" onClick={() => setVirado(true)}>Mostrar resposta</button></div>
      )}
    </div>
  );
}

function Lista({ cartoes, dados, salvar, voltar }) {
  const [editando, setEditando] = useState(null);
  const [conf, setConf] = useState(null);
  return (
    <div>
      <button className="btn peq" onClick={voltar}>← Flashcards</button>
      <h2>🗂️ Meus flashcards ({cartoes.length})</h2>
      <ul className="lista-materias">
        {cartoes.map((c) =>
          editando?.id === c.id ? (
            <li key={c.id}>
              <FormCartao valor={editando} mudar={setEditando} />
              <div className="linha">
                <button className="btn pri peq" onClick={() => { salvar({ cartoes: dados.cartoes.map((x) => (x.id === c.id ? editando : x)) }); setEditando(null); }}>Salvar</button>
                <button className="btn peq" onClick={() => setEditando(null)}>Cancelar</button>
              </div>
            </li>
          ) : (
            <li key={c.id}>
              <div className="peq sub">{c.materia}{c.tema ? ` · ${c.tema}` : ''} · {situacao(c) === 'revisar' ? '🔁 revisar hoje' : `próxima: ${c.rev.proxima.split('-').reverse().join('/')}`}</div>
              <b>{c.frente}</b>
              <div className="peq">{c.verso}</div>
              <div className="linha" style={{ marginTop: 4 }}>
                <button className="link peq" onClick={() => setEditando(c)}>✏️ Editar</button>
                {conf === c.id ? (
                  <>
                    <button className="link peq desce" onClick={() => salvar({ cartoes: dados.cartoes.filter((x) => x.id !== c.id) })}>Confirmar exclusão</button>
                    <button className="link peq" onClick={() => setConf(null)}>Cancelar</button>
                  </>
                ) : (
                  <button className="link peq" onClick={() => setConf(c.id)}>🗑️ Excluir</button>
                )}
              </div>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}

function FormCartao({ valor, mudar, materias = [] }) {
  return (
    <div className="form-anot">
      <div className="filtros">
        <label className="campo">Matéria
          <input list="lista-materias-fc" value={valor.materia} onChange={(e) => mudar({ ...valor, materia: e.target.value })} required />
          <datalist id="lista-materias-fc">{materias.map((m) => <option key={m} value={m} />)}</datalist>
        </label>
        <label className="campo">Tema<input value={valor.tema} onChange={(e) => mudar({ ...valor, tema: e.target.value })} placeholder="ex.: Lei penal no tempo" /></label>
      </div>
      <label className="campo">Frente (pergunta)<textarea rows="2" value={valor.frente} onChange={(e) => mudar({ ...valor, frente: e.target.value })} /></label>
      <label className="campo">Verso (resposta)<textarea rows="3" value={valor.verso} onChange={(e) => mudar({ ...valor, verso: e.target.value })} /></label>
    </div>
  );
}

function Criar({ materias, filtro, dados, salvar, voltar, questoes, respostas, concurso }) {
  const [modo, setModo] = useState('mao');
  const [c, setC] = useState({ materia: filtro.materia || materias[0] || '', tema: filtro.tema || '', frente: '', verso: '' });
  const [msg, setMsg] = useState(null);
  const [qtd, setQtd] = useState(15);
  const [resposta, setResposta] = useState('');
  const adicionar = (lista) => {
    const novos = lista.map((x) => ({ id: novoId(), materia: x.materia, tema: x.tema || '', frente: x.frente.trim(), verso: x.verso.trim(), criado: hojeIso() }));
    salvar({ cartoes: [...(dados.cartoes || []), ...novos] });
    setMsg(`✓ ${novos.length} ${novos.length === 1 ? 'cartão criado' : 'cartões criados'}. Eles já entram na revisão de hoje.`);
  };
  const erradas = useMemo(
    () => questoes.filter((q) => respostas[q.uid] && !respostas[q.uid][1] && q.gabarito !== 'OK' && (!c.materia || q.materia === c.materia)),
    [questoes, respostas, c.materia],
  );
  const jaTem = new Set((dados.cartoes || []).map((x) => x.origem).filter(Boolean));
  const deErros = () => {
    const lista = erradas.filter((q) => !jaTem.has(q.uid)).map((q) => {
      const alt = q.alternativas?.[q.gabarito];
      return {
        materia: q.materia,
        tema: q.assunto || '',
        frente: q.enunciado + (q.alternativas && q.gabarito !== 'C' && q.gabarito !== 'E' ? '\n\n' + Object.entries(q.alternativas).map(([l, t]) => `${l}) ${t}`).join('\n') : ''),
        verso: `Gabarito: ${q.gabarito}${alt ? `) ${alt}` : ''}${q.comentario ? `\n\n${q.comentario}` : ''}`,
        origem: q.uid,
      };
    });
    if (!lista.length) return setMsg('Não há questões erradas novas para transformar em flashcards.');
    const novos = lista.map((x) => ({ ...x, id: novoId(), criado: hojeIso() }));
    salvar({ cartoes: [...(dados.cartoes || []), ...novos] });
    setMsg(`✓ ${novos.length} flashcards criados a partir das questões que você errou.`);
  };
  const pedido = `Você é professor de ${c.materia || '[matéria]'} para concursos${concurso ? ` (foco: ${concurso.nome}${concurso.banca ? `, banca ${concurso.banca}` : ''})` : ''}.
Crie ${qtd} flashcards sobre o tema "${c.tema || '[tema]'}", com os pontos mais cobrados em prova: conceitos, exceções, prazos, artigos de lei, súmulas e pegadinhas. Use a legislação vigente.
- Frente: pergunta curta e direta.
- Verso: resposta objetiva (até 3 linhas), citando o artigo/súmula quando houver.
Responda APENAS com um bloco JSON:
\`\`\`json
[{"frente":"...","verso":"..."}]
\`\`\``;
  const importar = () => {
    try {
      const t = resposta.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1] || resposta.slice(resposta.indexOf('['), resposta.lastIndexOf(']') + 1);
      const lista = JSON.parse(t).filter((x) => x.frente && x.verso);
      if (!lista.length) throw new Error();
      adicionar(lista.map((x) => ({ ...x, materia: c.materia, tema: c.tema })));
      setResposta('');
    } catch {
      setMsg('✗ Não entendi a resposta. Copie a resposta inteira do Claude, com o bloco JSON.');
    }
  };
  return (
    <div>
      <button className="btn peq" onClick={voltar}>← Flashcards</button>
      <h2>➕ Criar flashcards</h2>
      <div className="abas" role="tablist">
        {[['mao', '✍️ À mão'], ['claude', '✨ Com o Claude'], ['erros', '✗ Dos meus erros']].map(([k, r]) => (
          <button key={k} role="tab" aria-selected={modo === k} onClick={() => { setModo(k); setMsg(null); }}>{r}</button>
        ))}
      </div>
      {msg && <p className="aviso" role="status" style={{ background: 'var(--ok-bg)', color: 'var(--txt)' }}>{msg}</p>}
      {modo === 'mao' && (
        <form className="card" onSubmit={(e) => { e.preventDefault(); if (c.frente.trim() && c.verso.trim() && c.materia) { adicionar([c]); setC({ ...c, frente: '', verso: '' }); } }}>
          <FormCartao valor={c} mudar={setC} materias={materias} />
          <button className="btn pri">Adicionar cartão</button>
        </form>
      )}
      {modo === 'claude' && (
        <div className="card">
          <FormCartaoCabecalho c={c} setC={setC} materias={materias} />
          <label className="campo" style={{ maxWidth: 200 }}>Quantidade<input type="number" min="5" max="50" value={qtd} onChange={(e) => setQtd(+e.target.value || 15)} /></label>
          <p className="peq">1. Escolha a matéria e o tema. 2. Copie o pedido e cole numa conversa com o Claude (sem custo). 3. Cole a resposta abaixo.</p>
          <div className="linha">
            <button className="btn" disabled={!c.materia || !c.tema} onClick={() => navigator.clipboard?.writeText(pedido).then(() => setMsg('✓ Pedido copiado. Cole no Claude.'))}>📋 Copiar pedido</button>
            <a className="btn" href="https://claude.ai/new" target="_blank" rel="noreferrer">Abrir o Claude ↗</a>
          </div>
          <textarea rows="5" value={resposta} onChange={(e) => setResposta(e.target.value)} placeholder="Cole aqui a resposta do Claude" style={{ width: '100%', marginTop: 8 }} />
          <button className="btn pri" disabled={!resposta.trim()} onClick={importar}>Criar cartões</button>
        </div>
      )}
      {modo === 'erros' && (
        <div className="card">
          <label className="campo" style={{ maxWidth: 360 }}>Matéria
            <select value={c.materia} onChange={(e) => setC({ ...c, materia: e.target.value })}>
              <option value="">Todas</option>
              {materias.map((m) => <option key={m}>{m}</option>)}
            </select>
          </label>
          <p>Você errou <b>{erradas.length}</b> {erradas.length === 1 ? 'questão' : 'questões'}{c.materia ? ` de ${c.materia}` : ''}. Cada uma vira um cartão: a frente é o enunciado e o verso traz o gabarito e o comentário.</p>
          <button className="btn pri" disabled={!erradas.length} onClick={deErros}>Criar flashcards dos meus erros</button>
        </div>
      )}
    </div>
  );
}

function FormCartaoCabecalho({ c, setC, materias }) {
  return (
    <div className="filtros">
      <label className="campo">Matéria
        <input list="lista-materias-fc2" value={c.materia} onChange={(e) => setC({ ...c, materia: e.target.value })} />
        <datalist id="lista-materias-fc2">{materias.map((m) => <option key={m} value={m} />)}</datalist>
      </label>
      <label className="campo">Tema<input value={c.tema} onChange={(e) => setC({ ...c, tema: e.target.value })} placeholder="ex.: Aplicação da lei penal no tempo" /></label>
    </div>
  );
}
