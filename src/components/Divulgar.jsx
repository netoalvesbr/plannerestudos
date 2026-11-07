import { useState } from 'react';
import { ADMIN_EMAILS } from '../data/config.js';

// Compartilhar a plataforma e enviar sugestões ao responsável (aparece já na tela de entrada)
const LINK = typeof window !== 'undefined' ? window.location.origin : '';
const TEXTO = 'Estou usando o EstudaAí para estudar para concursos: banco de questões, cronograma, calendário de provas e mapas mentais. Crie sua conta grátis:';
const DESTINO = ADMIN_EMAILS[0];

export function Compartilhar() {
  const [copiado, setCopiado] = useState(false);
  const copiar = () =>
    navigator.clipboard?.writeText(LINK).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    });
  const msg = encodeURIComponent(`${TEXTO} ${LINK}`);
  return (
    <div>
      <p className="sub">Envie o link para amigos e colegas de estudo. Cada pessoa cria a própria conta e tem o próprio histórico.</p>
      <div className="linha">
        {navigator.share && <button type="button" className="btn pri" onClick={() => navigator.share({ title: 'EstudaAí', text: TEXTO, url: LINK }).catch(() => {})}>📤 Compartilhar…</button>}
        <a className="btn" href={`https://wa.me/?text=${msg}`} target="_blank" rel="noreferrer">💬 WhatsApp</a>
        <a className="btn" href={`https://t.me/share/url?url=${encodeURIComponent(LINK)}&text=${encodeURIComponent(TEXTO)}`} target="_blank" rel="noreferrer">✈️ Telegram</a>
        <a className="btn" href={`mailto:?subject=${encodeURIComponent('Conheça o EstudaAí')}&body=${msg}`}>✉️ E-mail</a>
        <button type="button" className="btn" onClick={copiar}>{copiado ? '✓ Link copiado' : '🔗 Copiar link'}</button>
      </div>
      <p className="peq sub" style={{ marginTop: 8, wordBreak: 'break-all' }}>{LINK}</p>
    </div>
  );
}

export function Sugestoes({ nomeInicial = '' }) {
  const [tipo, setTipo] = useState('Sugestão de melhoria');
  const [nome, setNome] = useState(nomeInicial);
  const [contato, setContato] = useState('');
  const [texto, setTexto] = useState('');
  const [enviado, setEnviado] = useState(false);
  const corpo = `${texto}\n\n---\nTipo: ${tipo}\nNome: ${nome || '(não informado)'}\nContato para resposta: ${contato || '(não informado)'}\nAparelho: ${navigator.userAgent}\nEnviado pelo EstudaAí (${LINK})`;
  const link = `mailto:${DESTINO}?subject=${encodeURIComponent(`[EstudaAí] ${tipo}`)}&body=${encodeURIComponent(corpo)}`;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!texto.trim()) return;
        window.location.href = link;
        setEnviado(true);
      }}
    >
      <p className="sub">Encontrou um erro ou tem uma ideia para melhorar a plataforma? Escreva abaixo: ao clicar em Enviar, o seu aplicativo de e-mail abre com a mensagem pronta para o responsável.</p>
      <div className="filtros">
        <label className="campo">Tipo
          <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option>Sugestão de melhoria</option>
            <option>Erro / problema</option>
            <option>Erro em questão</option>
            <option>Pedido de concurso ou matéria</option>
            <option>Elogio</option>
          </select>
        </label>
        <label className="campo">Seu nome (opcional)<input type="text" value={nome} onChange={(e) => setNome(e.target.value)} /></label>
        <label className="campo">E-mail ou WhatsApp para resposta (opcional)<input type="text" value={contato} onChange={(e) => setContato(e.target.value)} /></label>
      </div>
      <label className="campo" style={{ marginTop: 8 }}>Mensagem *
        <textarea rows="5" value={texto} onChange={(e) => setTexto(e.target.value)} required placeholder="Descreva a sugestão ou o problema. Se for erro, diga em qual tela aconteceu." style={{ width: '100%', padding: 8, borderRadius: 10, border: '1px solid var(--borda)', background: 'var(--card)', color: 'var(--txt)', font: 'inherit' }} />
      </label>
      <div className="linha" style={{ marginTop: 8 }}>
        <button className="btn pri" disabled={!texto.trim()}>✉️ Enviar</button>
        <button type="button" className="btn" disabled={!texto.trim()} onClick={() => navigator.clipboard?.writeText(`Para: ${DESTINO}\nAssunto: [EstudaAí] ${tipo}\n\n${corpo}`).then(() => setEnviado(true))}>📋 Copiar mensagem</button>
      </div>
      {enviado && <p className="aviso" role="status" style={{ background: 'var(--ok-bg)', color: 'var(--ok)', marginTop: 8 }}>✓ Obrigado! Se o e-mail não abriu, use "Copiar mensagem" e envie para {DESTINO}.</p>}
    </form>
  );
}

// Menu com as duas opções (tela de entrada e topo do site)
export default function MenuDivulgar({ nome, compacto = false }) {
  const [aberto, setAberto] = useState(null);
  return (
    <>
      <div className={compacto ? 'linha' : 'linha extras-entrada'}>
        <button type="button" className={`btn${compacto ? ' peq' : ''}`} aria-expanded={aberto === 'comp'} onClick={() => setAberto(aberto === 'comp' ? null : 'comp')}>🔗 Compartilhar</button>
        <button type="button" className={`btn${compacto ? ' peq' : ''}`} aria-expanded={aberto === 'sug'} onClick={() => setAberto(aberto === 'sug' ? null : 'sug')}>💡 Sugestões e melhorias</button>
      </div>
      {aberto && (
        <>
          <div className="pop-fundo" onClick={() => setAberto(null)} />
          <div className="pop" role="dialog" aria-label={aberto === 'comp' ? 'Compartilhar' : 'Sugestões e melhorias'} style={{ top: 70, left: '50%', right: 'auto', transform: 'translateX(-50%)', width: 'min(520px, calc(100vw - 24px))' }}>
            <div className="linha entre" style={{ alignItems: 'center', marginBottom: 6 }}>
              <h2 style={{ margin: 0 }}>{aberto === 'comp' ? '🔗 Compartilhar o EstudaAí' : '💡 Sugestões e melhorias'}</h2>
              <button type="button" className="crono-ic" onClick={() => setAberto(null)} aria-label="Fechar">✕</button>
            </div>
            {aberto === 'comp' ? <Compartilhar /> : <Sugestoes nomeInicial={nome} />}
          </div>
        </>
      )}
    </>
  );
}
