// Página "Opiniões e melhorias": a pessoa conta o que achou, o que travou e o que quer que exista.
// Em modo conta vai para o banco (tabela sugestoes); em modo local fica guardado no aparelho
// e a pessoa pode mandar o mesmo texto por e-mail com um clique.
import { useEffect, useState } from 'react';
import { enviarSugestao, minhasSugestoes } from '../lib/remoto.js';
import { CONTATO } from '../data/config.js';

const TIPOS = [
  ['sugestao', '💡', 'Sugestão de melhoria', 'Algo que você gostaria que a plataforma fizesse.'],
  ['problema', '🐞', 'Problema ou erro', 'Alguma coisa que não funcionou, travou ou mostrou dado errado.'],
  ['duvida', '❓', 'Dúvida', 'Não achou onde fica, não entendeu como usar.'],
  ['elogio', '👍', 'Elogio', 'O que está funcionando bem e você não quer que mude.'],
];

const SITUACOES = {
  nova: ['Recebida', 'var(--pri-claro)'],
  lendo: ['Em análise', 'var(--alerta-bg)'],
  feita: ['✓ Atendida', 'var(--ok-bg)'],
  arquivada: ['Arquivada', 'var(--borda)'],
};

const fmt = (d) => (d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');

export default function Opinioes({ ctx = {} }) {
  const [tipo, setTipo] = useState('sugestao');
  const [texto, setTexto] = useState('');
  const [nota, setNota] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [aviso, setAviso] = useState(null);
  const [lista, setLista] = useState([]);

  const carregar = () => minhasSugestoes().then(setLista).catch(() => setLista([]));
  useEffect(() => { carregar(); }, []);

  const enviar = async (e) => {
    e.preventDefault();
    setEnviando(true);
    setAviso(null);
    try {
      const r = await enviarSugestao({ tipo, texto, nota: nota || null, tela: ctx?.telaAtual || null });
      setTexto('');
      setNota(0);
      setAviso({
        ok: true,
        texto: r.local
          ? '✓ Guardado neste aparelho. Como você está sem conta, use o botão abaixo para me mandar por e-mail.'
          : '✓ Recebido, obrigado! Vou ler tudo. Se precisar de resposta, eu escrevo no seu e-mail.',
      });
      carregar();
    } catch (err) {
      setAviso({ ok: false, texto: err.message });
    } finally {
      setEnviando(false);
    }
  };

  const assunto = encodeURIComponent(`EstudaAí – ${TIPOS.find((t) => t[0] === tipo)?.[2] || 'recado'}`);
  const corpo = encodeURIComponent(texto || '');

  return (
    <div>
      <h1>Opiniões e melhorias</h1>
      <p className="sub">
        A plataforma é feita por uma pessoa só, estudando para concurso igual a você. O que você escreve aqui
        é lido de verdade e entra na fila do que vai ser construído. Não precisa escrever bonito.
      </p>

      <form className="card" onSubmit={enviar}>
        <fieldset style={{ border: 0, padding: 0, margin: '0 0 12px' }}>
          <legend className="campo" style={{ marginBottom: 6 }}>Sobre o que é o seu recado?</legend>
          <div className="filtros">
            {TIPOS.map(([v, ico, rot, ajuda]) => (
              <label
                key={v}
                className="card"
                style={{
                  margin: 0, padding: 10, cursor: 'pointer',
                  borderColor: tipo === v ? 'var(--pri)' : 'var(--borda)',
                  borderWidth: 2, background: tipo === v ? 'var(--pri-claro)' : 'var(--card)',
                }}
              >
                <span className="linha" style={{ gap: 6 }}>
                  <input type="radio" name="tipo" value={v} checked={tipo === v} onChange={() => setTipo(v)} style={{ width: 'auto', minHeight: 0 }} />
                  <b style={{ fontSize: '0.92rem' }}>{ico} {rot}</b>
                </span>
                <span className="sub peq" style={{ display: 'block', marginTop: 4 }}>{ajuda}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="campo" htmlFor="sug-texto">
          Escreva aqui
          {tipo === 'problema' && ' — se der, conte em que tela aconteceu e o que você tinha clicado antes'}
        </label>
        <textarea
          id="sug-texto"
          rows={6}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={tipo === 'problema'
            ? 'Ex.: no cronograma, quando eu marco domingo com 6 horas, ele não distribui as matérias.'
            : 'Ex.: seria bom poder marcar uma questão como "revisar depois da prova".'}
          style={{ marginBottom: 12 }}
        />

        <div style={{ marginBottom: 12 }}>
          <span className="campo">Nota para a plataforma hoje (opcional)</span>
          <div className="linha" role="radiogroup" aria-label="Nota de 1 a 5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                type="button"
                key={n}
                className="btn peq"
                aria-pressed={nota === n}
                onClick={() => setNota(nota === n ? 0 : n)}
                style={nota === n ? { background: 'var(--pri)', color: 'var(--pri-txt)', borderColor: 'var(--pri)' } : undefined}
              >
                {n} {n === 1 ? 'ruim' : n === 5 ? 'ótima' : ''}
              </button>
            ))}
            {nota > 0 && <span className="sub peq">Nota escolhida: {nota} de 5</span>}
          </div>
        </div>

        {aviso && (
          <p
            className="aviso"
            role="status"
            style={aviso.ok ? { background: 'var(--ok-bg)', color: 'var(--ok)' } : { background: 'var(--erro-bg)', color: 'var(--erro)' }}
          >
            {aviso.ok ? '' : '✗ '}{aviso.texto}
          </p>
        )}

        <div className="linha">
          <button className="btn pri" type="submit" disabled={enviando || texto.trim().length < 5}>
            {enviando ? 'Enviando…' : 'Enviar'}
          </button>
          <a className="btn" href={`mailto:${CONTATO.email}?subject=${assunto}&body=${corpo}`}>
            Mandar por e-mail
          </a>
        </div>
        <p className="sub peq" style={{ marginBottom: 0 }}>
          Resposta em {CONTATO.prazoResposta}. Nada do que você escreve aqui é publicado com o seu nome.
        </p>
      </form>

      <h2>O que você já me mandou</h2>
      {!lista.length && <p className="sub">Nada ainda. O que você enviar aparece aqui com a situação de cada pedido.</p>}
      {lista.map((s) => {
        const [rot, cor] = SITUACOES[s.situacao] || SITUACOES.nova;
        const t = TIPOS.find((x) => x[0] === s.tipo);
        return (
          <div className="card" key={s.id}>
            <div className="linha entre">
              <b>{t?.[1]} {t?.[2] || s.tipo}</b>
              <span className="etiqueta" style={{ background: cor, marginBottom: 0 }}>{rot}</span>
            </div>
            <p style={{ whiteSpace: 'pre-line', margin: '8px 0' }}>{s.texto}</p>
            {s.resposta && (
              <p className="card" style={{ margin: 0, background: 'var(--pri-claro)' }}>
                <b>Resposta:</b> {s.resposta}
              </p>
            )}
            <p className="sub peq" style={{ marginBottom: 0 }}>Enviado em {fmt(s.criado_em)}{s.nota ? ` · nota ${s.nota} de 5` : ''}</p>
          </div>
        );
      })}
    </div>
  );
}
