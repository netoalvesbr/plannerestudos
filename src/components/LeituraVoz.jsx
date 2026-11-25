// 🎙️ Leitura em voz alta: a pessoa lê o livro em voz alta e a plataforma faz três coisas —
// transcreve o texto, grava o áudio e cronometra. O cronômetro e a gravação contam só o tempo
// em que ela está realmente lendo: no silêncio pausam sozinhos e, quando a leitura volta,
// retomam, sem precisar clicar em nada.
//
// Para que serve o áudio: ouvir depois a própria leitura, para revisar a matéria sem estar
// com o livro na mão. Por isso o arquivo é pequeno (voz em opus mono) e o silêncio não entra.
//
// A conta do tempo (ver o relógio de 1 segundo, mais abaixo):
//  - a cada segundo lendo, soma 1 segundo ao tempo de leitura;
//  - quando o silêncio passa do limite escolhido, devolve esses segundos de silêncio que
//    já tinham sido somados e marca a pausa — o tempo de leitura fica honesto;
//  - o tempo total da sessão (relógio de parede) continua correndo, para a pessoa comparar
//    quanto tempo ficou sentada e quanto tempo de fato leu.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { disciplinasDo } from '../lib/dados.js';
import {
  espacoDasLeituras, excluirLeitura, linkAudioLeitura, minhasLeituras, salvarLeitura,
} from '../lib/remoto.js';
import { getModo } from '../lib/store.js';
import { analisarSumario, faixaDe } from '../lib/sumario.js';
import {
  TEXTO_GRAVACAO, criarGravador, emMB, suporteGravacao,
} from '../lib/gravadorAudio.js';
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

const PAGINAS_SUMARIO = 60; // até onde procurar a página de sumário num PDF sem marcadores

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
const chaveObra = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');

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
  const [gravar, setGravar] = useState(salvo.gravar !== false);

  const [estado, setEstado] = useState('parado'); // parado | lendo | pausa | revisando
  const [trechos, setTrechos] = useState([]);
  const [parcial, setParcial] = useState('');
  const [texto, setTexto] = useState('');
  const [segLidos, setSegLidos] = useState(0);
  const [segTotais, setSegTotais] = useState(0);
  const [pausas, setPausas] = useState([]);
  const [erro, setErro] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [salvando, setSalvando] = useState(false);

  // áudio
  const [audio, setAudio] = useState(null); // { blob, ext, mime, bytes }
  const [bytesVivo, setBytesVivo] = useState(0);
  const [urlPreview, setUrlPreview] = useState(null);
  const [urlsHist, setUrlsHist] = useState({});
  const [espaco, setEspaco] = useState(0);

  // sumário
  const [carregandoSum, setCarregandoSum] = useState(false);
  const [progressoSum, setProgressoSum] = useState('');
  const [avisoSum, setAvisoSum] = useState(null);
  const [sumAberto, setSumAberto] = useState(false);

  const [leituras, setLeituras] = useState([]);
  const [aberta, setAberta] = useState(null);

  const leitorRef = useRef(null);
  const gravadorRef = useRef(null);
  const estadoRef = useRef('parado');
  const ultimaFalaRef = useRef(0);
  const inicioRef = useRef(0);
  const segLidosRef = useRef(0);
  const pausaAtualRef = useRef(null);
  const fimTranscricaoRef = useRef(null);

  const suporte = useMemo(suporteVoz, []);
  const supGrav = useMemo(suporteGravacao, []);
  const comConta = getModo() === 'conta';

  const carregarHistorico = useCallback(() => {
    minhasLeituras({ limite: 30 }).then(setLeituras).catch(() => setLeituras([]));
    espacoDasLeituras().then(setEspaco).catch(() => setEspaco(0));
  }, []);
  useEffect(carregarHistorico, [carregarHistorico]);

  // guarda as escolhas para a próxima sessão
  useEffect(() => {
    if (estado === 'parado') return;
    setPrefs({ leituraVoz: { materia, obra, limiar, gravar } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado]);

  // libera os endereços temporários de áudio ao sair da tela
  useEffect(() => () => {
    if (urlPreview) URL.revokeObjectURL(urlPreview);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlPreview]);

  const mudarEstado = (novo) => {
    estadoRef.current = novo;
    setEstado(novo);
  };

  // ----- sumário do livro -----
  const sumarios = prefs.sumarios || {};
  const sumAtual = sumarios[chaveObra(obra)] || null;

  const carregarSumario = async (arquivo) => {
    if (!arquivo) return;
    setAvisoSum(null);
    setErro(null);
    setCarregandoSum(true);
    setProgressoSum('Abrindo o PDF…');
    try {
      const { sumarioDosMarcadores, textoDoPdf } = await import('../lib/pdf.js');
      // 1ª tentativa: os marcadores do próprio PDF, que já trazem título e página exatos
      let itens = await sumarioDosMarcadores(arquivo);
      let origem = 'marcadores';
      let relatorio = null;
      if (!itens.length) {
        // 2ª tentativa: ler a página de sumário como texto
        setProgressoSum('Sem índice embutido. Procurando a página de sumário…');
        const linhas = await textoDoPdf(arquivo, (p, t) => setProgressoSum(`Lendo página ${p} de ${Math.min(t, PAGINAS_SUMARIO)}…`), PAGINAS_SUMARIO);
        const r = analisarSumario(linhas);
        itens = r.itens;
        relatorio = r.relatorio;
        origem = 'texto';
      }
      if (!itens.length) {
        setAvisoSum({
          ok: false,
          texto: 'Não encontrei o sumário neste PDF. Ele pode ser um arquivo escaneado (imagem sem texto). '
            + 'Você ainda pode digitar o assunto e as páginas à mão em cada leitura.',
        });
        return;
      }
      const nome = obra.trim() || arquivo.name.replace(/\.pdf$/i, '');
      if (!obra.trim()) setObra(nome);
      setPrefs({
        sumarios: {
          ...sumarios,
          [chaveObra(nome)]: { obra: nome, itens: itens.slice(0, 400), origem, em: new Date().toISOString() },
        },
      });
      setSumAberto(true);
      setAvisoSum({
        ok: true,
        texto: origem === 'marcadores'
          ? `✓ ${itens.length} itens lidos do índice do PDF.`
          : `✓ ${itens.length} itens lidos da página de sumário${relatorio?.descartados ? ` (${relatorio.descartados} linhas descartadas por não parecerem sumário)` : ''}. Confira se ficou certo.`,
      });
    } catch (e) {
      setAvisoSum({ ok: false, texto: `Não foi possível ler o PDF: ${e.message}` });
    } finally {
      setCarregandoSum(false);
      setProgressoSum('');
    }
  };

  const escolherItem = (i) => {
    const it = sumAtual.itens[i];
    const f = faixaDe(sumAtual.itens, i);
    setAssunto(it.titulo);
    setPaginaIni(f.ini);
    setPaginaFim(f.fim);
    setSumAberto(false);
  };

  const apagarSumario = () => {
    const resto = { ...sumarios };
    delete resto[chaveObra(obra)];
    setPrefs({ sumarios: resto });
    setAvisoSum(null);
  };

  const removerItem = (i) => {
    const novos = sumAtual.itens.filter((_, j) => j !== i);
    setPrefs({ sumarios: { ...sumarios, [chaveObra(obra)]: { ...sumAtual, itens: novos } } });
  };

  // ----- relógio de 1 segundo: é ele que pausa e retoma cronômetro e gravação -----
  useEffect(() => {
    if (estado !== 'lendo' && estado !== 'pausa') return undefined;
    const t = setInterval(() => {
      setSegTotais(Math.round((agora() - inicioRef.current) / 1000));
      if (estadoRef.current === 'lendo') {
        segLidosRef.current += 1;
        setSegLidos(segLidosRef.current);
        if (agora() - ultimaFalaRef.current > limiar * 1000) {
          segLidosRef.current = Math.max(0, segLidosRef.current - limiar);
          setSegLidos(segLidosRef.current);
          pausaAtualRef.current = { inicio: ultimaFalaRef.current };
          gravadorRef.current?.pausar();
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
      gravadorRef.current?.retomar();
      mudarEstado('lendo');
    }
  };

  const comecar = async () => {
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
    setBytesVivo(0);
    if (urlPreview) URL.revokeObjectURL(urlPreview);
    setUrlPreview(null);
    setAudio(null);
    segLidosRef.current = 0;
    pausaAtualRef.current = null;
    inicioRef.current = agora();
    ultimaFalaRef.current = agora();

    // a gravação vem primeiro: ela pede o microfone, e uma permissão serve para as duas coisas
    if (gravar && supGrav.ok) {
      const g = criarGravador({
        aoErro: (m) => setErro(m),
        aoPedaco: (b) => setBytesVivo(b),
      });
      try {
        await g.iniciar();
        gravadorRef.current = g;
      } catch (e) {
        gravadorRef.current = null;
        setErro(
          /denied|not allowed/i.test(e.message || '')
            ? 'O microfone foi bloqueado. Clique no ícone de cadeado ao lado do endereço do site e libere o microfone.'
            : `Não foi possível gravar o áudio: ${e.message}. A leitura segue sem gravação.`,
        );
      }
    }

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
      gravadorRef.current?.parar();
      gravadorRef.current = null;
      setErro(e.message || 'Não foi possível ligar o microfone.');
    }
  };

  // termina a escuta e abre a revisão antes de salvar.
  // A mudança de estado vem ANTES de parar a escuta: parar dispara o `aoParar` do leitor,
  // que chamaria esta função de novo e, pior, com porErro — o que mostraria "a escuta foi
  // interrompida" para quem só clicou em Terminar.
  const encerrar = async ({ porErro = false } = {}) => {
    if (estadoRef.current !== 'lendo' && estadoRef.current !== 'pausa') return;
    mudarEstado('revisando');
    leitorRef.current?.parar();
    leitorRef.current = null;
    setParcial('');
    if (pausaAtualRef.current) {
      const seg = Math.round((agora() - pausaAtualRef.current.inicio) / 1000);
      if (seg >= limiar) setPausas((v) => [...v, { ...pausaAtualRef.current, fim: agora(), segundos: seg }]);
      pausaAtualRef.current = null;
    }
    if (porErro) setAviso('A escuta foi interrompida. O que já foi lido está guardado aqui embaixo.');

    const g = gravadorRef.current;
    gravadorRef.current = null;
    if (g) {
      const a = await g.parar();
      if (a) {
        setAudio(a);
        setUrlPreview(URL.createObjectURL(a.blob));
      }
    }
  };

  const textoCorrido = useMemo(() => trechos.join(' '), [trechos]);
  useEffect(() => {
    if (estado === 'revisando') setTexto((t) => (t ? t : textoCorrido));
  }, [estado, textoCorrido]);

  useEffect(() => {
    if (estado === 'lendo' || estado === 'pausa') fimTranscricaoRef.current?.scrollIntoView({ block: 'nearest' });
  }, [trechos, parcial, estado]);

  const palavras = contarPalavras(estado === 'revisando' ? texto : textoCorrido);
  const ritmo = porMinuto(palavras, segLidos);
  const segPausado = pausas.reduce((a, p) => a + p.segundos, 0)
    + (estado === 'pausa' && pausaAtualRef.current ? Math.round((agora() - pausaAtualRef.current.inicio) / 1000) : 0);

  const baixarAudio = () => {
    if (!audio) return;
    const a = document.createElement('a');
    a.href = urlPreview;
    a.download = `leitura-${[materia, assunto].filter(Boolean).join('-').replace(/[^\p{L}\p{N}-]+/gu, '_') || 'voz'}.${audio.ext}`;
    a.click();
  };

  const salvarTudo = async () => {
    setSalvando(true);
    setErro(null);
    try {
      await salvarLeitura({
        concursoId: concurso?.id, materia, assunto, obra, paginaIni, paginaFim,
        texto, palavras, segundos: segLidos,
        audio: comConta ? audio : null,
      });
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
        `✓ Leitura guardada: ${fmtTempo(segLidos)} de leitura, ${palavras} palavras`
        + (audio && comConta ? `, áudio de ${emMB(audio.bytes)} MB` : '')
        + '.'
        + (baixa?.achou ? ' O bloco do cronograma recebeu baixa.' : '')
        + (audio && !comConta ? ' Sem conta o áudio não fica guardado: use o botão de baixar antes de sair.' : ''),
      );
      mudarEstado('parado');
      setTrechos([]);
      setTexto('');
      setAssunto('');
      if (comConta) {
        if (urlPreview) URL.revokeObjectURL(urlPreview);
        setUrlPreview(null);
        setAudio(null);
      }
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
    if (urlPreview) URL.revokeObjectURL(urlPreview);
    setUrlPreview(null);
    setAudio(null);
    setAviso('Leitura descartada. Nada foi guardado.');
  };

  const apagar = async (l) => {
    if (!window.confirm('Apagar esta leitura? O texto e o áudio gravado serão perdidos.')) return;
    try {
      await excluirLeitura(l.id, l.audio || null);
      setLeituras((v) => v.filter((x) => x.id !== l.id));
      setEspaco((v) => Math.max(0, v - (l.audio_bytes || 0)));
    } catch (e) {
      setErro(e.message);
    }
  };

  const ouvir = async (l) => {
    if (urlsHist[l.id]) return;
    try {
      const url = await linkAudioLeitura(l.audio);
      setUrlsHist((v) => ({ ...v, [l.id]: url }));
    } catch (e) {
      setErro(`Não foi possível abrir o áudio: ${e.message}`);
    }
  };

  // ----- tela -----
  if (!suporte.ok) {
    return (
      <div>
        <h2>🎙️ Leitura em voz alta</h2>
        <p className="aviso" role="alert">✗ {TEXTO_SUPORTE[suporte.motivo]}</p>
        <p className="sub">
          A ideia é simples: você lê o livro em voz alta, a plataforma escreve o que você leu,
          grava o áudio para você ouvir depois e cronometra só o tempo de leitura de verdade.
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
        Leia o livro em voz alta. A plataforma escreve o que você lê, grava o áudio para você
        ouvir depois e conta o tempo — quando você fica{' '}
        {LIMIARES.find(([v]) => v === limiar)?.[1] || `${limiar}s`} em silêncio, o cronômetro e a
        gravação pausam sozinhos; quando você volta a ler, retomam.
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
          <label className="campo">Livro ou material
            <input type="text" value={obra} onChange={(e) => setObra(e.target.value)} disabled={ativo} placeholder="Ex.: Curso de Direito Constitucional" />
          </label>
          <label className="campo">Assunto / capítulo
            <input type="text" value={assunto} onChange={(e) => setAssunto(e.target.value)} disabled={ativo} placeholder="Ex.: Controle de constitucionalidade" />
          </label>
          <label className="campo">Página inicial
            <input type="text" inputMode="numeric" value={paginaIni} onChange={(e) => setPaginaIni(e.target.value)} />
          </label>
          <label className="campo">Página final
            <input type="text" inputMode="numeric" value={paginaFim} onChange={(e) => setPaginaFim(e.target.value)} />
          </label>
          <label className="campo">Pausar após
            <select value={limiar} onChange={(e) => setLimiar(Number(e.target.value))} disabled={ativo}>
              {LIMIARES.map(([v, rot]) => <option key={v} value={v}>{rot} de silêncio</option>)}
            </select>
          </label>
        </div>

        {/* gravação do áudio */}
        <div style={{ borderTop: '1px solid var(--borda)', marginTop: 12, paddingTop: 12 }}>
          {supGrav.ok ? (
            <>
              <label className="linha" style={{ gap: 8, cursor: ativo ? 'default' : 'pointer' }}>
                <input type="checkbox" checked={gravar} disabled={ativo} onChange={(e) => setGravar(e.target.checked)} style={{ width: 'auto', minHeight: 0 }} />
                <b>🔊 Gravar o áudio da leitura</b>
              </label>
              <p className="sub peq" style={{ margin: '4px 0 0' }}>
                {comConta
                  ? 'Fica guardado na sua conta para você ouvir depois. Uma hora de leitura ocupa perto de 15 MB, e o silêncio das pausas não entra no arquivo.'
                  : 'Você está sem conta, então o áudio não pode ser guardado — mas no fim da leitura aparece um botão para baixar o arquivo no seu aparelho.'}
              </p>
            </>
          ) : (
            <p className="sub peq" style={{ margin: 0 }}>✗ {TEXTO_GRAVACAO[supGrav.motivo]}</p>
          )}
        </div>
      </div>

      {/* sumário do livro */}
      <div className="card">
        <div className="linha entre">
          <b>📑 Sumário do livro</b>
          {sumAtual && (
            <button className="btn peq" onClick={() => setSumAberto(!sumAberto)} aria-expanded={sumAberto}>
              {sumAberto ? 'Esconder' : `Ver os ${sumAtual.itens.length} itens`}
            </button>
          )}
        </div>

        {!sumAtual && (
          <>
            <p className="sub peq">
              Carregue o PDF do livro e a plataforma lê o sumário. Depois, em vez de digitar o
              assunto e as páginas a cada leitura, você só clica no capítulo que vai ler.
              {obra.trim() ? '' : ' O nome do livro é preenchido com o nome do arquivo.'}
            </p>
            <label className="btn" style={{ display: 'inline-block', cursor: 'pointer' }}>
              {carregandoSum ? 'Lendo o PDF…' : '📄 Carregar sumário de um PDF'}
              <input
                type="file"
                accept="application/pdf,.pdf"
                disabled={carregandoSum || ativo}
                onChange={(e) => {
                  carregarSumario(e.target.files?.[0]);
                  e.target.value = '';
                }}
                style={{ display: 'none' }}
              />
            </label>
            {carregandoSum && <p className="sub peq" role="status">{progressoSum}</p>}
          </>
        )}

        {sumAtual && (
          <>
            <p className="sub peq" style={{ margin: '4px 0' }}>
              {sumAtual.obra} · {sumAtual.itens.length} itens ·{' '}
              {sumAtual.origem === 'marcadores' ? 'lido do índice do PDF' : 'lido da página de sumário'}
            </p>
            {sumAberto && (
              <div style={{ maxHeight: 320, overflowY: 'auto', borderTop: '1px solid var(--borda)', paddingTop: 8 }}>
                {sumAtual.itens.map((it, i) => (
                  <div key={`${it.titulo}-${it.pagina}-${i}`} className="linha entre" style={{ gap: 8, padding: '4px 0', paddingLeft: (it.nivel - 1) * 14 }}>
                    <span style={{ flex: 1, minWidth: 0, fontWeight: it.nivel === 1 ? 700 : 400 }}>
                      {it.titulo}
                      {it.pagina != null && <span className="sub peq"> · p. {it.pagina}</span>}
                    </span>
                    <button className="btn peq" onClick={() => escolherItem(i)} disabled={ativo}>Vou ler este</button>
                    <button className="btn peq" onClick={() => removerItem(i)} disabled={ativo} aria-label={`Tirar "${it.titulo}" do sumário`}>✕</button>
                  </div>
                ))}
              </div>
            )}
            <div className="linha" style={{ marginTop: 8 }}>
              <label className="btn peq" style={{ cursor: 'pointer' }}>
                Trocar o PDF
                <input type="file" accept="application/pdf,.pdf" disabled={carregandoSum || ativo} onChange={(e) => { carregarSumario(e.target.files?.[0]); e.target.value = ''; }} style={{ display: 'none' }} />
              </label>
              <button className="btn peq perigo" onClick={apagarSumario} disabled={ativo}>Apagar este sumário</button>
            </div>
          </>
        )}
        {avisoSum && (
          <p className="aviso" role="status" style={avisoSum.ok ? { background: 'var(--ok-bg)', color: 'var(--ok)', marginTop: 10 } : { marginTop: 10 }}>
            {avisoSum.ok ? '' : '✗ '}{avisoSum.texto}
          </p>
        )}
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
              {lendo
                ? `🎙️ Ouvindo — cronômetro${gravadorRef.current ? ' e gravação' : ''} andando`
                : `⏸ Em pausa — cronômetro${gravadorRef.current ? ' e gravação' : ''} parados`}
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
            {gravadorRef.current && <div><b>{emMB(bytesVivo)} MB</b><div className="sub peq">áudio gravado</div></div>}
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
            {audio && <button className="btn" onClick={baixarAudio}>⬇️ Baixar o áudio</button>}
            <button className="btn perigo" onClick={descartar} disabled={salvando}>Descartar</button>
          </>
        )}
      </div>

      {/* transcrição ao vivo */}
      {ativo && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>O que você está lendo</h3>
          <div style={{ maxHeight: 260, overflowY: 'auto', whiteSpace: 'pre-wrap', lineHeight: 1.7 }} aria-live="off">
            {textoCorrido || <span className="sub">Comece a ler — o texto aparece aqui.</span>}
            {parcial && <span className="sub" style={{ fontStyle: 'italic' }}> {parcial}…</span>}
            <div ref={fimTranscricaoRef} />
          </div>
        </div>
      )}

      {/* revisão antes de guardar */}
      {estado === 'revisando' && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Confira antes de guardar</h3>
          {urlPreview && (
            <div style={{ marginBottom: 12 }}>
              <p className="sub peq" style={{ margin: '0 0 6px' }}>
                Áudio gravado · {emMB(audio?.bytes)} MB · ouça para conferir se o microfone pegou bem
              </p>
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <audio controls src={urlPreview} style={{ width: '100%' }} />
            </div>
          )}
          <p className="sub peq">
            A transcrição erra nomes próprios, números de artigo e termos em latim. Corrija o que
            importa — ou guarde como está, se for só para registrar o que foi lido. O áudio não muda.
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
      <div className="linha entre">
        <h3 style={{ marginBottom: 8 }}>Leituras anteriores</h3>
        {espaco > 0 && <span className="sub peq">{emMB(espaco)} MB de áudio guardados</span>}
      </div>
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
            {l.audio ? ` · 🔊 áudio de ${emMB(l.audio_bytes)} MB` : ' · sem áudio'}
          </p>
          {urlsHist[l.id] && (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <audio controls autoPlay src={urlsHist[l.id]} style={{ width: '100%', margin: '6px 0' }} />
          )}
          <div className="linha">
            {l.audio && !urlsHist[l.id] && <button className="btn peq pri" onClick={() => ouvir(l)}>▶️ Ouvir</button>}
            {l.audio && urlsHist[l.id] && (
              <a className="btn peq" href={urlsHist[l.id]} download={`leitura-${(l.assunto || l.materia || 'voz').replace(/[^\p{L}\p{N}-]+/gu, '_')}.webm`}>⬇️ Baixar</a>
            )}
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
