import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// Cronômetro flutuante: fica por cima de qualquer tela, pode ser arrastado e
// (no Chrome/Edge do computador) aberto numa janela própria que fica sempre visível,
// mesmo fora do navegador. O estado fica salvo no aparelho, então continua contando
// ao trocar de aba ou recarregar a página.

const CHAVE = 'estudaai.cronometro';
const EVENTO = 'estudaai:cronometro';
const PADRAO = { aberto: false, modo: 'livre', rodando: false, desde: 0, acumulado: 0, registrado: 0, x: null, y: null, mini: false, foco: 25, pausa: 5, etapa: 'foco', ciclos: 0, disciplina: '', tema: '' };

function ler() {
  try {
    return { ...PADRAO, ...JSON.parse(localStorage.getItem(CHAVE) || '{}') };
  } catch {
    return { ...PADRAO };
  }
}
function gravar(e) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(e));
  } catch {
    /* sem armazenamento: segue só na memória */
  }
}

// Abre o cronômetro já com uma matéria (usado no cronograma)
export function cronometrar(disciplina, tema = '') {
  window.dispatchEvent(new CustomEvent(EVENTO, { detail: { disciplina, tema } }));
}
export function alternarCronometro() {
  window.dispatchEvent(new CustomEvent(EVENTO, { detail: { alternar: true } }));
}

const fmt = (ms) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((n) => String(n).padStart(2, '0')).join(':');
};
const fmtCurto = (seg) => {
  const m = Math.round(seg / 60);
  return m >= 60 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}` : `${m} min`;
};

function bipe() {
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.35, 0.7].forEach((t) => {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.25, ac.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + t + 0.3);
      o.connect(g).connect(ac.destination);
      o.start(ac.currentTime + t);
      o.stop(ac.currentTime + t + 0.3);
    });
  } catch {
    /* sem áudio */
  }
}

export default function Cronometro({ materias = [], hojeSeg = 0, aoRegistrar }) {
  const [e, setE] = useState(ler);
  const [, tique] = useState(0);
  const [pip, setPip] = useState(null);
  const [cheia, setCheia] = useState(false);
  const caixa = useRef(null);
  const arrasto = useRef(null);
  const atual = useRef(e);
  atual.current = e;

  const mudar = useCallback((f) => {
    setE((v) => {
      const n = { ...v, ...(typeof f === 'function' ? f(v) : f) };
      gravar(n);
      return n;
    });
  }, []);

  const decorrido = (v = atual.current) => v.acumulado + (v.rodando ? Date.now() - v.desde : 0);
  const duracao = (v) => (v.etapa === 'foco' ? v.foco : v.pausa) * 60000;

  // registra o tempo estudado (só o tempo de foco) que ainda não foi salvo
  const registrarPendente = useCallback(
    (v) => {
      if (v.modo === 'pomodoro' && v.etapa !== 'foco') return 0;
      const ms = decorrido(v) - v.registrado;
      if (ms >= 1000) aoRegistrar?.(v.disciplina || 'Sem matéria definida', Math.round(ms / 1000));
      return Math.max(0, ms);
    },
    [aoRegistrar],
  );

  // pedidos vindos de outras telas
  useEffect(() => {
    const ouvir = (ev) => {
      const d = ev.detail || {};
      if (d.alternar) return mudar((v) => ({ aberto: !v.aberto }));
      const v = atual.current;
      if (v.rodando && v.disciplina && v.disciplina !== d.disciplina) {
        // troca de matéria: salva o tempo da anterior e começa do zero
        registrarPendente(v);
        mudar({ aberto: true, disciplina: d.disciplina, tema: d.tema, acumulado: 0, registrado: 0, desde: Date.now(), etapa: 'foco' });
      } else mudar({ aberto: true, disciplina: d.disciplina, tema: d.tema });
    };
    window.addEventListener(EVENTO, ouvir);
    return () => window.removeEventListener(EVENTO, ouvir);
  }, [mudar, registrarPendente]);

  // atualiza o mostrador e troca a etapa do Pomodoro quando o tempo acaba
  useEffect(() => {
    if (!e.rodando) return undefined;
    const id = setInterval(() => {
      const v = atual.current;
      if (v.modo === 'pomodoro' && decorrido(v) >= duracao(v)) {
        if (v.etapa === 'foco') aoRegistrar?.(v.disciplina || 'Sem matéria definida', Math.round((duracao(v) - v.registrado) / 1000));
        bipe();
        try {
          if (window.Notification?.permission === 'granted') new Notification(v.etapa === 'foco' ? 'Hora da pausa ☕' : 'Hora de voltar a estudar 📚');
        } catch {
          /* sem notificação */
        }
        mudar({ etapa: v.etapa === 'foco' ? 'pausa' : 'foco', ciclos: v.etapa === 'foco' ? v.ciclos + 1 : v.ciclos, acumulado: 0, registrado: 0, desde: Date.now() });
      }
      tique((t) => t + 1);
    }, 500);
    return () => clearInterval(id);
  }, [e.rodando, mudar, aoRegistrar]);

  // mantém o cronômetro dentro da tela ao redimensionar
  useEffect(() => {
    const ajustar = () => mudar((v) => (v.x == null ? {} : { x: Math.min(v.x, window.innerWidth - 80), y: Math.min(v.y, window.innerHeight - 60) }));
    window.addEventListener('resize', ajustar);
    return () => window.removeEventListener('resize', ajustar);
  }, [mudar]);

  useEffect(() => {
    const f = () => setCheia(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', f);
    return () => document.removeEventListener('fullscreenchange', f);
  }, []);

  const iniciar = () => {
    if (window.Notification?.permission === 'default' && e.modo === 'pomodoro') Notification.requestPermission().catch(() => {});
    mudar({ rodando: true, desde: Date.now() });
  };
  const pausar = () => {
    const v = atual.current;
    const ms = registrarPendente(v);
    const ac = decorrido(v);
    mudar({ rodando: false, acumulado: ac, registrado: v.registrado + ms });
  };
  const zerar = () => {
    registrarPendente(atual.current);
    mudar({ rodando: false, acumulado: 0, registrado: 0, desde: 0, etapa: 'foco' });
  };
  const trocarModo = (modo) => {
    registrarPendente(atual.current);
    mudar({ modo, rodando: false, acumulado: 0, registrado: 0, etapa: 'foco', ciclos: 0 });
  };

  // arrastar com mouse ou dedo
  const aoApertar = (ev) => {
    if (pip || ev.target.closest('button, select, input')) return;
    const r = caixa.current.getBoundingClientRect();
    arrasto.current = { dx: ev.clientX - r.left, dy: ev.clientY - r.top };
    ev.currentTarget.setPointerCapture?.(ev.pointerId);
  };
  const aoMover = (ev) => {
    if (!arrasto.current) return;
    const r = caixa.current.getBoundingClientRect();
    const x = Math.min(Math.max(0, ev.clientX - arrasto.current.dx), window.innerWidth - r.width);
    const y = Math.min(Math.max(0, ev.clientY - arrasto.current.dy), window.innerHeight - r.height);
    caixa.current.style.left = `${x}px`;
    caixa.current.style.top = `${y}px`;
    caixa.current.style.right = 'auto';
    caixa.current.style.bottom = 'auto';
  };
  const aoSoltar = () => {
    if (!arrasto.current) return;
    arrasto.current = null;
    const r = caixa.current.getBoundingClientRect();
    mudar({ x: Math.round(r.left), y: Math.round(r.top) });
  };
  const mover = (dx, dy) => {
    const r = caixa.current.getBoundingClientRect();
    mudar({ x: Math.min(Math.max(0, r.left + dx), window.innerWidth - r.width), y: Math.min(Math.max(0, r.top + dy), window.innerHeight - r.height) });
  };
  const teclas = (ev) => {
    const passo = ev.shiftKey ? 50 : 15;
    const m = { ArrowLeft: [-passo, 0], ArrowRight: [passo, 0], ArrowUp: [0, -passo], ArrowDown: [0, passo] }[ev.key];
    if (m && ev.target === ev.currentTarget) {
      ev.preventDefault();
      mover(...m);
    }
  };

  // janela flutuante própria (Picture-in-Picture de documento: Chrome e Edge no computador)
  const temJanela = typeof window !== 'undefined' && 'documentPictureInPicture' in window;
  async function abrirJanela() {
    try {
      const w = await window.documentPictureInPicture.requestWindow({ width: 320, height: 230 });
      for (const ss of [...document.styleSheets]) {
        try {
          const st = w.document.createElement('style');
          st.textContent = [...ss.cssRules].map((r) => r.cssText).join('\n');
          w.document.head.appendChild(st);
        } catch {
          if (ss.href) {
            const l = w.document.createElement('link');
            l.rel = 'stylesheet';
            l.href = ss.href;
            w.document.head.appendChild(l);
          }
        }
      }
      w.document.documentElement.dataset.tema = document.documentElement.dataset.tema;
      w.document.title = 'Cronômetro – EstudaAí';
      w.document.body.className = 'pip-corpo';
      w.addEventListener('pagehide', () => setPip(null));
      setPip(w);
    } catch {
      /* janela não autorizada: segue o cronômetro na página */
    }
  }
  const fecharJanela = () => pip?.close();
  useEffect(() => {
    if (pip) pip.document.documentElement.dataset.tema = document.documentElement.dataset.tema;
  });

  const telaCheia = () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else caixa.current?.requestFullscreen?.().catch(() => {});
  };

  if (!e.aberto && !pip) return null;

  const ms = decorrido(e);
  const pomodoro = e.modo === 'pomodoro';
  const mostrar = pomodoro ? duracao(e) - ms : ms;
  const pendente = !pomodoro || e.etapa === 'foco' ? Math.max(0, ms - e.registrado) / 1000 : 0;
  const totalHoje = hojeSeg + pendente;
  const opcoes = [...new Set([...materias, ...(e.disciplina ? [e.disciplina] : [])])];
  const estado = e.rodando ? 'contando' : ms > 0 ? 'pausado' : 'parado';

  const corpo = (
    <>
      <div className="crono-cab">
        <span className="crono-tit">⏱ {pomodoro ? (e.etapa === 'foco' ? 'Foco' : 'Pausa ☕') : 'Cronômetro'}</span>
        {!pip && <span className="crono-alca" aria-hidden="true" title="Arraste para mover">⠿</span>}
        <span style={{ flex: 1 }} />
        {!pip && <button className="crono-ic" onClick={() => mudar({ mini: !e.mini })} aria-label={e.mini ? 'Expandir cronômetro' : 'Minimizar cronômetro'} title={e.mini ? 'Expandir' : 'Minimizar'}>{e.mini ? '▢' : '–'}</button>}
        {pip ? (
          <button className="crono-ic" onClick={fecharJanela} aria-label="Voltar o cronômetro para a página" title="Voltar para a página">⇲</button>
        ) : (
          <button className="crono-ic" onClick={() => mudar({ aberto: false })} aria-label="Fechar cronômetro (continua contando)" title="Fechar (continua contando)">✕</button>
        )}
      </div>
      <div className={`crono-tempo${e.rodando ? ' rodando' : ''}`} role="timer" aria-live="off" aria-label={`${fmt(mostrar)}, ${estado}`}>{fmt(mostrar)}</div>
      {!e.mini || pip ? (
        <>
          <div className="crono-botoes">
            {e.rodando ? (
              <button className="btn peq pri" onClick={pausar}>⏸ Pausar</button>
            ) : (
              <button className="btn peq pri" onClick={iniciar}>▶ {ms > 0 ? 'Continuar' : 'Iniciar'}</button>
            )}
            <button className="btn peq" onClick={zerar} disabled={!ms && !e.rodando} title="Salva o tempo e zera">⟲ Zerar</button>
            {!pip && temJanela && <button className="btn peq" onClick={abrirJanela} title="Abre o cronômetro numa janela que fica sempre visível, até fora do navegador">⧉ Janela</button>}
            {!pip && <button className="btn peq" onClick={telaCheia} aria-label={cheia ? 'Sair da tela cheia' : 'Tela cheia'}>{cheia ? '🗗' : '⛶'}</button>}
          </div>
          <div className="crono-linha">
            <div className="abas crono-modos" role="tablist" aria-label="Tipo de contagem">
              <button role="tab" aria-selected={!pomodoro} onClick={() => trocarModo('livre')}>Livre</button>
              <button role="tab" aria-selected={pomodoro} onClick={() => trocarModo('pomodoro')}>🍅 Pomodoro</button>
            </div>
          </div>
          {pomodoro && (
            <div className="crono-linha peq">
              <label>Foco <input type="number" min="5" max="120" value={e.foco} disabled={e.rodando} onChange={(ev) => mudar({ foco: Math.max(1, +ev.target.value || 25) })} /> min</label>
              <label>Pausa <input type="number" min="1" max="60" value={e.pausa} disabled={e.rodando} onChange={(ev) => mudar({ pausa: Math.max(1, +ev.target.value || 5) })} /> min</label>
              <span className="sub">🍅 {e.ciclos}</span>
            </div>
          )}
          <label className="crono-linha peq">
            <span>Matéria</span>
            <select value={e.disciplina} onChange={(ev) => cronometrar(ev.target.value)}>
              <option value="">— escolha —</option>
              {opcoes.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>
          {e.tema && <div className="peq sub crono-tema" title={e.tema}>{e.tema}</div>}
          <div className="peq sub">Estudado hoje: <b>{fmtCurto(totalHoje)}</b></div>
        </>
      ) : (
        <div className="crono-botoes">
          {e.rodando ? <button className="btn peq pri" onClick={pausar} aria-label="Pausar">⏸</button> : <button className="btn peq pri" onClick={iniciar} aria-label="Iniciar">▶</button>}
          <button className="btn peq" onClick={zerar} aria-label="Zerar">⟲</button>
        </div>
      )}
    </>
  );

  if (pip) return createPortal(<div className="crono crono-pip">{corpo}</div>, pip.document.body);

  const pos = e.x == null ? { right: 12, bottom: 84 } : { left: e.x, top: e.y };
  return (
    <div
      ref={caixa}
      className={`crono${e.mini ? ' mini' : ''}${cheia ? ' cheia' : ''}`}
      style={pos}
      role="dialog"
      aria-label="Cronômetro de estudo (arraste para mover; com o foco aqui, use as setas do teclado)"
      tabIndex={0}
      onKeyDown={teclas}
      onPointerDown={aoApertar}
      onPointerMove={aoMover}
      onPointerUp={aoSoltar}
      onPointerCancel={aoSoltar}
    >
      {corpo}
    </div>
  );
}
