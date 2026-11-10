import { useCallback, useEffect, useMemo, useState } from 'react';
import { getConcurso, registrarConcursos, todosConcursos } from './data/concursos.js';
import { POR_UID, questoesDo, registrarQuestoesRemotas } from './lib/dados.js';
import * as remoto from './lib/remoto.js';
import NovoConcurso from './components/NovoConcurso.jsx';
import Cronograma from './components/Cronograma.jsx';
import CalendarioGeral from './components/CalendarioGeral.jsx';
import Questoes from './components/Questoes.jsx';
import ImportarProva from './components/ImportarProva.jsx';
import * as store from './lib/store.js';
import { EscolhaArea, EscolhaCargo, EscolhaFase, Ficha, Login, MeusConcursos, NovaSenha } from './components/Concursos.jsx';
import Questao, { Conclusao } from './components/Questao.jsx';
import Painel from './components/Painel.jsx';
import { Mapa } from './components/Mapas.jsx';
import Estudar from './components/Estudar.jsx';
import Biblioteca from './components/Biblioteca.jsx';
import MeusCronogramas from './components/MeusCronogramas.jsx';
import MenuDesempenho from './components/MenuDesempenho.jsx';
import MenuDivulgar from './components/Divulgar.jsx';
import Admin from './components/Admin.jsx';
import Cronometro, { alternarCronometro } from './components/Cronometro.jsx';
import { disciplinasDo } from './lib/dados.js';

// tira o concurso da lista do aluno e apaga os dados pessoais dele (cronograma, edital marcado, verticalizado)
function semDadosDo(prefs, id, apagarTudo = true) {
  const seguindo = (prefs.seguindo || []).filter((x) => x !== id);
  const n = { seguindo, ativo: prefs.ativo === id ? seguindo[0] || null : prefs.ativo };
  if (!apagarTudo) return n;
  const semChave = (obj) => Object.fromEntries(Object.entries(obj || {}).filter(([k]) => k !== id && !k.startsWith(id + '|')));
  return { ...n, concursos: semChave(prefs.concursos), cronogramas: semChave(prefs.cronogramas), verticalizados: semChave(prefs.verticalizados), edital: semChave(prefs.edital) };
}

export default function App() {
  const [carregando, setCarregando] = useState(true);
  const [usuario, setUsuario] = useState(null);
  const [respostas, setRespostas] = useState({});
  const [prefs, setPrefsState] = useState({});
  const [somenteLocal, setSomenteLocal] = useState(false);
  const [tela, setTela] = useState({ nome: 'inicio' });
  const [recuperando, setRecuperando] = useState(false);
  const [bancoVersao, setBancoVersao] = useState(0);
  const [ultimaAba, setUltimaAba] = useState(null);
  const [avisoBanco, setAvisoBanco] = useState(null);

  const recarregarBanco = useCallback(async () => {
    try {
      const b = await remoto.carregarBanco();
      registrarConcursos(b.concursos);
      registrarQuestoesRemotas(b.questoes);
      setAvisoBanco(null);
    } catch (e) {
      console.warn('Banco compartilhado indisponível', e);
      setAvisoBanco('Não foi possível carregar o banco compartilhado agora. Tente recarregar a página.');
    }
    setBancoVersao((v) => v + 1);
  }, []);

  const iniciar = useCallback(async () => {
    setCarregando(true);
    const u = await store.obterUsuario();
    setUsuario(u);
    if (u) {
      remoto.registrarAcesso();
      const d = await store.carregarDados();
      setRespostas(d.respostas);
      setPrefsState(d.prefs);
      setSomenteLocal(d.somenteLocal);
      await recarregarBanco();
    }
    setCarregando(false);
  }, [recarregarBanco]);

  useEffect(() => {
    iniciar();
    return store.aoMudarSessao((ev) => (ev === 'recuperar' ? setRecuperando(true) : iniciar()));
  }, [iniciar]);

  // tema: escolha do usuário ou o do sistema
  const tema = prefs.tema || (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'escuro' : 'claro');
  useEffect(() => {
    document.documentElement.dataset.tema = tema;
  }, [tema]);

  const setPrefs = useCallback((parcial) => {
    setPrefsState((p) => {
      const n = { ...p, ...parcial };
      store.salvarPrefs(n).then((ok) => store.getModo() !== 'local' && !ok && setSomenteLocal(true));
      return n;
    });
  }, []);
  // tempo estudado com o cronômetro: { 'AAAA-MM-DD': { matéria: segundos } }
  const registrarTempo = useCallback((disc, seg) => {
    setPrefsState((p) => {
      const d = new Date().toLocaleDateString('sv-SE');
      const t = { ...(p.tempos || {}) };
      t[d] = { ...(t[d] || {}), [disc]: (t[d]?.[disc] || 0) + seg };
      const n = { ...p, tempos: t };
      store.salvarPrefs(n);
      return n;
    });
  }, []);
  const setPrefConc = (cid, parcial) =>
    setPrefs({ concursos: { ...(prefs.concursos || {}), [cid]: { ...(prefs.concursos?.[cid] || {}), ...parcial } } });

  const concurso = getConcurso(prefs.ativo);
  const pc = (concurso && prefs.concursos?.[concurso.id]) || {};
  const nCargos = concurso?.cargos?.length || 0;
  const precisaCargo = nCargos > 1 && !pc.cargo;
  const cargo = nCargos > 1 ? pc.cargo : concurso?.cargos?.[0]?.id || 'ambos';
  const precisaFase = !!concurso?.fases?.length && !concurso.fases.some((f) => f.id === pc.fase);
  const fase = precisaFase ? null : pc.fase || null;
  const faseObj = concurso?.fases?.find((f) => f.id === fase);
  const precisaArea = !!faseObj?.areas?.length && !faseObj.areas.some((a) => a.id === pc.area);
  const area = faseObj?.areas?.length && !precisaArea ? pc.area : null;
  const unificado = !!prefs.unificado;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const questoes = useMemo(() => (concurso ? questoesDo(concurso.id, cargo, fase, { area }) : []), [concurso, cargo, fase, area, bancoVersao]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const questoesUnificado = useMemo(() => (concurso ? questoesDo(concurso.id, cargo, fase, { unificado: true, area }) : []), [concurso, cargo, fase, area, bancoVersao]);

  function responder(uid, letra, segundos) {
    const q = POR_UID[uid];
    setRespostas((r) => {
      if (r[uid]) return r; // resposta travada
      const n = { ...r, [uid]: [letra, letra === q.gabarito ? 1 : 0, Date.now(), segundos || 0] };
      store.salvarResposta(n, uid).then((ok) => store.getModo() !== 'local' && !ok && setSomenteLocal(true));
      return n;
    });
  }

  async function zerar() {
    const uids = questoes.map((q) => q.uid);
    const n = { ...respostas };
    uids.forEach((u) => delete n[u]);
    setRespostas(n);
    await store.zerarRespostas(n, uids);
  }

  const anotar = (uid, texto) => {
    if ((prefs.notas?.[uid] || '') === texto) return;
    setPrefs({ notas: { ...(prefs.notas || {}), [uid]: texto } });
  };

  if (recuperando) return <div className="app"><NovaSenha aoConcluir={() => { setRecuperando(false); iniciar(); }} /></div>;
  if (carregando) return <div className="app centro" style={{ paddingTop: '30vh' }}>Carregando…</div>;
  if (!usuario) return <div className="app"><Login aoEntrar={iniciar} /></div>;

  const ctx = {
    concurso,
    cargo,
    fase,
    area,
    questoes,
    questoesUnificado,
    unificado,
    usuario,
    bancoVersao,
    respostas,
    prefs,
    setPrefs,
    abrirSessao: (s) => {
      setUltimaAba(tela.aba || null);
      setTela({ nome: 'questao', sessao: s });
    },
    abrirAvulsas: (filtro) => setTela({ nome: 'questoes', aba: 'praticar', filtro, chave: Date.now() }),
    abrirMapa: (d) => setTela({ nome: 'mapa', disciplina: d }),
    irAvulsas: () => setTela({ nome: 'questoes', aba: 'praticar' }),
    abrirFicha: (id) => setTela({ nome: 'ficha', id }),
    irInicio: () => setTela({ nome: 'inicio' }),
    abrirNovoConcurso: () => setTela({ nome: 'novo-concurso' }),
    abrirEditarConcurso: (id) => setTela({ nome: 'editar-concurso', id }),
    abrirImportarProva: (cid, f, a, material = null) => setTela({ nome: 'questoes', aba: 'importar', importar: { cid: cid || concurso?.id, fase: f || fase, area: a || area, material } }),
    excluir: async (id) => {
      try {
        await remoto.excluirConcurso(id);
        setPrefs(semDadosDo(prefs, id));
        await recarregarBanco();
        setTela({ nome: 'concursos' });
      } catch (e) {
        setAvisoBanco('Não foi possível excluir: ' + e.message);
      }
    },
    // concurso pronto da plataforma: não dá para apagar, só tirar da sua lista (e restaurar depois)
    ocultar: (id) => setPrefs({ ...semDadosDo(prefs, id, false), ocultos: [...new Set([...(prefs.ocultos || []), id])] }),
    restaurar: (id) => setPrefs({ ocultos: (prefs.ocultos || []).filter((x) => x !== id) }),
    // grava alterações de um concurso pessoal e recarrega
    atualizarConcurso: async (id, dados) => {
      await remoto.salvarConcurso(dados, null, id);
      await recarregarBanco();
    },
    abrirPainel: () => setTela({ nome: 'painel' }),
    voltar: () => setTela({ nome: 'mapas' }),
    zerar,
    historicoTexto: () => store.historicoComoTexto(respostas, prefs),
  };

  // aba única de questões (também é a tela inicial)
  const hub = () => (
    <Questoes
      ctx={ctx}
      aba={tela.aba}
      filtro={tela.filtro}
      importar={tela.importar}
      aoTrocarAba={(a) => setTela({ nome: 'questoes', aba: a })}
      aoImportado={async (r) => {
        await recarregarBanco();
        setTela({ nome: 'questoes', aba: 'praticar', msg: `✓ Importação concluída: ${r.novas} questões novas no banco${r.repetidas ? ` (${r.repetidas} já existiam e não foram duplicadas)` : ''}.` });
      }}
    />
  );

  // ----- telas sem o topo comum -----
  let conteudo;
  let semTopo = false;
  if (tela.nome === 'questao') {
    semTopo = true;
    conteudo = (
      <Questao
        key={tela.sessao.titulo + tela.sessao.idx}
        sessao={tela.sessao}
        respostas={respostas}
        responder={responder}
        notas={prefs.notas}
        aoAnotar={anotar}
        aoSair={() => setTela({ nome: 'questoes', aba: ultimaAba })}
        aoConcluir={(info) => setTela({ nome: 'conclusao', sessao: tela.sessao, info })}
      />
    );
  } else if (tela.nome === 'conclusao') {
    conteudo = (
      <Conclusao
        sessao={tela.sessao}
        info={tela.info}
        respostas={respostas}
        aoRevisar={(i) => setTela({ nome: 'questao', sessao: { ...tela.sessao, modo: 'estudo', idx: i, titulo: tela.sessao.titulo.replace(/^Simulado · /, 'Revisão · ') } })}
        aoVoltar={() => setTela({ nome: 'questoes', aba: ultimaAba })}
      />
    );
  } else if (tela.nome === 'ficha' && getConcurso(tela.id)) {
    conteudo = <Ficha ctx={ctx} concurso={getConcurso(tela.id)} voltar={() => setTela({ nome: 'concursos' })} />;
  } else if (tela.nome === 'novo-concurso' || tela.nome === 'editar-concurso') {
    conteudo = (
      <NovoConcurso
        key={tela.id || 'novo'}
        inicial={tela.id ? getConcurso(tela.id) : null}
        aoCancelar={() => setTela({ nome: tela.id ? 'ficha' : 'concursos', id: tela.id })}
        escolhaInicial={tela.id ? prefs.concursos?.[tela.id] : null}
        aoSalvar={async (id, escolha) => {
          await recarregarBanco();
          if (escolha) {
            setPrefs({
              seguindo: [...new Set([...(prefs.seguindo || []), id])],
              ativo: id,
              concursos: { ...(prefs.concursos || {}), [id]: { ...(prefs.concursos?.[id] || {}), fase: escolha.fase, area: escolha.area } },
            });
            setTela({ nome: 'cronograma', abrir: { cid: id, fase: escolha.fase || '', area: escolha.area || '' } });
            return;
          }
          if (!tela.id) setPrefs({ seguindo: [...new Set([...(prefs.seguindo || []), id])], ativo: id });
          setTela({ nome: 'ficha', id });
        }}
      />
    );
  } else if (tela.nome === 'biblioteca') {
    conteudo = <Biblioteca ctx={ctx} />;
  } else if (tela.nome === 'admin' && usuario?.admin) {
    conteudo = <Admin />;
  } else if (tela.nome === 'cronograma' && !tela.abrir) {
    conteudo = <MeusCronogramas ctx={ctx} abrir={(a) => setTela({ nome: 'cronograma', abrir: a })} />;
  } else if (tela.nome === 'cronograma' && tela.abrir !== 'ativo' && getConcurso(tela.abrir.cid)) {
    // cronograma de qualquer concurso que a pessoa acompanha (não só o ativo)
    const cc = getConcurso(tela.abrir.cid);
    const pcc = prefs.concursos?.[cc.id] || {};
    const nC = cc.cargos?.length || 0;
    conteudo = (
      <Cronograma
        key={[cc.id, tela.abrir.fase, tela.abrir.area].join('|')}
        ctx={{ ...ctx, concurso: cc, fase: tela.abrir.fase || '', area: tela.abrir.area || '', cargo: nC > 1 ? pcc.cargo || 'ambos' : cc.cargos?.[0]?.id || 'ambos' }}
        voltar={() => setTela({ nome: 'cronograma' })}
      />
    );
  } else if (tela.nome === 'concursos' || !concurso) {
    conteudo = (
      <>
        {tela.msg && <p className="aviso" role="status" style={{ background: 'var(--ok-bg)', color: 'var(--ok)' }}>{tela.msg}</p>}
        {!concurso && <p className="aviso">Olá, {usuario.nome.split(' ')[0]}! Para começar, acompanhe um concurso.</p>}
        <MeusConcursos ctx={ctx} />
      </>
    );
  } else if (tela.nome === 'calendario') {
    conteudo = <CalendarioGeral ctx={ctx} />;
  } else if (tela.nome === 'questoes' && tela.aba === 'importar') {
    conteudo = hub();
  } else if (precisaCargo) {
    conteudo = <EscolhaCargo concurso={concurso} aoEscolher={(v) => setPrefConc(concurso.id, { cargo: v })} />;
  } else if (precisaFase) {
    conteudo = (
      <EscolhaFase
        concurso={concurso}
        aoEscolher={(v) => {
          setPrefConc(concurso.id, { fase: v, area: null });
          const f = concurso.fases.find((x) => x.id === v);
          if (!f?.areas?.length) setTela({ nome: 'cronograma', abrir: 'ativo' });
        }}
      />
    );
  } else if (precisaArea) {
    conteudo = (
      <EscolhaArea
        concurso={concurso}
        fase={faseObj}
        aoEscolher={(v) => {
          setPrefConc(concurso.id, { area: v });
          setTela({ nome: 'cronograma', abrir: 'ativo' });
        }}
      />
    );
  } else if (tela.nome === 'cronograma') {
    conteudo = <Cronograma key={[concurso.id, fase, area].join('|')} ctx={ctx} voltar={() => setTela({ nome: 'cronograma' })} />;
  } else if (tela.nome === 'painel') {
    conteudo = <Painel ctx={ctx} />;
  } else if (tela.nome === 'mapas') {
    conteudo = <Estudar ctx={ctx} />;
  } else if (tela.nome === 'mapa') {
    conteudo = <Mapa ctx={ctx} disciplina={tela.disciplina} />;
  } else {
    conteudo = hub();
  }

  const ir = (nome) => setTela({ nome });
  const hojeIso = new Date().toLocaleDateString('sv-SE');
  const hojeSeg = Object.values(prefs.tempos?.[hojeIso] || {}).reduce((a, b) => a + b, 0);
  let materiasCrono = [];
  try {
    if (concurso) materiasCrono = disciplinasDo(concurso.id, prefs.concursos?.[concurso.id]?.cargo, fase, area).map((d) => d.nome);
  } catch {
    materiasCrono = [];
  }
  const naInicio = tela.nome === 'inicio' || tela.nome === 'questoes';
  const naQuestoes = naInicio;
  const seguindo = prefs.seguindo || [];

  return (
    <div className="app">
      {!semTopo && (
        <header className="topo">
          <div className="topo-linha" style={{ paddingRight: concurso ? 56 : 0 }}>
            <button className="logo" onClick={() => ir('inicio')}>EstudaAí</button>
            <span className="sub">Olá, {usuario.nome.split(' ')[0]}</span>
            {usuario.admin && <button className="btn peq" aria-current={tela.nome === 'admin'} onClick={() => setTela({ nome: 'admin' })} title="Painel do administrador: pessoas e acessos" aria-label="Painel do administrador">👑<span className="so-largo"> Admin</span></button>}
            <MenuDivulgar compacto nome={usuario.nome} />
            {seguindo.length > 1 && (
              <select aria-label="Concurso ativo" value={prefs.ativo || ''} onChange={(e) => { setPrefs({ ativo: e.target.value }); ir('inicio'); }} style={{ width: 'auto' }}>
                {seguindo.map((id) => <option key={id} value={id}>{getConcurso(id)?.sigla}</option>)}
              </select>
            )}
            <button className="btn peq" onClick={alternarCronometro} title="Abrir ou fechar o cronômetro flutuante" aria-label="Cronômetro">⏱<span className="so-largo"> Cronômetro</span></button>
            <button className="btn peq" aria-label={tema === 'escuro' ? 'Usar modo claro' : 'Usar modo escuro'} onClick={() => setPrefs({ tema: tema === 'escuro' ? 'claro' : 'escuro' })}>
              {tema === 'escuro' ? '☀️' : '🌙'}
            </button>
            {store.getModo() !== 'claude' && <button className="btn peq" onClick={() => store.sair().then(iniciar)}>Sair</button>}
          </div>
          {concurso && (
            <nav className="nav" aria-label="Principal">
              <button aria-current={naQuestoes} onClick={() => ir('questoes')}>📝 Questões</button>
              <button aria-current={tela.nome === 'cronograma'} onClick={() => ir('cronograma')}>📆 Cronograma</button>
              <button aria-current={tela.nome === 'calendario'} onClick={() => ir('calendario')}>📅 Calendário</button>
              <button aria-current={tela.nome === 'painel'} onClick={() => ir('painel')}>📊 Painel</button>
              <button aria-current={tela.nome.startsWith('mapa')} onClick={() => ir('mapas')}>📖 Estudar</button>
              <button aria-current={tela.nome === 'biblioteca'} onClick={() => ir('biblioteca')}>📚 Biblioteca</button>
              <button aria-current={tela.nome === 'concursos' || tela.nome === 'ficha'} onClick={() => ir('concursos')}>🏆 Concursos</button>
            </nav>
          )}
        </header>
      )}
      {somenteLocal && !semTopo && naInicio && <p className="aviso">Respostas salvas apenas neste aparelho.</p>}
      {avisoBanco && !semTopo && <p className="aviso">{avisoBanco}</p>}
      {tela.nome === 'questoes' && tela.msg && <p className="aviso" role="status" style={{ background: 'var(--ok-bg)', color: 'var(--ok)' }}>{tela.msg}</p>}
      <main>{conteudo}</main>
      {!semTopo && <Cronometro materias={materiasCrono} hojeSeg={hojeSeg} aoRegistrar={registrarTempo} />}
      {concurso && !precisaCargo && !precisaFase && <MenuDesempenho questoes={questoes} respostas={respostas} aoAbrirPainel={() => ir('painel')} />}
    </div>
  );
}
