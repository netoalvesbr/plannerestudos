import { useState } from 'react';
import { CONCURSOS } from '../data/concursos.js';
import { questoesDo } from '../lib/dados.js';
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
  const { prefs, setPrefs, respostas, abrirFicha } = ctx;
  const seguindo = prefs.seguindo || [];
  return (
    <div>
      <h1>Meus concursos</h1>
      <p className="sub">Escolha os concursos que você acompanha. O concurso ativo define o que aparece nas outras telas.</p>
      <div className="grade">
        {CONCURSOS.map((c) => {
          const seg = seguindo.includes(c.id);
          const cargo = prefs.concursos?.[c.id]?.cargo || 'ambos';
          const s = resumo(questoesDo(c.id, cargo), respostas);
          const faltam = diasAte(c.dataProva);
          return (
            <div key={c.id} className="card">
              <h2>{c.sigla} – {c.nome}</h2>
              <p className="sub">
                {c.banca} · {c.cargos.map((x) => x.nome).join(' / ')}
                <br />
                Prova em {fmtData(c.dataProva)} {faltam >= 0 && <span className="contagem">· faltam {faltam} dias</span>}
              </p>
              {seg && <p>Acerto geral: <b>{fmtPct(s.pct)}</b> <span className="sub">({s.resolvidas} resolvidas)</span></p>}
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
                <button className="btn peq" onClick={() => abrirFicha(c.id)}>Ficha do concurso</button>
              </div>
            </div>
          );
        })}
      </div>
      <p className="sub" style={{ marginTop: 14 }}>Novos concursos serão acrescentados aqui, sem mudar o link.</p>
    </div>
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

export function Ficha({ concurso, cargo, aoTrocarCargo, voltar }) {
  const p = concurso.prova;
  return (
    <div>
      <button className="btn peq" onClick={voltar} style={{ marginBottom: 10 }}>← Voltar</button>
      <section className="card">
        <h1>{concurso.nome} ({concurso.sigla})</h1>
        <p className="sub">{concurso.edital} · Banca {concurso.banca}</p>
        <label className="campo" style={{ maxWidth: 360 }}>
          Meu cargo
          <select value={cargo} onChange={(e) => aoTrocarCargo(e.target.value)}>
            {concurso.cargos.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            <option value="ambos">Os dois cargos</option>
          </select>
        </label>
      </section>
      {concurso.cargos.map((c) => (
        <section key={c.id} className="card">
          <h2>{c.nome}</h2>
          <p>
            <b>Vagas:</b> {c.vagas}<br />
            <b>Remuneração:</b> {c.remuneracao}<br />
            <b>Requisitos:</b> {c.requisitos}<br />
            <b>Horário:</b> {c.horario}
          </p>
        </section>
      ))}
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
      <section className="card">
        <h2>Cronograma</h2>
        <table>
          <tbody>
            {concurso.cronograma.map((e) => (
              <tr key={e.evento}>
                <td>{e.evento}</td>
                <td>{fmtData(e.data)}{e.fim ? ` a ${fmtData(e.fim)}` : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function IconeGoogle() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

function IconeMicrosoft() {
  return (
    <svg width="18" height="18" viewBox="0 0 23 23" aria-hidden="true">
      <path fill="#f35325" d="M1 1h10v10H1z" />
      <path fill="#81bc06" d="M12 1h10v10H12z" />
      <path fill="#05a6f0" d="M1 12h10v10H1z" />
      <path fill="#ffba08" d="M12 12h10v10H12z" />
    </svg>
  );
}
