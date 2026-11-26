// 🎙️ Leitura em voz alta: a pessoa lê o livro em voz alta e a plataforma transcreve,
// grava o áudio e cronometra só o tempo de leitura de verdade.
//
// Esta tela monta a sessão e mostra o resultado. Quem segura a leitura em andamento é
// src/lib/sessaoLeitura.js, fora do React — por isso trocar de tela, ou recarregar a
// página por acidente, não apaga mais o que já foi lido.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { disciplinasDo } from '../lib/dados.js';
import {
  anexarAudioLeitura, atualizarLeitura, espacoDasLeituras, excluirLeitura, linkAudioLeitura,
  minhasLeituras, salvarLeitura,
} from '../lib/remoto.js';
import { getModo } from '../lib/store.js';
import * as sessao from '../lib/sessaoLeitura.js';
import { analisarSumario, faixaDe } from '../lib/sumario.js';
import { TEXTO_GRAVACAO, emMB, suporteGravacao } from '../lib/gravadorAudio.js';
import { CONFIANCA_MINIMA, TEXTO_SUPORTE, contarPalavras, porMinuto, suporteVoz } from '../lib/vozLeitura.js';

const PAGINAS_SUMARIO = 60;
const LIMIAR_MIN = 2;
const LIMIAR_MAX = 120;
const ATALHOS_LIMIAR = [3, 6, 10, 20, 30];

const dois = (n) => String(n).padStart(2, '0');
export const fmtTempo = (seg) => {
  const s = Math.max(0, Math.round(seg));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}:${dois(m)}:${dois(s % 60)}` : `${dois(m)}:${dois(s % 60)}`;
};
const fmtDH = (d) => (d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');
const horaCurta = (t) => new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const chaveObra = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
const duvidoso = (t) => typeof t.confianca === 'number' && t.confianca < CONFIANCA_MINIMA;

// Trecho que o navegador ouviu com pouca certeza. Nunca marcamos só pela cor: quem não
// distingue vermelho continua vendo o negrito, o sublinhado ondulado e o sinal ⚠.
const estiloDuvida = {
  color: 'var(--erro)', fontWeight: 700,
  textDecoration: 'underline wavy var(--erro)', textUnderlineOffset: 3,
  background: 'var(--erro-bg)', borderRadius: 4, padding: '0 2px',
};

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
  const [limiar, setLimiar] = useState(salvo.limiar || 6);
  const [gravar, setGravar] = useState(salvo.gravar !== false);

  const [st, setSt] = useState(sessao.estado());
  useEffect(() => sessao.assinar(setSt), []);

  const [trechosRev, setTrechosRev] = useState(null);
  const [textoLivre, setTextoLivre] = useState(null);
  const [abertoAlt, setAbertoAlt] = useState(null);
  const [erro, setErro] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [urlPreview, setUrlPreview] = useState(null);
  const [urlsHist, setUrlsHist] = useState({});
  const [espaco, setEspaco] = useState(0);
  const [leituras, setLeituras] = useState([]);
  const [aberta, setAberta] = useState(null);
  const [recuperavel, setRecuperavel] = useState(null);

  const [carregandoSum, setCarregandoSum] = useState(false);
  const [progressoSum, setProgressoSum] = useState('');
  const [avisoSum, setAvisoSum] = useState(null);
  const [sumAberto, setSumAberto] = useState(false);

  const fimRef = useRef(null);
  const suporte = useMemo(suporteVoz, []);
  const supGrav = useMemo(suporteGravacao, []);
  const comConta = getModo() === 'conta';

  const carregarHistorico = useCallback(() => {
    minhasLeituras({ limite: 30 }).then(setLeituras).catch(() => setLeituras([]));
    espacoDasLeituras().then(setEspaco).catch(() => setEspaco(0));
  }, []);
  useEffect(carregarHistorico, [carregarHistorico]);

  useEffect(() => {
    if (!st.ativa && st.fase === 'parado') setRecuperavel(sessao.rascunho());
  }, [st.ativa, st.fase]);

  useEffect(() => {
    if (st.fase !== 'revisando') return;
    setTrechosRev((v) => v || st.trechos.map((t) => ({ ...t })));
    if (st.audio && !urlPreview) setUrlPreview(URL.createObjectURL(st.audio.blob));
  }, [st.fase, st.trechos, st.audio, urlPreview]);

  useEffect(() => () => { if (urlPreview) URL.revokeObjectURL(urlPreview); }, [urlPreview]);

  useEffect(() => {
    if (st.fase === 'lendo' || st.fase === 'pausa') fimRef.current?.scrollIntoView({ block: 'nearest' });
  }, [st.trechos, st.parcial, st.fase]);

  // ----- sumário do livro -----
  const sumarios = prefs.sumarios || {};
  const sumAtual = sumarios[chaveObra(obra)] || null;

  const carregarSumario = async (arquivo) => {
    if (!arquivo) return;
    setAvisoSum(null);
    setCarregandoSum(true);
    setProgressoSum('Abrindo o PDF…');
    try {
      const { sumarioDosMarcadores, textoDoPdf } = await import('../lib/pdf.js');
      let itens = await sumarioDosMarcadores(arquivo);
      let origem = 'marcadores';
      let relatorio = null;
      if (!itens.length) {
        setProgressoSum('Sem índice embutido. Procurando a página de sumário…');
        const linhas = await textoDoPdf(arquivo, (pg, t) => setProgressoSum(`Lendo página ${pg} de ${Math.min(t, PAGINAS_SUMARIO)}…`), PAGINAS_SUMARIO);
        const r = analisarSumario(linhas);
        itens = r.itens;
        relatorio = r.relatorio;
        origem = 'texto';
      }
      if (!itens.length) {
        setAvisoSum({ ok: false, texto: 'Não encontrei o sumário neste PDF. Ele pode ser um arquivo escaneado (imagem sem texto). Você ainda pode digitar o assunto e as páginas à mão.' });
        return;
      }
      const nome = obra.trim() || arquivo.name.replace(/\.pdf$/i, '');
      if (!obra.trim()) setObra(nome);
      setPrefs({ sumarios: { ...sumarios, [chaveObra(nome)]: { obra: nome, itens: itens.slice(0, 400), origem, em: new Date().toISOString() } } });
      setSumAberto(true);
      setAvisoSum({
        ok: true,
        texto: origem === 'marcadores'
          ? `✓ ${itens.length} itens lidos do índice do PDF.`
          : `✓ ${itens.length} itens lidos da página de sumário${relatorio?.descartados ? ` (${relatorio.descartados} linhas descartadas)` : ''}. Confira se ficou certo.`,
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

  // ----- começar -----
  const comecar = async () => {
    setErro(null);
    setAviso(null);
    if (!suporte.ok) return;
    if (!materia) {
      setErro('Escolha a matéria antes de começar.');
      return;
    }
    setTrechosRev(null);
    setTextoLivre(null);
    if (urlPreview) URL.revokeObjectURL(urlPreview);
    setUrlPreview(null);
    setPrefs({ leituraVoz: { materia, obra, limiar, gravar } });
    await sessao.iniciar({
      concursoId: concurso?.id, materia, assunto, obra, paginaIni, paginaFim,
      limiar: Math.min(LIMIAR_MAX, Math.max(LIMIAR_MIN, Number(limiar) || 6)),
      gravar: gravar && supGrav.ok,
    });
  };

  // ----- revisão -----
  const trechos = trechosRev || st.trechos;
  const textoFinal = textoLivre != null ? textoLivre : trechos.map((t) => t.texto).join(' ');
  const palavras = contarPalavras(textoFinal);
  const ritmo = porMinuto(palavras, st.segLidos);
  const segPausado = (st.pausas || []).reduce((a, p) => a + p.segundos, 0);
  const duvidas = trechos.filter(duvidoso).length;

  const trocarTrecho = (i, novo) => {
    setTrechosRev((v) => v.map((t, j) => (j === i ? { ...t, texto: novo, confianca: 1 } : t)));
    setAbertoAlt(null);
  };

  const guardar = async () => {
    setSalvando(true);
    setErro(null);
    try {
      const dados = {
        concursoId: st.cfg.concursoId, materia: st.cfg.materia, assunto: st.cfg.assunto,
        obra: st.cfg.obra, paginaIni: st.cfg.paginaIni, paginaFim: st.cfg.paginaFim,
        texto: textoFinal, palavras, segundos: st.segLidos,
      };
      // Durante a leitura o texto já foi sendo gravado; aqui só concluímos.
      if (st.idRemoto) {
        await atualizarLeitura(st.idRemoto, dados);
        if (st.audio && comConta) await anexarAudioLeitura(st.idRemoto, st.audio);
      } else {
        await salvarLeitura({ ...dados, audio: comConta ? st.audio : null });
      }
      let baixa = null;
      if (st.segLidos >= 1) {
        ctx.registrarTempo?.(st.cfg.materia, st.segLidos);
        baixa = ctx.registrarSessao?.({
          materia: st.cfg.materia,
          tema: [st.cfg.assunto, st.cfg.obra].filter(Boolean).join(' · ') || 'Leitura em voz alta',
          paginaIni: st.cfg.paginaIni, paginaFim: st.cfg.paginaFim,
          seg: st.segLidos, hora: horaCurta(Date.now()), horaInicio: horaCurta(st.inicio),
          origem: 'leitura', palavras, cronogramaK: null,
        });
      }
      setAviso(
        `✓ Leitura guardada: ${fmtTempo(st.segLidos)}, ${palavras} palavras`
        + (st.audio && comConta ? `, áudio de ${emMB(st.audio.bytes)} MB` : '') + '.'
        + (baixa?.achou ? ' O bloco do cronograma recebeu baixa.' : '')
        + (st.audio && !comConta ? ' Sem conta o áudio não fica guardado: baixe antes de sair.' : ''),
      );
      sessao.concluir();
      setTrechosRev(null);
      setTextoLivre(null);
      setAssunto('');
      carregarHistorico();
    } catch (e) {
      setErro(e.message);
    }
    setSalvando(false);
  };

  const descartar = () => {
    if (!window.confirm('Descartar esta leitura? O texto e o áudio serão perdidos.')) return;
    sessao.descartar();
    setTrechosRev(null);
    setTextoLivre(null);
    if (urlPreview) URL.revokeObjectURL(urlPreview);
    setUrlPreview(null);
    setAviso('Leitura descartada.');
  };

  const baixarAudio = () => {
    if (!st.audio || !urlPreview) return;
    const a = document.createElement('a');
    a.href = urlPreview;
    a.download = `leitura-${(st.cfg.assunto || st.cfg.materia || 'voz').replace(/[^\p{L}\p{N}-]+/gu, '_')}.${st.audio.ext}`;
    a.click();
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
        </p>
      </div>
    );
  }

  const lendo = st.fase === 'lendo';
  const emPausa = st.fase === 'pausa';
  const pausadoNaMao = st.fase === 'manual';
  const ativo = st.ativa;
  const revisando = st.fase === 'revisando';
  const segSalvo = st.salvoEm ? Math.round((Date.now() - st.salvoEm) / 1000) : null;

  return (
    <div>
      <h2>🎙️ Leitura em voz alta</h2>
      <p className="sub">
        Leia o livro em voz alta. A plataforma escreve o que você lê, grava o áudio para você
        ouvir depois e conta o tempo. Depois de {st.cfg?.limiar || limiar} segundos em silêncio
        ela entende que você parou e pausa sozinha; quando você volta a ler, retoma.
      </p>

      {recuperavel && !ativo && !revisando && (
        <div className="card" style={{ borderColor: 'var(--alerta)', borderWidth: 2 }}>
          <b>Você tem uma leitura não finalizada</b>
          <p className="sub peq" style={{ margin: '4px 0' }}>
            {recuperavel.cfg?.materia || 'Sem matéria'} ·{' '}
            {contarPalavras(recuperavel.trechos.map((t) => t.texto).join(' '))} palavras ·{' '}
            {fmtTempo(recuperavel.segLidos || 0)} · de {fmtDH(recuperavel.em)}
          </p>
          <div className="linha">
            <button className="btn pri" onClick={() => { sessao.recuperar(recuperavel); setRecuperavel(null); }}>
              Recuperar o texto
            </button>
            <button className="btn" onClick={() => { sessao.limparRascunho(); setRecuperavel(null); }}>Descartar</button>
          </div>
          <p className="sub peq" style={{ marginBottom: 0 }}>
            O texto foi guardado automaticamente. O áudio daquela sessão não pôde ser recuperado.
          </p>
        </div>
      )}

      {!ativo && !revisando && (
        <div className="card">
          <div className="filtros">
            <label className="campo">Matéria *
              {materias.length
                ? (
                  <select value={materia} onChange={(e) => setMateria(e.target.value)}>
                    <option value="">Escolha…</option>
                    {materias.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                )
                : <input type="text" value={materia} onChange={(e) => setMateria(e.target.value)} placeholder="Ex.: Direito Constitucional" />}
            </label>
            <label className="campo">Livro ou material
              <input type="text" value={obra} onChange={(e) => setObra(e.target.value)} placeholder="Ex.: Curso de Direito Constitucional" />
            </label>
            <label className="campo">Assunto / capítulo
              <input type="text" value={assunto} onChange={(e) => setAssunto(e.target.value)} placeholder="Ex.: Controle de constitucionalidade" />
            </label>
            <label className="campo">Página inicial
              <input type="text" inputMode="numeric" value={paginaIni} onChange={(e) => setPaginaIni(e.target.value)} />
            </label>
            <label className="campo">Página final
              <input type="text" inputMode="numeric" value={paginaFim} onChange={(e) => setPaginaFim(e.target.value)} />
            </label>
          </div>

          <div style={{ borderTop: '1px solid var(--borda)', marginTop: 12, paddingTop: 12 }}>
            <label className="campo" htmlFor="limiar">Pausar sozinho depois de quantos segundos em silêncio</label>
            <div className="linha" style={{ gap: 6, flexWrap: 'wrap' }}>
              <input
                id="limiar"
                type="number"
                min={LIMIAR_MIN}
                max={LIMIAR_MAX}
                value={limiar}
                onChange={(e) => setLimiar(e.target.value)}
                onBlur={() => setLimiar(Math.min(LIMIAR_MAX, Math.max(LIMIAR_MIN, Number(limiar) || 6)))}
                style={{ width: 90 }}
              />
              <span className="sub peq">segundos</span>
              {ATALHOS_LIMIAR.map((n) => (
                <button
                  key={n}
                  type="button"
                  className="btn peq"
                  aria-pressed={Number(limiar) === n}
                  onClick={() => setLimiar(n)}
                  style={Number(limiar) === n ? { background: 'var(--pri)', color: 'var(--pri-txt)', borderColor: 'var(--pri)' } : undefined}
                >
                  {n}s
                </button>
              ))}
            </div>
            <p className="sub peq" style={{ margin: '4px 0 0' }}>
              Entre {LIMIAR_MIN} e {LIMIAR_MAX} segundos. Valor baixo pausa nas respiradas entre
              frases; valor alto demora a perceber que você parou.
            </p>
          </div>

          <div style={{ borderTop: '1px solid var(--borda)', marginTop: 12, paddingTop: 12 }}>
            {supGrav.ok ? (
              <>
                <label className="linha" style={{ gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={gravar} onChange={(e) => setGravar(e.target.checked)} style={{ width: 'auto', minHeight: 0 }} />
                  <b>🔊 Gravar o áudio da leitura</b>
                </label>
                <p className="sub peq" style={{ margin: '4px 0 0' }}>
                  {comConta
                    ? 'Fica guardado na sua conta para você ouvir depois. Uma hora ocupa perto de 15 MB, e o silêncio das pausas não entra.'
                    : 'Sem conta o áudio não pode ser guardado — no fim aparece um botão para baixar o arquivo.'}
                </p>
              </>
            ) : <p className="sub peq" style={{ margin: 0 }}>✗ {TEXTO_GRAVACAO[supGrav.motivo]}</p>}
          </div>
        </div>
      )}

      {!ativo && !revisando && (
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
                Carregue o PDF do livro e a plataforma lê o sumário. Depois você só clica no
                capítulo que vai ler, em vez de digitar assunto e páginas toda vez.
              </p>
              <label className="btn" style={{ display: 'inline-block', cursor: 'pointer' }}>
                {carregandoSum ? 'Lendo o PDF…' : '📄 Carregar sumário de um PDF'}
                <input type="file" accept="application/pdf,.pdf" disabled={carregandoSum}
                  onChange={(e) => { carregarSumario(e.target.files?.[0]); e.target.value = ''; }} style={{ display: 'none' }} />
              </label>
              {carregandoSum && <p className="sub peq" role="status">{progressoSum}</p>}
            </>
          )}
          {sumAtual && (
            <>
              <p className="sub peq" style={{ margin: '4px 0' }}>
                {sumAtual.obra} · {sumAtual.itens.length} itens · {sumAtual.origem === 'marcadores' ? 'lido do índice do PDF' : 'lido da página de sumário'}
              </p>
              {sumAberto && (
                <div style={{ maxHeight: 320, overflowY: 'auto', borderTop: '1px solid var(--borda)', paddingTop: 8 }}>
                  {sumAtual.itens.map((it, i) => (
                    <div key={`${it.titulo}-${it.pagina}-${i}`} className="linha entre" style={{ gap: 8, padding: '4px 0', paddingLeft: (it.nivel - 1) * 14 }}>
                      <span style={{ flex: 1, minWidth: 0, fontWeight: it.nivel === 1 ? 700 : 400 }}>
                        {it.titulo}{it.pagina != null && <span className="sub peq"> · p. {it.pagina}</span>}
                      </span>
                      <button className="btn peq" onClick={() => escolherItem(i)}>Vou ler este</button>
                      <button className="btn peq" onClick={() => removerItem(i)} aria-label={`Tirar "${it.titulo}" do sumário`}>✕</button>
                    </div>
                  ))}
                </div>
              )}
              <div className="linha" style={{ marginTop: 8 }}>
                <label className="btn peq" style={{ cursor: 'pointer' }}>
                  Trocar o PDF
                  <input type="file" accept="application/pdf,.pdf" disabled={carregandoSum} onChange={(e) => { carregarSumario(e.target.files?.[0]); e.target.value = ''; }} style={{ display: 'none' }} />
                </label>
                <button className="btn peq perigo" onClick={apagarSumario}>Apagar este sumário</button>
              </div>
            </>
          )}
          {avisoSum && (
            <p className="aviso" role="status" style={avisoSum.ok ? { background: 'var(--ok-bg)', color: 'var(--ok)', marginTop: 10 } : { marginTop: 10 }}>
              {avisoSum.ok ? '' : '✗ '}{avisoSum.texto}
            </p>
          )}
        </div>
      )}

      {(erro || st.erro) && <p className="aviso" role="alert" style={{ background: 'var(--erro-bg)', color: 'var(--erro)' }}>✗ {erro || st.erro}</p>}
      {aviso && <p className="aviso" role="status" style={{ background: 'var(--ok-bg)', color: 'var(--ok)' }}>{aviso}</p>}

      {ativo && (
        <div className="card" style={{ borderColor: lendo ? 'var(--ok)' : 'var(--alerta)', borderWidth: 2 }}>
          <div className="linha entre">
            <span className="etiqueta" role="status" aria-live="polite" style={{ marginBottom: 0, background: lendo ? 'var(--ok-bg)' : 'var(--alerta-bg)', fontWeight: 700 }}>
              {lendo && `🎙️ Ouvindo — cronômetro${st.cfg.gravar ? ' e gravação' : ''} andando`}
              {emPausa && `⏸ Em pausa (silêncio) — cronômetro${st.cfg.gravar ? ' e gravação' : ''} parados`}
              {pausadoNaMao && '⏸ Pausado por você'}
            </span>
            <span className="sub peq">{st.pausas.length} pausa{st.pausas.length === 1 ? '' : 's'}</span>
          </div>
          <p style={{ fontSize: '2.6rem', fontWeight: 800, margin: '10px 0 2px', fontVariantNumeric: 'tabular-nums' }}>{fmtTempo(st.segLidos)}</p>
          <p className="sub peq" style={{ marginTop: 0 }}>tempo de leitura (sem as pausas)</p>
          <div className="filtros" style={{ marginTop: 10 }}>
            <div><b>{fmtTempo(st.segTotais)}</b><div className="sub peq">na sessão</div></div>
            <div><b>{fmtTempo(segPausado)}</b><div className="sub peq">parado</div></div>
            <div><b>{sessao.palavrasDe()}</b><div className="sub peq">palavras</div></div>
            {st.bytesAudio > 0 && <div><b>{emMB(st.bytesAudio)} MB</b><div className="sub peq">áudio</div></div>}
          </div>
          <p className="sub peq" role="status" style={{ marginTop: 8, marginBottom: 0 }}>
            {st.salvando ? 'Guardando…'
              : st.erroSalvar ? `✗ ${st.erroSalvar} — o texto continua guardado neste aparelho.`
                : segSalvo == null ? 'Ainda não guardado'
                  : `✓ Guardado automaticamente ${segSalvo < 5 ? 'agora' : `há ${segSalvo} s`}${comConta ? '' : ' neste aparelho'}`}
          </p>
          {pausadoNaMao && (
            <p className="sub peq" style={{ marginBottom: 0 }}>
              O microfone está desligado. Clique em Retomar quando quiser voltar a ler.
            </p>
          )}
        </div>
      )}

      <div className="linha" style={{ marginBottom: 14 }}>
        {!ativo && !revisando && <button className="btn pri" onClick={comecar}>🎙️ Começar a ler</button>}
        {(lendo || emPausa) && <button className="btn" onClick={sessao.pausarManual}>⏸ Pausar</button>}
        {pausadoNaMao && <button className="btn pri" onClick={sessao.retomarManual}>▶️ Retomar</button>}
        {ativo && <button className="btn" onClick={() => sessao.encerrar()}>⏹ Terminar e guardar</button>}
        {revisando && (
          <>
            <button className="btn pri" onClick={guardar} disabled={salvando}>{salvando ? 'Guardando…' : '💾 Guardar leitura'}</button>
            {st.audio && <button className="btn" onClick={baixarAudio}>⬇️ Baixar o áudio</button>}
            <button className="btn perigo" onClick={descartar} disabled={salvando}>Descartar</button>
          </>
        )}
      </div>

      {ativo && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>O que você está lendo</h3>
          <div style={{ maxHeight: 260, overflowY: 'auto', whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>
            {st.trechos.length
              ? st.trechos.map((t, i) => (
                <span key={`${t.em}-${i}`} style={duvidoso(t) ? estiloDuvida : undefined} title={duvidoso(t) ? 'O navegador não teve certeza deste trecho' : undefined}>
                  {duvidoso(t) ? '⚠ ' : ''}{t.texto}{' '}
                </span>
              ))
              : <span className="sub">Comece a ler — o texto aparece aqui.</span>}
            {st.parcial && <span className="sub" style={{ fontStyle: 'italic' }}>{st.parcial}…</span>}
            <div ref={fimRef} />
          </div>
        </div>
      )}

      {revisando && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Confira antes de guardar</h3>
          {urlPreview && (
            <div style={{ marginBottom: 12 }}>
              <p className="sub peq" style={{ margin: '0 0 6px' }}>Áudio gravado · {emMB(st.audio?.bytes)} MB</p>
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <audio controls src={urlPreview} style={{ width: '100%' }} />
            </div>
          )}

          {duvidas > 0 && textoLivre == null && (
            <p className="aviso" role="status">
              ⚠ {duvidas} trecho{duvidas === 1 ? '' : 's'} em vermelho: o navegador ouviu com pouca
              certeza. Clique em cada um para trocar pelo que ele também ouviu, ou corrigir à mão.
            </p>
          )}

          {textoLivre == null ? (
            <>
              <div style={{ lineHeight: 2, marginBottom: 10 }}>
                {trechos.map((t, i) => (
                  duvidoso(t) ? (
                    <button
                      key={`${t.em}-${i}`}
                      type="button"
                      onClick={() => setAbertoAlt(abertoAlt === i ? null : i)}
                      aria-expanded={abertoAlt === i}
                      style={{ ...estiloDuvida, border: 0, font: 'inherit', cursor: 'pointer', minHeight: 0, padding: '2px 4px', margin: '0 1px' }}
                    >
                      ⚠ {t.texto}
                    </button>
                  ) : <span key={`${t.em}-${i}`}>{t.texto} </span>
                ))}
              </div>
              {abertoAlt != null && trechos[abertoAlt] && (
                <div className="card" style={{ background: 'var(--pri-claro)' }}>
                  <p className="sub peq" style={{ marginTop: 0 }}>
                    O navegador ouviu isto com {Math.round((trechos[abertoAlt].confianca || 0) * 100)}% de certeza:
                  </p>
                  <p style={{ fontWeight: 700 }}>{trechos[abertoAlt].texto}</p>
                  {trechos[abertoAlt].alternativas?.length > 0 ? (
                    <>
                      <p className="sub peq">Ele também considerou:</p>
                      {trechos[abertoAlt].alternativas.map((alt) => (
                        <button key={alt} className="btn peq" style={{ display: 'block', width: '100%', textAlign: 'left', marginBottom: 4 }} onClick={() => trocarTrecho(abertoAlt, alt)}>
                          {alt}
                        </button>
                      ))}
                    </>
                  ) : <p className="sub peq">Ele não ofereceu outra opção para este trecho.</p>}
                  <label className="campo">Ou escreva a forma certa
                    <input
                      type="text"
                      defaultValue={trechos[abertoAlt].texto}
                      onKeyDown={(e) => { if (e.key === 'Enter') trocarTrecho(abertoAlt, e.currentTarget.value); }}
                      onBlur={(e) => { if (e.target.value !== trechos[abertoAlt].texto) trocarTrecho(abertoAlt, e.target.value); }}
                    />
                  </label>
                  <button className="btn peq" onClick={() => setAbertoAlt(null)}>Fechar</button>
                </div>
              )}
              <button className="btn peq" onClick={() => setTextoLivre(textoFinal)}>✏️ Editar o texto inteiro</button>
            </>
          ) : (
            <>
              <p className="sub peq">A marcação em vermelho some quando você edita o texto corrido.</p>
              <textarea rows={10} value={textoLivre} onChange={(e) => setTextoLivre(e.target.value)} />
            </>
          )}

          <div className="filtros" style={{ marginTop: 10 }}>
            <div><b>{fmtTempo(st.segLidos)}</b><div className="sub peq">lendo</div></div>
            <div><b>{fmtTempo(segPausado)}</b><div className="sub peq">parado</div></div>
            <div><b>{palavras}</b><div className="sub peq">palavras</div></div>
            <div><b>{ritmo || '—'}</b><div className="sub peq">palavras por minuto</div></div>
          </div>
          {st.pausas.length > 0 && (
            <details style={{ marginTop: 10 }}>
              <summary className="sub peq">Ver as {st.pausas.length} pausas</summary>
              <ul className="sub peq">
                {st.pausas.map((p, i) => <li key={p.inicio}>Pausa {i + 1}: {horaCurta(p.inicio)} às {horaCurta(p.fim)} — {fmtTempo(p.segundos)}</li>)}
              </ul>
            </details>
          )}
        </div>
      )}

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
            {l.audio && urlsHist[l.id] && <a className="btn peq" href={urlsHist[l.id]} download>⬇️ Baixar</a>}
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
