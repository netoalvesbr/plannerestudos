// A leitura em voz alta em andamento vive aqui, fora das telas.
//
// Por que fora: antes a sessão morava dentro do componente da tela. Ao trocar de tela, o
// React desmontava o componente e levava junto o microfone, o cronômetro e — pior — tudo
// que já tinha sido lido. Agora a tela só mostra o que este arquivo guarda, e sair dela
// não interrompe nada.
//
// O que isso resolve, em ordem de importância:
//  1. Trocar de página, recarregar ou cair a internet não apaga mais o que foi lido: um
//     rascunho é gravado no aparelho a cada poucos segundos e pode ser recuperado depois.
//  2. A leitura continua enquanto a pessoa usa o resto da plataforma (janela flutuante).
//  3. A pessoa pode pausar e retomar na mão, além da pausa automática no silêncio.
//
// Limite honesto: o áudio não é recuperável depois de a aba fechar. O texto é recuperado,
// o áudio não — por isso avisamos antes de sair da página com leitura aberta.

import { getModo } from './store.js';
import { atualizarLeitura, salvarLeitura } from './remoto.js';
import { criarGravador, suporteGravacao } from './gravadorAudio.js';
import { arrumarTrecho, contarPalavras, criarLeitor, TEXTO_ERRO } from './vozLeitura.js';

const CHAVE = 'estudaai.leitura.rascunho';
const EVENTO = 'estudaai:leitura';

const MS_RASCUNHO = 2000;   // grava no aparelho a cada 2 segundos
const MS_CONTA = 30000;     // manda para a conta a cada 30 segundos
const LIMIAR_PADRAO = 6;    // segundos de silêncio para considerar que parou de ler

const vazio = () => ({
  ativa: false,
  fase: 'parado', // parado | lendo | pausa | manual | revisando
  cfg: {},
  trechos: [],
  parcial: '',
  segLidos: 0,
  segTotais: 0,
  pausas: [],
  inicio: 0,
  bytesAudio: 0,
  audio: null,
  idRemoto: null,
  salvoEm: 0,
  salvando: false,
  erroSalvar: null,
  erro: null,
});

let st = vazio();
const ouvintes = new Set();

let leitor = null;
let gravador = null;
let relogio = null;
let tickRascunho = null;
let tickConta = null;
let ultimaFala = 0;
let pausaAberta = null;

const agora = () => Date.now();

function avisar() {
  for (const fn of ouvintes) {
    try {
      fn(st);
    } catch {
      // um ouvinte quebrado não pode derrubar os outros
    }
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENTO));
}

const mudar = (campos) => {
  st = { ...st, ...campos };
  avisar();
};

export function assinar(fn) {
  ouvintes.add(fn);
  fn(st);
  return () => ouvintes.delete(fn);
}

export const estado = () => st;
export const textoCorrido = (trechos = st.trechos) => trechos.map((t) => t.texto).join(' ');
export const palavrasDe = (trechos = st.trechos) => contarPalavras(textoCorrido(trechos));

// ---------- rascunho no aparelho ----------
function gravarRascunho() {
  if (!st.ativa && st.fase !== 'revisando') return;
  try {
    localStorage.setItem(CHAVE, JSON.stringify({
      cfg: st.cfg,
      trechos: st.trechos,
      segLidos: st.segLidos,
      segTotais: st.segTotais,
      pausas: st.pausas,
      inicio: st.inicio,
      idRemoto: st.idRemoto,
      em: agora(),
    }));
    mudar({ salvoEm: agora() });
  } catch {
    // armazenamento cheio: a leitura continua, só não há rascunho
  }
}

export function rascunho() {
  try {
    const r = JSON.parse(localStorage.getItem(CHAVE) || 'null');
    return r && r.trechos?.length ? r : null;
  } catch {
    return null;
  }
}

export function limparRascunho() {
  try {
    localStorage.removeItem(CHAVE);
  } catch {
    // nada a fazer
  }
}

// ---------- salvamento na conta ----------
async function gravarNaConta({ finalizando = false } = {}) {
  if (getModo() !== 'conta') return; // sem conta, o rascunho no aparelho já é o registro
  if (st.salvando) return;
  if (!st.trechos.length && !finalizando) return;
  mudar({ salvando: true, erroSalvar: null });
  const dados = {
    concursoId: st.cfg.concursoId,
    materia: st.cfg.materia,
    assunto: st.cfg.assunto,
    obra: st.cfg.obra,
    paginaIni: st.cfg.paginaIni,
    paginaFim: st.cfg.paginaFim,
    texto: textoCorrido(),
    palavras: palavrasDe(),
    segundos: st.segLidos,
  };
  try {
    if (st.idRemoto) {
      await atualizarLeitura(st.idRemoto, dados);
    } else {
      const linha = await salvarLeitura(dados);
      st = { ...st, idRemoto: linha?.id || null };
    }
    mudar({ salvando: false, salvoEm: agora() });
  } catch (e) {
    // Falhar aqui não pode parar a leitura: o rascunho no aparelho continua guardando.
    mudar({ salvando: false, erroSalvar: e.message });
  }
}

export const salvarAgora = () => gravarNaConta();

// ---------- relógio de 1 segundo ----------
function ligarRelogio() {
  clearInterval(relogio);
  relogio = setInterval(() => {
    if (!st.ativa) return;
    const segTotais = Math.round((agora() - st.inicio) / 1000);
    if (st.fase !== 'lendo') {
      mudar({ segTotais });
      return;
    }
    const limiar = Number(st.cfg.limiar) || LIMIAR_PADRAO;
    let segLidos = st.segLidos + 1;
    if (agora() - ultimaFala > limiar * 1000) {
      // Os segundos de silêncio já contados são devolvidos: o tempo de leitura fica honesto.
      segLidos = Math.max(0, segLidos - limiar);
      pausaAberta = { inicio: ultimaFala };
      gravador?.pausar();
      st = { ...st, segLidos, segTotais, fase: 'pausa' };
      avisar();
      return;
    }
    mudar({ segLidos, segTotais });
  }, 1000);
}

function fecharPausa() {
  if (!pausaAberta) return;
  const limiar = Number(st.cfg.limiar) || LIMIAR_PADRAO;
  const seg = Math.round((agora() - pausaAberta.inicio) / 1000);
  if (seg >= limiar) st = { ...st, pausas: [...st.pausas, { ...pausaAberta, fim: agora(), segundos: seg }] };
  pausaAberta = null;
}

// fala detectada: se estava em pausa automática, retoma sozinho
function marcarFala() {
  ultimaFala = agora();
  if (st.fase === 'pausa') {
    fecharPausa();
    gravador?.retomar();
    mudar({ fase: 'lendo' });
  }
}

// ---------- começar, pausar, encerrar ----------
export async function iniciar(cfg) {
  if (st.ativa) return;
  st = {
    ...vazio(),
    ativa: true,
    fase: 'lendo',
    cfg: { limiar: LIMIAR_PADRAO, ...cfg },
    inicio: agora(),
  };
  ultimaFala = agora();
  pausaAberta = null;
  avisar();

  // a gravação pede o microfone primeiro: uma permissão serve para as duas coisas
  if (cfg.gravar && suporteGravacao().ok) {
    const g = criarGravador({
      aoErro: (m) => mudar({ erro: m }),
      aoPedaco: (b) => mudar({ bytesAudio: b }),
    });
    try {
      await g.iniciar();
      gravador = g;
    } catch (e) {
      gravador = null;
      mudar({
        erro: /denied|not allowed/i.test(e.message || '')
          ? 'O microfone foi bloqueado. Clique no cadeado ao lado do endereço do site e libere o microfone.'
          : `Não foi possível gravar o áudio: ${e.message}. A leitura segue sem gravação.`,
      });
    }
  }

  leitor = criarLeitor({
    aoTrecho: (t) => {
      if (!t?.texto) return;
      marcarFala();
      st = {
        ...st,
        trechos: [...st.trechos, {
          texto: arrumarTrecho(t.texto),
          confianca: t.confianca,
          alternativas: t.alternativas || [],
          em: agora(),
        }],
      };
      avisar();
    },
    aoParcial: (t) => {
      if (t) marcarFala();
      mudar({ parcial: t });
    },
    aoErro: (cod) => mudar({ erro: TEXTO_ERRO[cod] || `O navegador relatou um problema no microfone (${cod}).` }),
    aoParar: () => {
      if (st.ativa && st.fase !== 'manual') encerrar({ porErro: true });
    },
  });
  try {
    leitor.iniciar();
  } catch (e) {
    mudar({ erro: e.message || 'Não foi possível ligar o microfone.' });
  }

  ligarRelogio();
  clearInterval(tickRascunho);
  clearInterval(tickConta);
  tickRascunho = setInterval(gravarRascunho, MS_RASCUNHO);
  tickConta = setInterval(() => gravarNaConta(), MS_CONTA);
}

// pausa pedida pela pessoa: para o cronômetro, a escuta e a gravação até ela mandar voltar
export function pausarManual() {
  if (!st.ativa || st.fase === 'manual') return;
  fecharPausa();
  // A fase muda ANTES de parar o leitor. Parar dispara o `aoParar` dele, que olha a fase
  // para decidir se a leitura caiu sozinha; com a fase antiga, ele encerrava a sessão
  // inteira achando que tinha sido uma queda.
  st = { ...st, fase: 'manual', parcial: '' };
  avisar();
  leitor?.parar();
  gravador?.pausar();
  gravarRascunho();
  gravarNaConta();
}

export function retomarManual() {
  if (!st.ativa || st.fase !== 'manual') return;
  ultimaFala = agora();
  try {
    leitor?.iniciar();
  } catch {
    // o leitor pode ter sido encerrado pelo navegador; recriamos abaixo
  }
  if (!leitor?.ativo?.()) {
    leitor = criarLeitor({
      aoTrecho: (t) => {
        if (!t?.texto) return;
        marcarFala();
        st = { ...st, trechos: [...st.trechos, { texto: arrumarTrecho(t.texto), confianca: t.confianca, alternativas: t.alternativas || [], em: agora() }] };
        avisar();
      },
      aoParcial: (t) => { if (t) marcarFala(); mudar({ parcial: t }); },
      aoErro: (cod) => mudar({ erro: TEXTO_ERRO[cod] || `Problema no microfone (${cod}).` }),
      aoParar: () => { if (st.ativa && st.fase !== 'manual') encerrar({ porErro: true }); },
    });
    try {
      leitor.iniciar();
    } catch (e) {
      mudar({ erro: e.message });
      return;
    }
  }
  gravador?.retomar();
  mudar({ fase: 'lendo' });
}

// encerra a escuta e deixa a sessão pronta para revisão e gravação final
export async function encerrar({ porErro = false } = {}) {
  if (!st.ativa || st.fase === 'revisando') return st;
  fecharPausa();
  clearInterval(relogio);
  clearInterval(tickRascunho);
  clearInterval(tickConta);
  // Mesma armadilha da pausa manual, e aqui ela era pior: parar o leitor chamava esta
  // função de novo, que parava o leitor de novo, sem fim, até estourar a pilha.
  st = {
    ...st,
    ativa: false, // acabou de ouvir: a tela deve mostrar a revisão, não a leitura ao vivo
    fase: 'revisando',
    parcial: '',
    erro: porErro ? 'A escuta foi interrompida. O que já foi lido está guardado.' : st.erro,
  };
  avisar();
  leitor?.parar();
  leitor = null;

  const g = gravador;
  gravador = null;
  if (g) {
    const a = await g.parar();
    if (a) mudar({ audio: a });
  }
  gravarRascunho();
  await gravarNaConta({ finalizando: true });
  return st;
}

// a pessoa guardou de vez: limpa tudo
export function concluir() {
  clearInterval(relogio);
  clearInterval(tickRascunho);
  clearInterval(tickConta);
  limparRascunho();
  st = vazio();
  avisar();
}

export function descartar() {
  st = { ...st, ativa: false, fase: 'parado' };
  leitor?.parar();
  gravador?.parar();
  leitor = null;
  gravador = null;
  concluir();
}

// retoma um rascunho deixado por uma aba que fechou
export function recuperar(r) {
  st = {
    ...vazio(),
    ativa: false,
    fase: 'revisando',
    cfg: r.cfg || {},
    trechos: r.trechos || [],
    segLidos: r.segLidos || 0,
    segTotais: r.segTotais || 0,
    pausas: r.pausas || [],
    inicio: r.inicio || agora(),
    idRemoto: r.idRemoto || null,
  };
  avisar();
  return st;
}

// Avisa antes de fechar a aba com leitura aberta: o texto é recuperável, o áudio não.
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', (e) => {
    if (!st.ativa) return;
    gravarRascunho();
    e.preventDefault();
    e.returnValue = '';
  });
}
