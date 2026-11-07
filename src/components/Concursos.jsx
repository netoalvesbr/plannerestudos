import { useState } from 'react';
import { todosConcursos } from '../data/concursos.js';
import Calendario, { eventosDoConcurso, ProximaData } from './Calendario.jsx';
import EditalVerticalizado from './EditalVerticalizado.jsx';
import { disciplinasDo, questoesDo } from '../lib/dados.js';
import { diasAte, fmtData, fmtPct, resumo } from '../lib/stats.js';
import { PROVEDORES_LOGIN } from '../data/config.js';
import { getModo, criarConta, entrarComProvedor, definirNovaSenha, entrarComSenha, entrarLocal, recuperarSenha } from '../lib/store.js';

export function Login({ aoEntrar }) {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState(null);
  const [erro, setErro] = useState(null);

  if (getModo() !== 'conta') {
    return (
      <form
        className="card login"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!nome.trim()) return;
          await entrarLocal(nome);
          aoEntrar();
        }}
      >
        <h1>Bem-vindo ao EstudaAí</h1>
        <p className="sub">Banco de questões, mapas mentais e desempenho para concursos.</p>
        {getModo() === 'local' && <p className="aviso">Respostas salvas apenas neste aparelho.</p>}
        <label className="campo">
          Como você quer ser chamado?
          <input type="text" value={nome} onChange={(e) => setNome(e.target.value)} autoFocus placeholder="Seu nome" />
        </label>
        <button className="btn pri" style={{ marginTop: 12, width: '100%' }}>Entrar</button>
      </form>
    );
  }

  return <LoginConta aoEntrar={aoEntrar} />;
}

function LoginConta({ aoEntrar }) {
  const [aba, setAba] = useState('entrar'); // entrar | criar | esqueci
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [msg, setMsg] = useState(null);
  const [erro, setErro] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    setErro(null);
    setMsg(null);
    setOcupado(true);
    try {
      if (aba === 'entrar') {
        await entrarComSenha(email.trim(), senha);
        aoEntrar();
      } else if (aba === 'criar') {
        if (!nome.trim()) throw new Error('Informe o seu nome.');
        const entrou = await criarConta(nome.trim(), email.trim(), senha);
        if (entrou) aoEntrar();
        else setMsg('Conta criada! Enviamos um link de confirmação para o seu e-mail. Depois de confirmar, volte aqui e clique em "Entrar".');
      } else {
        await recuperarSenha(email.trim());
        setMsg('Se este e-mail tiver conta, você vai receber um link para criar uma nova senha.');
      }
    } catch (er) {
      setErro(er.message);
    } finally {
      setOcupado(false);
    }
  }

  const titulo = { entrar: 'Entrar', criar: 'Criar conta', esqueci: 'Recuperar senha' }[aba];
  const BOTOES = {
    google: { rotulo: 'Continuar com Google', icone: <IconeGoogle /> },
    azure: { rotulo: 'Continuar com Hotmail / Outlook', icone: <IconeMicrosoft /> },
    apple: { rotulo: 'Continuar com Apple', icone: <span aria-hidden="true"></span> },
  };
  return (
    <div className="login">
      <div className="centro" style={{ marginBottom: 16 }}>
        <div className="logo" style={{ fontSize: '2rem' }}>📚 EstudaAí</div>
        <p className="sub">Banco de questões, provas diárias, mapas mentais e desempenho para concursos.</p>
      </div>
      <form className="card" onSubmit={enviar}>
        {aba !== 'esqueci' && (
          <div className="abas" role="tablist">
            <button type="button" role="tab" aria-selected={aba === 'entrar'} onClick={() => { setAba('entrar'); setErro(null); setMsg(null); }}>Entrar</button>
            <button type="button" role="tab" aria-selected={aba === 'criar'} onClick={() => { setAba('criar'); setErro(null); setMsg(null); }}>Criar conta</button>
          </div>
        )}
        <h1>{titulo}</h1>
        {aba !== 'esqueci' && PROVEDORES_LOGIN.length > 0 && (
          <>
            <div className="escolha" style={{ gap: 8 }}>
              {PROVEDORES_LOGIN.map((p) => (
                <button
                  key={p}
                  type="button"
                  className="btn"
                  style={{ width: '100%' }}
                  onClick={() => { setErro(null); entrarComProvedor(p).catch((er) => setErro(er.message)); }}
                >
                  {BOTOES[p]?.icone} {BOTOES[p]?.rotulo || p}
                </button>
              ))}
            </div>
            <div className="sub peq centro" style={{ margin: '12px 0 4px' }}>ou com e-mail e senha</div>
          </>
        )}
        {aba === 'criar' && (
          <label className="campo">
            Seu nome
            <input type="text" autoComplete="name" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Como quer ser chamado" />
          </label>
        )}
        <label className="campo" style={{ marginTop: 10 }}>
          E-mail
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" />
        </label>
        {aba !== 'esqueci' && (
          <label className="campo" style={{ marginTop: 10 }}>
            Senha {aba === 'criar' && <span>(mínimo de 6 caracteres)</span>}
            <input
              type="password"
              required
              minLength={6}
              autoComplete={aba === 'criar' ? 'new-password' : 'current-password'}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              style={{ minHeight: 44, padding: '8px 10px', borderRadius: 10, border: '1px solid var(--borda)', background: 'var(--card)', width: '100%' }}
            />
          </label>
        )}
        <button className="btn pri" disabled={ocupado} style={{ marginTop: 14, width: '100%' }}>
          {ocupado ? 'Aguarde…' : aba === 'entrar' ? 'Entrar' : aba === 'criar' ? 'Criar minha conta' : 'Enviar link'}
        </button>
        {erro && <p className="aviso" role="alert" style={{ marginTop: 12 }}>{erro}</p>}
        {msg && <p className="aviso" role="status" style={{ marginTop: 12, background: 'var(--ok-bg)', color: 'var(--ok)' }}>{msg}</p>}
        <div className="centro" style={{ marginTop: 10 }}>
          {aba === 'entrar' && <button type="button" className="praticar" onClick={() => { setAba('esqueci'); setErro(null); }}>Esqueci minha senha</button>}
          {aba === 'esqueci' && <button type="button" className="praticar" onClick={() => setAba('entrar')}>← Voltar para entrar</button>}
        </div>
      </form>
      <p className="sub centro peq">
        Cada pessoa tem a própria conta, com o próprio histórico de estudos. Ninguém vê o desempenho de outra pessoa.
        <br />
        <a href="/privacidade.html">Política de Privacidade</a> · <a href="/termos.html">Termos de Uso</a>
      </p>
    </div>
  );
}

export function NovaSenha({ aoConcluir }) {
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState(null);
  return (
    <form
      className="card login"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await definirNovaSenha(senha);
          aoConcluir();
        } catch (er) {
          setErro(er.message);
        }
      }}
    >
      <h1>Criar nova senha</h1>
      <label className="campo">
        Nova senha (mínimo de 6 caracteres)
        <input type="password" required minLength={6} autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)}
          style={{ minHeight: 44, padding: '8px 10px', borderRadius: 10, border: '1px solid var(--borda)', background: 'var(--card)', width: '100%' }} />
      </label>
      <button className="btn pri" style={{ marginTop: 12, width: '100%' }}>Salvar nova senha</button>
      {erro && <p className="aviso" style={{ marginTop: 12 }}>{erro}</p>}
    </form>
  );
}

export function MeusConcursos({ ctx }) {
  const { prefs, setPrefs, respostas, abrirFicha, abrirNovoConcurso, abrirImportarProva, usuario } = ctx;
  const seguindo = prefs.seguindo || [];
  const [busca, setBusca] = useState('');
  const todos = todosConcursos();
  const termo = busca.trim().toLowerCase();
  const lista = todos
    .filter((c) => !termo || `${c.sigla} ${c.nome} ${c.banca} ${c.orgao || ''}`.toLowerCase().includes(termo))
    .sort((a, b) => Number(seguindo.includes(b.id)) - Number(seguindo.includes(a.id)));
  return (
    <div>
      <div className="linha entre" style={{ marginBottom: 6 }}>
        <h1 style={{ margin: 0 }}>Concursos</h1>
        <div className="linha">
          <button className="btn pri" onClick={abrirNovoConcurso}>+ Adicionar concurso</button>
          <button className="btn" onClick={() => abrirImportarProva()}>📥 Importar prova</button>
        </div>
      </div>
      <p className="sub">
        Seus concursos são <b>só seus</b> (fases, matérias, datas, cronograma e desempenho). Use <b>+ Adicionar concurso</b> para cadastrar os que você vai fazer.
        Compartilhado entre todos é apenas o banco de questões e os editais verticalizados que cada um decidir compartilhar.
      </p>
      <input type="text" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="🔎 Procurar concurso (sigla, nome, banca)…" style={{ marginBottom: 12 }} aria-label="Procurar concurso" />
      <div className="grade">
        {lista.map((c) => {
          const seg = seguindo.includes(c.id);
          const pc = prefs.concursos?.[c.id] || {};
          const s = resumo(questoesDo(c.id, pc.cargo || 'ambos', pc.fase, { area: pc.area }), respostas);
          const nQ = questoesDo(c.id, 'ambos', null).length;
          const faltam = c.dataProva ? diasAte(c.dataProva) : null;
          const fase = c.fases?.find((f) => f.id === pc.fase);
          return (
            <div key={c.id} className="card" style={{ borderColor: seg ? 'var(--pri)' : undefined }}>
              <h2>{c.sigla} – {c.nome}</h2>
              <p className="sub">
                {[c.banca, c.cargos?.length ? c.cargos.map((x) => x.nome).join(' / ') : null].filter(Boolean).join(' · ')}
                {c.fases?.length > 0 && <><br />Fases: {c.fases.map((f) => f.nome).join(' · ')}</>}
                <br />
                {c.dataProva ? <>Prova em {fmtData(c.dataProva)} {faltam >= 0 && <span className="contagem">· faltam {faltam} dias</span>}</> : 'Data da prova a definir'}
                <br />
                {nQ} questões no banco{c.editalUrl ? ' · edital em PDF' : ''}
              </p>
              {seg && (
                <p>
                  {fase && <>Estudando: <b>{fase.nome}</b>{fase.areas?.find((a) => a.id === pc.area) ? <> – <b>{fase.areas.find((a) => a.id === pc.area).nome}</b></> : null}<br /></>}
                  Acerto geral: <b>{fmtPct(s.pct)}</b> <span className="sub">({s.resolvidas} resolvidas)</span>
                </p>
              )}
              <div className="linha">
                {seg ? (
                  <>
                    <button className="btn pri" disabled={prefs.ativo === c.id} onClick={() => { setPrefs({ ativo: c.id }); ctx.irInicio(); }}>
                      {prefs.ativo === c.id ? '✓ Ativo' : 'Estudar este'}
                    </button>
                    <button className="btn peq" onClick={() => setPrefs({ seguindo: seguindo.filter((x) => x !== c.id), ativo: prefs.ativo === c.id ? seguindo.find((x) => x !== c.id) || null : prefs.ativo })}>
                      Deixar de acompanhar
                    </button>
                  </>
                ) : (
                  <button className="btn pri" onClick={() => { setPrefs({ seguindo: [...seguindo, c.id], ativo: c.id }); ctx.irInicio(); }}>+ Acompanhar</button>
                )}
                <button className="btn peq" onClick={() => abrirFicha(c.id)}>Ficha e edital</button>
              </div>
              {!c.remoto && <p className="peq sub" style={{ marginTop: 6 }}>Concurso pronto da plataforma</p>}
            </div>
          );
        })}
      </div>
      {!lista.length && <p className="card sub">Nenhum concurso encontrado. Use <b>+ Adicionar concurso</b> para cadastrar.</p>}
    </div>
  );
}

function EscolhaConfirmada({ titulo, texto, opcoes, aoConfirmar, rotuloBotao }) {
  const [sel, setSel] = useState(null);
  return (
    <section className="card login" style={{ maxWidth: 560 }}>
      <h1>{titulo}</h1>
      <p className="sub">{texto}</p>
      <div className="escolha" role="radiogroup">
        {opcoes.map((o) => (
          <button
            key={o.id}
            role="radio"
            aria-checked={sel === o.id}
            className="card bloco-card"
            style={{ borderColor: sel === o.id ? 'var(--pri)' : undefined, borderWidth: 2, background: sel === o.id ? 'var(--pri-claro)' : undefined, margin: 0 }}
            onClick={() => setSel(o.id)}
          >
            <h2 style={{ marginBottom: 2 }}>{sel === o.id ? '◉' : '○'} {o.nome}</h2>
            {o.desc && <p className="sub" style={{ margin: 0 }}>{o.desc}</p>}
          </button>
        ))}
      </div>
      <button className="btn pri" style={{ marginTop: 14, width: '100%' }} disabled={!sel} onClick={() => aoConfirmar(sel)}>
        {sel ? rotuloBotao : 'Selecione uma opção'}
      </button>
    </section>
  );
}

export function EscolhaArea({ concurso, fase, aoEscolher }) {
  return (
    <EscolhaConfirmada
      titulo={`${concurso.sigla} · ${fase.nome}`}
      texto="Qual matéria você vai fazer na 2ª fase? Você estuda só o conteúdo dela (direito material, processual e as peças). Depois de confirmar, sugerimos o seu cronograma."
      opcoes={fase.areas.map((a) => ({ id: a.id, nome: a.nome }))}
      rotuloBotao="Confirmar e montar meu cronograma"
      aoConfirmar={aoEscolher}
    />
  );
}

export function EscolhaFase({ concurso, aoEscolher }) {
  const desc = { 'A-E': 'Múltipla escolha (A a E)', 'A-D': 'Múltipla escolha (A a D)', CE: 'Certo ou Errado', discursiva: 'Discursiva / peça' };
  return (
    <EscolhaConfirmada
      titulo={`${concurso.sigla}: para qual fase você vai estudar?`}
      texto="As matérias, as questões e o cronograma seguem esta escolha. Você pode trocar depois na ficha do concurso."
      opcoes={concurso.fases.map((f) => ({
        id: f.id,
        nome: f.nome,
        desc: [desc[f.formato], f.data ? `prova em ${fmtData(f.data)}` : null, f.areas?.length ? `escolha entre ${f.areas.length} matérias` : 'todas as matérias'].filter(Boolean).join(' · '),
      }))}
      rotuloBotao="Confirmar"
      aoConfirmar={aoEscolher}
    />
  );
}

export function EscolhaCargo({ concurso, aoEscolher }) {
  const [sel, setSel] = useState([]);
  const alternar = (id) => setSel((x) => (x.includes(id) ? x.filter((y) => y !== id) : [...x, id]));
  return (
    <section className="card login" style={{ maxWidth: 560 }}>
      <h1>{concurso.sigla}: para qual cargo você vai concorrer?</h1>
      <p className="sub">Pode marcar mais de um. As provas diárias e as matérias específicas seguem esta escolha (dá para mudar depois em Provas diárias).</p>
      <div className="escolha">
        {concurso.cargos.map((c) => (
          <button key={c.id} role="checkbox" aria-checked={sel.includes(c.id)} className="card bloco-card" style={{ margin: 0, borderWidth: 2, borderColor: sel.includes(c.id) ? 'var(--pri)' : undefined, background: sel.includes(c.id) ? 'var(--pri-claro)' : undefined }} onClick={() => alternar(c.id)}>
            <h2 style={{ marginBottom: 2 }}>{sel.includes(c.id) ? '☑' : '☐'} {c.nome}</h2>
            <p className="sub" style={{ margin: 0 }}>{c.horario}</p>
          </button>
        ))}
      </div>
      <button className="btn pri" style={{ marginTop: 14, width: '100%' }} disabled={!sel.length} onClick={() => aoEscolher(sel.length === concurso.cargos.length ? 'ambos' : sel[0])}>
        {sel.length ? 'Confirmar' : 'Marque pelo menos um cargo'}
      </button>
    </section>
  );
}

export function Ficha({ ctx, concurso, voltar }) {
  const { prefs, setPrefs, usuario, abrirEditarConcurso, abrirImportarProva, excluir } = ctx;
  const pc = prefs.concursos?.[concurso.id] || {};
  const cargo = pc.cargo || 'ambos';
  const fase = pc.fase || '';
  const faseObj = concurso.fases?.find((f) => f.id === fase);
  const area = faseObj?.areas?.length ? pc.area || '' : '';
  const marcados = prefs.edital?.[concurso.id] || {};
  const [confirmar, setConfirmar] = useState(false);
  const podeEditar = concurso.remoto && (concurso.criadoPor === usuario?.id || usuario?.admin);
  const setPc = (parcial) => setPrefs({ concursos: { ...(prefs.concursos || {}), [concurso.id]: { ...pc, ...parcial } } });
  const marcar = (disc, i) => {
    const atual = new Set(marcados[disc] || []);
    atual.has(i) ? atual.delete(i) : atual.add(i);
    setPrefs({ edital: { ...(prefs.edital || {}), [concurso.id]: { ...marcados, [disc]: [...atual] } } });
  };
  const discs = disciplinasDo(concurso.id, cargo, fase || null, area || null);
  const feitosD = discs.filter((d) => (marcados.__disciplinas || []).includes(d.nome)).length;
  const marcarDisc = (nome) => {
    const atual = new Set(marcados.__disciplinas || []);
    atual.has(nome) ? atual.delete(nome) : atual.add(nome);
    setPrefs({ edital: { ...(prefs.edital || {}), [concurso.id]: { ...marcados, __disciplinas: [...atual] } } });
  };
  const totalT = discs.reduce((s, d) => s + (d.topicos?.length || 0), 0);
  const feitosT = discs.reduce((s, d) => s + (marcados[d.nome]?.filter((i) => i < (d.topicos?.length || 0)).length || 0), 0);
  const p = concurso.prova;
  return (
    <div>
      <button className="btn peq" onClick={voltar} style={{ marginBottom: 10 }}>← Voltar</button>
      <section className="card">
        <h1>{concurso.nome} ({concurso.sigla})</h1>
        <p className="sub">{[concurso.banca && `Banca ${concurso.banca}`, concurso.orgao].filter(Boolean).join(' · ')}</p>
        <div className="linha">
          <button className="btn" onClick={() => abrirImportarProva(concurso.id, fase, area)}>📥 Importar prova</button>
          {podeEditar && <button className="btn" onClick={() => abrirEditarConcurso(concurso.id)}>✏️ Editar</button>}
          {podeEditar && !confirmar && <button className="btn perigo" onClick={() => setConfirmar(true)}>Excluir</button>}
          {confirmar && (
            <span className="linha" role="alert">
              <span>Excluir este concurso? Seu cronograma e progresso dele serão perdidos; as questões continuam no banco.</span>
              <button className="btn perigo" onClick={() => excluir(concurso.id)}>Sim, excluir</button>
              <button className="btn" onClick={() => setConfirmar(false)}>Cancelar</button>
            </span>
          )}
        </div>
        <div className="filtros" style={{ marginTop: 12 }}>
          {concurso.fases?.length > 0 && (
            <label className="campo">Fase que estou estudando
              <select value={fase} onChange={(e) => setPc({ fase: e.target.value, area: null })}>
                {concurso.fases.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>
            </label>
          )}
          {faseObj?.areas?.length > 0 && (
            <label className="campo">Minha área
              <select value={area} onChange={(e) => setPc({ area: e.target.value })}>
                <option value="" disabled>Escolha…</option>
                {faseObj.areas.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
              </select>
            </label>
          )}
          {concurso.cargos?.length > 1 && (
            <label className="campo">Meu cargo
              <select value={cargo} onChange={(e) => setPc({ cargo: e.target.value })}>
                {concurso.cargos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                <option value="ambos">Todos os cargos</option>
              </select>
            </label>
          )}
        </div>
      </section>

      <section className="card">
        <h2>📅 Datas importantes</h2>
        <ProximaData eventos={eventosDoConcurso(concurso)} />
        <Calendario eventos={eventosDoConcurso(concurso)} />
        {concurso.editalUrl && <p className="peq" style={{ marginTop: 10 }}><a href={concurso.editalUrl} target="_blank" rel="noreferrer">📄 Edital de abertura (PDF)</a></p>}
      </section>

      <section className="card">
        <h2>📋 Edital verticalizado{faseObj ? ` – ${faseObj.nome}` : ''}{faseObj?.areas?.find((a) => a.id === area) ? ` – ${faseObj.areas.find((a) => a.id === area).nome}` : ''}</h2>
        {faseObj?.areas?.length > 0 && !area ? (
          <p className="sub">Escolha a sua área acima para montar o edital verticalizado.</p>
        ) : (
          <EditalVerticalizado key={[concurso.id, fase, area].join('|')} ctx={ctx} concurso={concurso} cargo={cargo} fase={fase || null} area={area || null} />
        )}
      </section>

      {concurso.cargos?.map((c) => (
        <section key={c.id} className="card">
          <h2>{c.nome}</h2>
          <p>
            {c.vagas && <><b>Vagas:</b> {c.vagas}<br /></>}
            {c.remuneracao && <><b>Remuneração:</b> {c.remuneracao}<br /></>}
            {c.requisitos && <><b>Requisitos:</b> {c.requisitos}<br /></>}
            {c.horario && <><b>Horário:</b> {c.horario}</>}
          </p>
        </section>
      ))}
      {p?.blocos && (
        <section className="card">
          <h2>Prova objetiva</h2>
          <p>{p.totalQuestoes} questões · {p.totalPontos} pontos</p>
          <table>
            <thead><tr><th>Bloco</th><th>Questões</th><th>Peso</th><th>Mínimo</th></tr></thead>
            <tbody>
              {p.blocos.map((b) => (
                <tr key={b.nome}><td>{b.nome}</td><td>{b.questoes}</td><td>{b.peso}</td><td style={{ whiteSpace: 'normal' }}>{b.minimo}</td></tr>
              ))}
            </tbody>
          </table>
          <p style={{ marginTop: 8 }}><b>Aprovação:</b> {p.aprovacao}<br /><b>Discursiva:</b> {p.discursiva}</p>
        </section>
      )}
    </div>
  );
}
