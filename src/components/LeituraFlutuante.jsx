// Janela flutuante da leitura em voz alta, no mesmo espírito do cronômetro: fica por cima
// de qualquer tela, pode ser recolhida, e deixa a pessoa continuar lendo enquanto navega
// pela plataforma. Quem guarda o estado é src/lib/sessaoLeitura.js — aqui só mostramos.
import { useEffect, useState } from 'react';
import * as sessao from '../lib/sessaoLeitura.js';
import { emMB } from '../lib/gravadorAudio.js';

const dois = (n) => String(n).padStart(2, '0');
const fmt = (seg) => {
  const s = Math.max(0, Math.round(seg));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}:${dois(m)}:${dois(s % 60)}` : `${dois(m)}:${dois(s % 60)}`;
};

const ROTULO = {
  lendo: ['🎙️ Ouvindo', 'var(--ok-bg)'],
  pausa: ['⏸ Em pausa (silêncio)', 'var(--alerta-bg)'],
  manual: ['⏸ Pausado por você', 'var(--alerta-bg)'],
  revisando: ['⏹ Terminada — falta guardar', 'var(--pri-claro)'],
};

export default function LeituraFlutuante({ aoAbrirTela }) {
  const [st, setSt] = useState(sessao.estado());
  const [mini, setMini] = useState(false);
  const [, redesenhar] = useState(0);

  useEffect(() => sessao.assinar(setSt), []);
  // redesenha de segundo em segundo para o "guardado há X" andar sozinho
  useEffect(() => {
    const t = setInterval(() => redesenhar((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, []);

  if (!st.ativa && st.fase !== 'revisando') return null;

  const [rotulo, cor] = ROTULO[st.fase] || ROTULO.lendo;
  const segSalvo = st.salvoEm ? Math.round((Date.now() - st.salvoEm) / 1000) : null;
  const palavras = sessao.palavrasDe();

  return (
    <section
      className={`crono${mini ? ' mini' : ''}`}
      style={{ left: 12, bottom: 12, top: 'auto', right: 'auto', cursor: 'default' }}
      aria-label="Leitura em voz alta em andamento"
    >
      <div className="crono-cab">
        <span style={{ flex: 1 }}>🎙️ Leitura</span>
        <button className="crono-ic" onClick={() => setMini(!mini)} aria-expanded={!mini} title={mini ? 'Expandir' : 'Recolher'}>
          {mini ? '▣' : '▢'}
        </button>
      </div>

      <span className="etiqueta" role="status" aria-live="polite" style={{ background: cor, marginBottom: 0, fontWeight: 700, fontSize: '0.78rem' }}>
        {rotulo}
      </span>

      {!mini && (
        <>
          <div className="crono-tempo" style={{ fontSize: '2rem' }}>{fmt(st.segLidos)}</div>
          <p className="sub peq" style={{ textAlign: 'center', margin: 0 }}>
            {palavras} palavra{palavras === 1 ? '' : 's'}
            {st.bytesAudio ? ` · ${emMB(st.bytesAudio)} MB` : ''}
            {st.cfg?.materia ? ` · ${st.cfg.materia}` : ''}
          </p>
        </>
      )}

      <div className="linha" style={{ gap: 6, justifyContent: 'center' }}>
        {st.fase === 'manual' && <button className="btn peq pri" onClick={sessao.retomarManual}>▶️ Retomar</button>}
        {(st.fase === 'lendo' || st.fase === 'pausa') && <button className="btn peq" onClick={sessao.pausarManual}>⏸ Pausar</button>}
        {st.ativa && <button className="btn peq" onClick={() => sessao.encerrar()}>⏹ Terminar</button>}
        <button className="btn peq" onClick={aoAbrirTela}>Abrir</button>
      </div>

      {!mini && (
        <p className="sub peq" style={{ textAlign: 'center', margin: 0 }} role="status">
          {st.salvando
            ? 'Guardando…'
            : st.erroSalvar
              ? `✗ ${st.erroSalvar}`
              : segSalvo == null
                ? 'Ainda não guardado'
                : `✓ Guardado ${segSalvo < 5 ? 'agora' : `há ${segSalvo}s`}`}
        </p>
      )}
    </section>
  );
}
