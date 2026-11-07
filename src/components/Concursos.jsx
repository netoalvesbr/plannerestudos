import { useState } from 'react';
import { todosConcursos } from '../data/concursos.js';
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
          <button className="btn" onClick={() => abrirImportarProva()}>📥 Importar prova anterior</button>
        </div>
      </div>
      <p className="sub">
        Todos os concursos cadastrados na plataforma aparecem aqui. Clique em <b>+ Acompanhar</b> nos que você vai estudar (e escolha a fase, se houver).
        O banco de questões e os editais são compartilhados por todos; o seu desempenho é só seu.
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
                    <button className="btn pri" disabled={prefs.ativo === c.id} onClick={() => setPrefs({ ativo: c.id })}>
                      {prefs.ativo === c.id ? '✓ Ativo' : 'Estudar este'}
                    </button>
                    <button className="btn peq" onClick={() => setPrefs({ seguindo: seguindo.filter((x) => x !== c.id), ativo: prefs.ativo === c.id ? seguindo.find((x) => x !== c.id) || null : prefs.ativo })}>
                      Deixar de acompanhar
                    </button>
                  </>
                ) : (
                  <button className="btn pri" onClick={() => setPrefs({ seguindo: [...seguindo, c.id], ativo: c.id })}>+ Acompanhar</button>
                )}
                <button className="btn peq" onClick={() => abrirFicha(c.id)}>Ficha e edital</button>
              </div>
              {c.remoto && c.criadoPor === usuario?.id && <p className="peq sub" style={{ marginTop: 6 }}>Cadastrado por você</p>}
            </div>
          );
        })}
      </div>
      {!lista.length && <p className="card sub">Nenhum concurso encontrado. Use <b>+ Adicionar concurso</b> para cadastrar.</p>}
    </div>
  );
}

export function EscolhaArea({ concurso, fase, aoEscolher }) {
  return (
    <section className="card login">
      <h1>{concurso.sigla} · {fase.nome}: qual é a sua área?</h1>
      <p className="sub">Você vai estudar só o conteúdo da área escolhida (direito material e processual correspondente). Dá para trocar depois na ficha do concurso.</p>
      <div className="escolha">
        {fase.areas.map((a) => (
          <button key={a.id} className="card bloco-card" onClick={() => aoEscolher(a.id)}>
            <h2>{a.nome}</h2>
          </button>
        ))}
      </div>
    </section>
  );
}

export function EscolhaFase({ concurso, aoEscolher }) {
  return (
    <section className="card login">
      <h1>{concurso.sigla}: qual fase você vai estudar?</h1>
      <p className="sub">As disciplinas e as questões seguem esta escolha. Você pode trocar depois na ficha do concurso.</p>
      <div className="escolha">
        {concurso.fases.map((f) => (
          <button key={f.id} className="card bloco-card" onClick={() => aoEscolher(f.id)}>
            <h2>{f.nome}</h2>
            <p className="sub">{{ 'A-E': 'Múltipla escolha (A a E)', 'A-D': 'Múltipla escolha (A a D)', CE: 'Certo ou Errado', discursiva: 'Discursiva / peça' }[f.formato] || ''}{f.data ? ` · ${fmtData(f.data)}` : ''}</p>
          </button>
        ))}
      </div>
    </section>
  );
}

export function EscolhaCargo({ concurso, aoEscolher }) {
  return (
    <section className="card login">
      <h1>{concurso.sigla}: qual cargo?</h1>
      <p className="sub">Os conhecimentos específicos exibidos seguem esta escolha. Você pode mudar depois na ficha do concurso.</p>
      <div className="escolha">
        {concurso.cargos.map((c) => (
          <button key={c.id} className="card bloco-card" onClick={() => aoEscolher(c.id)}>
            <h2>{c.nome}</h2>
            <p className="sub">{c.horario}</p>
          </button>
        ))}
        <button className="card bloco-card" onClick={() => aoEscolher('ambos')}>
          <h2>Os dois cargos</h2>
          <p className="sub">Mostra os específicos de todos os cargos.</p>
        </button>
      </div>
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
        <p className="sub">{[concurso.edital, concurso.banca && `Banca ${concurso.banca}`, concurso.orgao].filter(Boolean).join(' · ')}</p>
        <div className="linha">
          {concurso.editalUrl && <a className="btn" href={concurso.editalUrl} target="_blank" rel="noreferrer">📄 Abrir edital (PDF)</a>}
          <button className="btn" onClick={() => abrirImportarProva(concurso.id, fase, area)}>📥 Importar prova deste concurso</button>
          {podeEditar && <button className="btn" onClick={() => abrirEditarConcurso(concurso.id)}>✏️ Editar</button>}
          {podeEditar && !confirmar && <button className="btn perigo" onClick={() => setConfirmar(true)}>Excluir</button>}
          {confirmar && (
            <span className="linha" role="alert">
              <span>Excluir este concurso para todos? As questões continuam no banco.</span>
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
        <h2>📋 Edital verticalizado</h2>
        {!totalT ? (
          <>
            <p className="sub">
              O edital deste concurso ainda não foi importado, por isso não há os tópicos do conteúdo programático.
              {podeEditar ? ' Use "✏️ Editar" e importe o PDF do edital para gerar o edital verticalizado completo.' : ' Quem cadastrou o concurso pode importar o PDF do edital.'}
            </p>
            {discs.length > 0 && (
              <>
                <p><b>✨ Sugestão de edital verticalizado</b> <span className="sub">(por disciplina, a partir das matérias cadastradas)</span>: {feitosD} de {discs.length} concluídas</p>
                <div className="barra" aria-hidden="true"><i style={{ width: `${(feitosD / discs.length) * 100}%` }} /></div>
                <ul style={{ listStyle: 'none', paddingLeft: 4 }}>
                  {discs.map((d) => (
                    <li key={d.nome} style={{ margin: '6px 0' }}>
                      <label className="linha" style={{ gap: 8, flexWrap: 'nowrap' }}>
                        <input type="checkbox" checked={(marcados.__disciplinas || []).includes(d.nome)} onChange={() => marcarDisc(d.nome)} />
                        <span>{d.nome}{d.bloco ? <span className="sub peq"> · {d.bloco}</span> : null}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </>
        ) : (
          <>
            <p className="sub">Marque os tópicos que você já estudou. Progresso: <b>{feitosT} de {totalT}</b> ({Math.round((feitosT / totalT) * 100)}%)</p>
            <div className="barra" aria-hidden="true"><i style={{ width: `${(feitosT / totalT) * 100}%` }} /></div>
            {discs.filter((d) => d.topicos?.length).map((d) => {
              const feitos = (marcados[d.nome] || []).filter((i) => i < d.topicos.length).length;
              return (
                <details key={d.nome} style={{ borderTop: '1px solid var(--borda)', padding: '8px 0' }}>
                  <summary>
                    <b>{d.nome}</b> <span className="sub peq">{d.bloco ? `· ${d.bloco} ` : ''}· {feitos}/{d.topicos.length} {feitos === d.topicos.length ? '✓' : ''}</span>
                  </summary>
                  <ul style={{ listStyle: 'none', paddingLeft: 4, margin: '8px 0 0' }}>
                    {d.topicos.map((t, i) => (
                      <li key={i} style={{ margin: '4px 0' }}>
                        <label className="linha" style={{ gap: 8, alignItems: 'flex-start', flexWrap: 'nowrap' }}>
                          <input type="checkbox" checked={(marcados[d.nome] || []).includes(i)} onChange={() => marcar(d.nome, i)} style={{ marginTop: 4 }} />
                          <span>{t}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </details>
              );
            })}
          </>
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
      {concurso.cronograma?.length > 0 && (
        <section className="card">
          <h2>Datas importantes</h2>
          <table>
            <tbody>
              {concurso.cronograma.map((e, i) => (
                <tr key={i}>
                  <td>{e.evento}</td>
                  <td>{fmtData(e.data)}{e.fim ? ` a ${fmtData(e.fim)}` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
