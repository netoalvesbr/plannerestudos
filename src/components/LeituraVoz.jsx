// 🎙️ Leitura em voz alta: a pessoa lê o livro em voz alta e a plataforma transcreve e
// cronometra. O cronômetro conta só o tempo em que ela está realmente lendo: no silêncio
// ele pausa sozinho e, quando a leitura volta, ele retoma — sem precisar clicar em nada.
//
// A conta do tempo (ver o relógio de 1 segundo, mais abaixo):
//  - a cada segundo lendo, soma 1 segundo ao tempo de leitura;
//  - quando o silêncio passa do limite escolhido, devolve esses segundos de silêncio que
//    já tinham sido somados e marca a pausa — o tempo de leitura fica honesto;
//  - o tempo total da sessão (relógio de parede) continua correndo, para a pessoa comparar
//    quanto tempo ficou sentada e quanto tempo de fato leu.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { disciplinasDo } from '../lib/dados.js';
import { minhasLeituras, salvarLeitura, excluirLeitura } from '../lib/remoto.js';
import {
  TEXTO_ERRO, TEXTO_SUPORTE, arrumarTrecho, contarPalavras, criarLeitor, porMinuto, suporteVoz,
} from '../lib/vozLeitura.js';

const LIMIARES = [
  [10, '10 segundos'],
  [20, '20 segundos'],
  [30, '30 segundos'],
  [60, '1 minuto'],
  [120, '2 minutos'],
];

const dois = (n) => String(n).padStart(2, '0');
export const fmtTempo = (seg) => {
  const s = Math.max(0, Math.round(seg));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}:${dois(m)}:${dois(s % 60)}` : `${dois(m)}:${dois(s % 60)}`;
};
const fmtDH = (d) => (d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');
const agora = () => Date.now();
const horaCurta = (t) => new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

export default function LeituraVoz({ ctx }) {
  const { concurso, cargo, fase, area, prefs, setPrefs } = ctx;
  const materias = useMemo(
    () => (concurso ? disciplinasDo(concurso.id, cargo, fase, area).map((d) => d.nome) : []),
    [concurso, cargo, fase, area],
  );

  const salvo = prefs.leituraVoz || {};
  const [materia, setMateria] = useState(salvo.materia || materias[0] || '');
  const [assunto, setAssunto] = useState('');
  const [obra, setObra] = useState(salvo.obra || '');
  const [paginaIni, setPaginaIni] = useState('');
  const [paginaFim, setPaginaFim] = useState('');
  const [limiar, setLimiar] = useState(salvo.limiar || 20);

  const [estado, setEstado] = useState('parado'); // parado | lendo | pausa | revisando
  const [trechos, setTrechos] = useState([]);
  const [parcial, setParcial] = useState('');
  const [texto, setTexto] = useState(''); // texto revisável depois de terminar
  const [segLidos, setSegLidos] = useState(0);
  const [segTotais, setSegTotais] = useState(0);
  const [pausas, setPausas] = useState([]);
  const [erro, setErro] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [leituras, setLeituras] = useState([]);
  const [aberta, setAberta] = useState(null);

  const leitorRef = useRef(null);
  const estadoRef = useRef('parado');
  const ultimaFalaRef = useRef(0);
  const inicioRef = useRef(0);
  const segLidosRef = useRef(0);
  const pausaAtualRef = useRef(null);
  const fimTranscricaoRef = useRef(null);

  const suporte = useMemo(suporteVoz, []);
  const carregarHistorico = useCallback(() => {
    minhasLeituras({ limite: 30 }).then(setLeituras).catch(() => setLeituras([]));
  }, []);
  useEffect(carregarHistorico, [carregarHistorico]);

  // guarda matéria, obra e limite de silêncio para a próxima sessão
  useEffect(() => {
    if (estado === 'parado') return;
    setPrefs({ leituraVoz: { materia, obra, limiar } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado]);

  const mudarEstado = (novo) => {
    estadoRef.current = novo;
    setEstado(novo);
  };

  // ----- relógio de 1 segundo: é ele que pausa e retoma o cronômetro -----
  useEffect(() => {
    if (estado !== 'lendo' && estado !== 'pausa') return undefined;
    const t = setInterval(() => {
      setSegTotais(Math.round((agora() - inicioRef.current) / 1000));
      if (estadoRef.current === 'lendo') {
        segLidosRef.current += 1;
        setSegLidos(segLidosRef.current);
        // silêncio passou do limite: era pausa, não leitura
        if (agora() - ultimaFalaRef.current > limiar * 1000) {
          segLidosRef.current = Math.max(0, segLidosRef.current - limiar);
          setSegLidos(segLidosRef.current);
          pausaAtualRef.current = { inicio: ultimaFalaRef.current };
          mudarEstado('pausa');
        }
      }
    }, 1000);
    return () => clearInterval(t);
  }, [estado, limiar]);

  // fala detectada: se estava em pausa, retoma sozinho
  const marcarFala = () => {
    ultimaFalaRef.current = agora();
    if (estadoRef.current === 'pausa') {
      const p = pausaAtualRef.current;
      if (p) {
        const seg = Math.round((agora() - p.inicio) / 1000);
        if (seg >= limiar) setPausas((v) => [...v, { ...p, fim: agora(), segundos: seg }]);
        pausaAtualRef.current = null;
      }
      mudarEstado('lendo');
    }
  };

  const comecar = () => {
    setErro(null);
    setAviso(null);
    if (!suporte.ok) return;
    if (!materia) {
      setErro('Escolha a matéria antes de começar.');
      return;
    }
    setTrechos([]);
    setParcial('');
    setTexto('');
    setPausas([]);
    setSegLidos(0);
    setSegTotais(0);
    segLidosRef.current = 0;
    pausaAtualRef.current = null;
    inicioRef.current = agora();
    ultimaFalaRef.current = agora();

    const leitor = criarLeitor({
      aoTrecho: (t) => {
        if (!t) return;
        marcarFala();
        setTrechos((v) => [...v, arrumarTrecho(t)]);
      },
      aoParcial: (t) => {
        if (t) marcarFala();
        setParcial(t);
      },
      aoErro: (cod) => setErro(TEXTO_ERRO[cod] || `O navegador relatou um problema no microfone (${cod}).`),
      aoParar: () => {
        if (estadoRef.current === 'lendo' || estadoRef.current === 'pausa') encerrar({ porErro: true });
      },
    });
    leitorRef.current = leitor;
    try {
      leitor.iniciar();
      mudarEstado('lendo');
    } catch (e) {
      setErro(e.message || 'Não foi possível ligar o microfone.');
    }
  };

  // termina a escuta e abre a revisão do texto antes de salvar
  const encerrar = ({ porErro = false } = {}) => {
    leitorRef.current?.parar();
    leitorRef.current = null;
    setParcial('');
    // fecha uma pausa que estivesse em curso
    if (pausaAtualRef.current) {
      const seg = Math.round((agora() - pausaAtualRef.current.inicio) / 1000);
      if (seg >= limiar) setPausas((v) => [...v, { ...pausaAtualRef.current, fim: agora(), segundos: seg }]);
      pausaAtualRef.current = null;
    }
    setTexto((t) => t || '');
    mudarEstado('revisando');
    if (porErro) setAviso('A escuta foi interrompida. O que já foi lido está guardado aqui embaixo.');
  };

  // o texto só vira editável na revisão; durante a leitura ele é montado dos trechos
  const textoCorrido = useMemo(() => trechos.join(' '), [trechos]);
  useEffect(() => {
    if (estado === 'revisando') setTexto((t) => (t ? t : textoCorrido));
  }, [estado, textoCorrido]);

  // rola a transcrição para acompanhar a leitura
  useEffect(() => {
    if (estado === 'lendo' || estado === 'pausa') fimTranscricaoRef.current?.scrollIntoView({ block: 'nearest' });
  }, [trechos, parcial, estado]);

  const palavras = contarPalavras(estado === 'revisando' ? texto : textoCorrido);
  const ritmo = porMinuto(palavras, segLidos);
  const segPausado = pausas.reduce((a, p) => a + p.segundos, 0) + (estado === 'pausa' && pausaAtualRef.current ? Math.round((agora() - pausaAtualRef.current.inicio) / 1000) : 0);

  const salvarTudo = async () => {
    setSalvando(true);
    setErro(null);
    try {
      await salvarLeitura({
        concursoId: concurso?.id, materia, assunto, obra, paginaIni, paginaFim,
        texto, palavras, segundos: segLidos,
      });
      // entra no histórico de estudos igual a uma sessão do cronômetro, com baixa no cronograma
      let baixa = null;
      if (segLidos >= 1) {
        ctx.registrarTempo?.(materia, segLidos);
        baixa = ctx.registrarSessao?.({
          materia,
          tema: [assunto, obra].filter(Boolean).join(' · ') || 'Leitura em voz alta',
          paginaIni, paginaFim,
          seg: segLidos,
          hora: horaCurta(agora()),
          horaInicio: horaCurta(inicioRef.current),
          origem: 'leitura',
          palavras,
          cronogramaK: null,
        });
      }
      setAviso(
        `✓ Leitura guardada: ${fmtTempo(segLidos)} de leitura, ${palavras} palavras.`
        + (baixa?.achou ? ' O bloco do cronograma recebeu baixa.' : '')
        + ' O tempo entrou no seu histórico de estudos.',
      );
      mudarEstado('parado');
      setTrechos([]);
      setTexto('');
      setAssunto('');
      carregarHistorico();
    } catch (e) {
      setErro(e.message);
    }
    setSalvando(false);
  };

  const descartar = () => {
    mudarEstado('parado');
    setTrechos([]);
    setTexto('');
    setParcial('');
    setSegLidos(0);
    setSegTotais(0);
    setPausas([]);
    setAviso('Leitura descartada. Nada foi guardado.');
  };

  const apagar = async (l) => {
    if (!window.confirm('Apagar esta leitura? O texto registrado será perdido.')) return;
    try {
      await excluirLeitura(l.id);
      setLeituras((v) => v.filter((x) => x.id !== l.id));
    } catch (e) {
      setErro(e.message);
    }
  };

  // ----- tela -----
  if (!suporte.ok) {
    return (
      <div>
        <h2>🎙️ Leitura em voz alta</h2>
        <p className="aviso" role="alert">✗ {TEXTO_SUPORTE[suporte.motivo]}</p>
        <p className="sub">
          A ideia é simples: você lê o livro em voz alta, a plataforma escreve o que você leu e
          cronometra só o tempo de leitura de verdade — se você para, o cronômetro para junto.
          Para isso ela depende do reconhecimento de fala do navegador, que não existe aqui.
        </p>
      </div>
    );
  }

  const lendo = estado === 'lendo';
  const emPausa = estado === 'pausa';
  const ativo = lendo || emPausa;

  return (
    <div>
      <h2>🎙️ Leitura em voz alta</h2>
      <p className="sub">
        Leia o livro em voz alta. A plataforma escreve o que você lê e conta o tempo —
        quando você fica {LIMIARES.find(([v]) => v === limiar)?.[1] || `${limiar}s`} em silêncio, o
        cronômetro pausa sozinho; quando você volta a ler, ele retoma.
      </p>

      {/* o que está sendo lido */}
      <div className="card">
        <div className="filtros">
          <label className="campo">Matéria *
            {materias.length
              ? (
                <select value={materia} onChange={(e) => setMateria(e.target.value)} disabled={ativo}>
                  <option value="">Escolha…</option>
                  {materias.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              )
              : <input type="text" value={materia} onChange={(e) => setMateria(e.target.value)} disabled={ativo} placeholder="Ex.: Direito Constitucional" />}
          </label>
          <label className="campo">Assunto (opcional)
            <input type="text" value={assunto} onChange={(e) => setAssunto(e.target.value)} disabled={ativo} placeholder="Ex.: Controle de constitucionalidade" />
          </label>
          <label className="campo">Livro ou material (opcional)
            <input type="text" value={obra} onChange={(e) => setObra(e.target.value)} disabled={ativo} placeholder="Ex.: Curso de Direito Constitucional" />
          </label>
          <label className="campo">Página inicial
            <input type="text" inputMode="numeric" value={paginaIni} onChange={(e) => setPaginaIni(e.target.value)} />
          </label>
          <label className="campo">Página final
            <input type="text" inputMode="numeric" value={paginaFim} onChange={(e) => setPaginaFim(e.target.value)} />
          </label>
          <label className="campo">Pausar o cronômetro após
            <select value={limiar} onChange={(e) => setLimiar(Number(e.target.value))} disabled={ativo}>
              {LIMIARES.map(([v, rot]) => <option key={v} value={v}>{rot} de silêncio</option>)}
            </select>
          </label>
        </div>
      </div>

      {erro && <p className="aviso" role="alert" style={{ background: 'var(--erro-bg)', color: 'var(--erro)' }}>✗ {erro}</p>}
      {aviso && <p className="aviso" role="status" style={{ background: 'var(--ok-bg)', color: 'var(--ok)' }}>{aviso}</p>}

      {/* cronômetro de leitura */}
      {ativo && (
        <div className="card" style={{ borderColor: lendo ? 'var(--ok)' : 'var(--alerta)', borderWidth: 2 }}>
          <div className="linha entre">
            <span
              className="etiqueta"
              role="status"
              aria-live="polite"
              style={{ marginBottom: 0, background: lendo ? 'var(--ok-bg)' : 'var(--alerta-bg)', fontWeight: 700 }}
            >
              {lendo ? '🎙️ Ouvindo — cronômetro andando' : '⏸ Em pausa — cronômetro parado'}
            </span>
            <span className="sub peq">{pausas.length} pausa{pausas.length === 1 ? '' : 's'}</span>
          </div>
          <p style={{ fontSize: '2.6rem', fontWeight: 800, margin: '10px 0 2px', fontVariantNumeric: 'tabular-nums' }}>
            {fmtTempo(segLidos)}
          </p>
          <p className="sub peq" style={{ marginTop: 0 }}>tempo de leitura (sem as pausas)</p>
          <div className="filtros" style={{ marginTop: 10 }}>
            <div><b>{fmtTempo(segTotais)}</b><div className="sub peq">na sessão</div></div>
            <div><b>{fmtTempo(segPausado)}</b><div className="sub peq">parado</div></div>
            <div><b>{palavras}</b><div className="sub peq">palavras</div></div>
            <div><b>{ritmo || '—'}</b><div className="sub peq">palavras por minuto</div></div>
          </div>
          {emPausa && (
            <p className="sub peq" style={{ marginTop: 10, marginBottom: 0 }}>
              O microfone continua ligado para retomar sozinho quando você voltar a ler.
              Se for parar por muito tempo, clique em Terminar.
            </p>
          )}
        </div>
      )}

      {/* botões */}
      <div className="linha" style={{ marginBottom: 14 }}>
        {estado === 'parado' && <button className="btn pri" onClick={comecar}>🎙️ Começar a ler</button>}
        {ativo && <button className="btn pri" onClick={() => encerrar()}>⏹ Terminar leitura</button>}
        {estado === 'revisando' && (
          <>
            <button className="btn pri" onClick={salvarTudo} disabled={salvando}>
              {salvando ? 'Guardando…' : '💾 Guardar leitura'}
            </button>
            <button className="btn perigo" onClick={descartar} disabled={salvando}>Descartar</button>
          </>
        )}
      </div>

      {/* transcrição ao vivo */}
      {ativo && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>O que você está lendo</h3>
          <div
            style={{ maxHeight: 260, overflowY: 'auto', whiteSpace: 'pre-wrap', lineHeight: 1.7 }}
            aria-live="off"
          >
            {textoCorrido || <span className="sub">Comece a ler — o texto aparece aqui.</span>}
            {parcial && <span className="sub" style={{ fontStyle: 'italic' }}> {parcial}…</span>}
            <div ref={fimTranscricaoRef} />
          </div>
        </div>
      )}

      {/* revisão antes de guardar */}
      {estado === 'revisando' && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Confira o texto antes de guardar</h3>
          <p className="sub peq">
            A transcrição erra nomes próprios, números de artigo e termos em latim. Corrija o que
            importa — ou guarde como está, se for só para registrar o que foi lido.
          </p>
          <textarea rows={10} value={texto} onChange={(e) => setTexto(e.target.value)} />
          <div className="filtros" style={{ marginTop: 10 }}>
            <div><b>{fmtTempo(segLidos)}</b><div className="sub peq">lendo</div></div>
            <div><b>{fmtTempo(segPausado)}</b><div className="sub peq">parado</div></div>
            <div><b>{palavras}</b><div className="sub peq">palavras</div></div>
            <div><b>{ritmo || '—'}</b><div className="sub peq">palavras por minuto</div></div>
          </div>
          {pausas.length > 0 && (
            <details style={{ marginTop: 10 }}>
              <summary className="sub peq">Ver as {pausas.length} pausas</summary>
              <ul className="sub peq">
                {pausas.map((p, i) => (
                  <li key={p.inicio}>Pausa {i + 1}: {horaCurta(p.inicio)} às {horaCurta(p.fim)} — {fmtTempo(p.segundos)}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {/* leituras anteriores */}
      <h3>Leituras anteriores</h3>
      {!leituras.length && <p className="sub">Nenhuma leitura guardada ainda.</p>}
      {leituras.map((l) => (
        <div className="card" key={l.id}>
          <div className="linha entre">
            <b>{l.materia || 'Sem matéria'}{l.assunto ? ` · ${l.assunto}` : ''}</b>
            <span className="sub peq">{fmtDH(l.criado_em)}</span>
          </div>
          <p className="sub peq" style={{ margin: '4px 0' }}>
            {fmtTempo(l.segundos)} de leitura · {l.palavras} palavras
            {l.segundos ? ` · ${porMinuto(l.palavras, l.segundos)} palavras por minuto` : ''}
            {l.obra ? ` · ${l.obra}` : ''}
            {l.pagina_ini || l.pagina_fim ? ` · páginas ${l.pagina_ini || '?'} a ${l.pagina_fim || '?'}` : ''}
          </p>
          <div className="linha">
            <button className="btn peq" onClick={() => setAberta(aberta === l.id ? null : l.id)} aria-expanded={aberta === l.id}>
              {aberta === l.id ? 'Esconder o texto' : 'Ver o texto lido'}
            </button>
            <button className="btn peq" onClick={() => navigator.clipboard?.writeText(l.texto || '')}>📋 Copiar</button>
            <button className="btn peq perigo" onClick={() => apagar(l)}>Apagar</button>
          </div>
          {aberta === l.id && (
            <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7, marginBottom: 0, marginTop: 10 }}>
              {l.texto || <span className="sub">Esta leitura foi guardada sem texto.</span>}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
