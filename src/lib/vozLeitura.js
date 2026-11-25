// Reconhecimento de fala para a leitura em voz alta.
//
// Usa a Web Speech API, que já vem no navegador — não há servidor nosso nem custo por minuto.
// Duas limitações que o aplicativo precisa avisar para a pessoa, e não esconder:
//  1. Só existe no Chrome, no Edge e no Chrome do Android. No Firefox não existe, e no
//     Safari do iPhone é instável.
//  2. No Chrome o áudio é enviado ao serviço de transcrição do Google. Por isso precisa de
//     internet, e por isso está declarado na política de privacidade.
//
// O navegador corta a escuta sozinho depois de um tempo de silêncio ou de alguns minutos de
// fala. Para a pessoa poder ler um capítulo inteiro sem ficar clicando, religamos a escuta
// automaticamente enquanto a sessão estiver ativa (ver `religar`).

const Reconhecimento = typeof window !== 'undefined'
  ? (window.SpeechRecognition || window.webkitSpeechRecognition)
  : null;

// Por que a leitura pode não funcionar neste navegador. Mensagem pronta para mostrar na tela.
export function suporteVoz() {
  if (typeof window === 'undefined') return { ok: false, motivo: 'indisponivel' };
  if (!Reconhecimento) {
    const ua = navigator.userAgent || '';
    const iOS = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    if (/Firefox/.test(ua)) return { ok: false, motivo: 'firefox' };
    if (iOS) return { ok: false, motivo: 'ios' };
    return { ok: false, motivo: 'navegador' };
  }
  if (!navigator.mediaDevices?.getUserMedia) return { ok: false, motivo: 'microfone' };
  return { ok: true };
}

export const TEXTO_SUPORTE = {
  firefox: 'O Firefox não tem reconhecimento de fala. Abra o EstudaAí no Chrome ou no Edge para usar a leitura em voz alta.',
  ios: 'O Safari do iPhone e do iPad não reconhece a fala de forma confiável. Use o Chrome no computador ou no Android.',
  navegador: 'Este navegador não reconhece a fala. Use o Chrome ou o Edge, no computador ou no Android.',
  microfone: 'Este navegador não deu acesso ao microfone. Verifique se o endereço do site começa com https.',
  indisponivel: 'A leitura em voz alta funciona apenas no navegador.',
};

export const TEXTO_ERRO = {
  'not-allowed': 'O microfone foi bloqueado. Clique no ícone de cadeado ao lado do endereço do site e libere o microfone.',
  'service-not-allowed': 'O navegador bloqueou o serviço de transcrição. Verifique as permissões do site.',
  'audio-capture': 'Nenhum microfone foi encontrado. Verifique se ele está conectado e não está em uso por outro programa.',
  network: 'Sem conexão com o serviço de transcrição. A leitura em voz alta precisa de internet.',
  'language-not-supported': 'O português não está disponível para transcrição neste navegador.',
};

// Conta palavras de verdade: ignora espaços repetidos e pontuação solta.
export function contarPalavras(texto) {
  const limpo = String(texto || '').trim();
  if (!limpo) return 0;
  return limpo.split(/\s+/).filter((p) => /[\p{L}\p{N}]/u.test(p)).length;
}

// Palavras por minuto, para a pessoa acompanhar o próprio ritmo de leitura.
export function porMinuto(palavras, segundos) {
  if (!segundos) return 0;
  return Math.round((palavras / segundos) * 60);
}

// Primeira letra maiúscula e ponto no fim, para o registro não virar um bloco sem respiro.
// Não corrige o conteúdo: só arruma a aparência do que o navegador devolveu.
export function arrumarTrecho(trecho) {
  const t = String(trecho || '').trim();
  if (!t) return '';
  const comMaiuscula = t.charAt(0).toUpperCase() + t.slice(1);
  return /[.!?…]$/.test(comMaiuscula) ? comMaiuscula : `${comMaiuscula}.`;
}

/**
 * Cria o leitor. Devolve { iniciar, parar, ativo }.
 *
 * aoTrecho(texto)   — chamado a cada pedaço que o navegador considera pronto
 * aoParcial(texto)  — o que está sendo falado agora, ainda pode mudar
 * aoErro(codigo)    — código da Web Speech API; use TEXTO_ERRO para a mensagem
 * aoParar()         — a escuta terminou e não vai religar (erro grave ou parada pedida)
 */
export function criarLeitor({ idioma = 'pt-BR', aoTrecho, aoParcial, aoErro, aoParar } = {}) {
  let rec = null;
  let querendoOuvir = false;
  let religando = null;

  // Erros em que não faz sentido insistir: religar só repetiria o mesmo bloqueio.
  const fatal = (e) => ['not-allowed', 'service-not-allowed', 'audio-capture', 'language-not-supported'].includes(e);

  const montar = () => {
    const r = new Reconhecimento();
    r.lang = idioma;
    r.continuous = true;
    r.interimResults = true;
    r.maxAlternatives = 1;

    r.onresult = (ev) => {
      let parcial = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const res = ev.results[i];
        const texto = res[0]?.transcript || '';
        if (res.isFinal) aoTrecho?.(texto.trim());
        else parcial += texto;
      }
      aoParcial?.(parcial.trim());
    };

    r.onerror = (ev) => {
      // 'no-speech' e 'aborted' são rotina: a pessoa parou para virar a página.
      if (ev.error === 'no-speech' || ev.error === 'aborted') return;
      aoErro?.(ev.error);
      if (fatal(ev.error)) {
        querendoOuvir = false;
        aoParar?.();
      }
    };

    // O navegador encerra sozinho; enquanto a sessão estiver ativa, religamos.
    r.onend = () => {
      aoParcial?.('');
      if (!querendoOuvir) {
        aoParar?.();
        return;
      }
      clearTimeout(religando);
      religando = setTimeout(() => {
        if (!querendoOuvir) return;
        try {
          rec.start();
        } catch {
          // já estava ligado: nada a fazer
        }
      }, 300);
    };

    return r;
  };

  return {
    iniciar() {
      if (!Reconhecimento) throw new Error(TEXTO_SUPORTE.navegador);
      if (querendoOuvir) return;
      querendoOuvir = true;
      rec = montar();
      try {
        rec.start();
      } catch (e) {
        querendoOuvir = false;
        throw e;
      }
    },
    parar() {
      querendoOuvir = false;
      clearTimeout(religando);
      try {
        rec?.stop();
      } catch {
        // já estava parado
      }
    },
    ativo: () => querendoOuvir,
  };
}
