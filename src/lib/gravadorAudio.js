// Gravação do áudio da leitura em voz alta.
//
// A ideia é a pessoa poder ouvir depois a própria leitura, para revisar a matéria no carro,
// na academia ou antes da prova. Então o que importa aqui é arquivo pequeno e voz clara —
// não qualidade de música.
//
// Escolhas e por quê:
//  - Opus a 32 kbps, um canal (mono): voz fica bem compreensível e uma hora de leitura dá
//    por volta de 15 MB. Em MP3 na mesma qualidade seria o triplo.
//  - A gravação pausa junto com o cronômetro. Se a pessoa para 10 minutos, esses 10 minutos
//    não entram no arquivo: ela não vai ouvir silêncio depois.
//  - O áudio só é enviado quando a pessoa clica em guardar. Se ela descartar, nada sai do
//    aparelho.

// Formatos em ordem de preferência. O Chrome e o Edge usam o primeiro; o Safari, o mp4.
const FORMATOS = [
  ['audio/webm;codecs=opus', 'webm'],
  ['audio/ogg;codecs=opus', 'ogg'],
  ['audio/webm', 'webm'],
  ['audio/mp4', 'm4a'],
];

export function formatoDisponivel() {
  if (typeof window === 'undefined' || typeof window.MediaRecorder === 'undefined') return null;
  for (const [mime, ext] of FORMATOS) {
    try {
      if (MediaRecorder.isTypeSupported(mime)) return { mime, ext };
    } catch {
      // navegador antigo sem isTypeSupported
    }
  }
  return null;
}

export function suporteGravacao() {
  if (typeof window === 'undefined') return { ok: false, motivo: 'indisponivel' };
  if (typeof window.MediaRecorder === 'undefined') return { ok: false, motivo: 'navegador' };
  if (!navigator.mediaDevices?.getUserMedia) return { ok: false, motivo: 'microfone' };
  if (!formatoDisponivel()) return { ok: false, motivo: 'formato' };
  return { ok: true };
}

export const TEXTO_GRAVACAO = {
  navegador: 'Este navegador não sabe gravar áudio. O texto da leitura continua sendo registrado.',
  microfone: 'Sem acesso ao microfone para gravar. Verifique se o endereço do site começa com https.',
  formato: 'Este navegador não tem um formato de áudio compatível. O texto da leitura continua sendo registrado.',
  indisponivel: 'A gravação funciona apenas no navegador.',
};

// Tamanho em MB com uma casa, para mostrar na tela.
export const emMB = (bytes) => Math.round((bytes || 0) / 104857.6) / 10;

// Quanto tempo de leitura ainda cabe, em horas, dado um limite de espaço.
export const horasPorMB = (mb) => Math.round((mb / 15) * 10) / 10;

/**
 * Cria o gravador. Devolve { iniciar, pausar, retomar, parar, estado, formato }.
 *
 * iniciar() pede o microfone e começa a gravar (pode lançar erro se a pessoa negar).
 * parar()   devolve { blob, ext, mime, bytes } — ou null se nada foi gravado.
 */
export function criarGravador({ aoErro, aoPedaco } = {}) {
  const fmt = formatoDisponivel();
  let stream = null;
  let rec = null;
  let pedacos = [];

  const encerrarStream = () => {
    stream?.getTracks().forEach((t) => {
      try {
        t.stop();
      } catch {
        // já parada
      }
    });
    stream = null;
  };

  return {
    formato: fmt,

    async iniciar() {
      if (!fmt) throw new Error(TEXTO_GRAVACAO.formato);
      pedacos = [];
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      rec = new MediaRecorder(stream, { mimeType: fmt.mime, audioBitsPerSecond: 32000 });
      rec.ondataavailable = (ev) => {
        if (ev.data?.size) {
          pedacos.push(ev.data);
          aoPedaco?.(pedacos.reduce((a, p) => a + p.size, 0));
        }
      };
      rec.onerror = (ev) => aoErro?.(ev.error?.message || 'Falha ao gravar o áudio.');
      rec.start(2000); // entrega um pedaço a cada 2s, para não perder tudo se algo falhar
    },

    pausar() {
      try {
        if (rec?.state === 'recording') rec.pause();
      } catch {
        // alguns navegadores não pausam; segue gravando
      }
    },

    retomar() {
      try {
        if (rec?.state === 'paused') rec.resume();
      } catch {
        // idem
      }
    },

    parar() {
      return new Promise((resolve) => {
        if (!rec || rec.state === 'inactive') {
          encerrarStream();
          resolve(null);
          return;
        }
        rec.onstop = () => {
          encerrarStream();
          if (!pedacos.length) {
            resolve(null);
            return;
          }
          const blob = new Blob(pedacos, { type: fmt.mime });
          pedacos = [];
          resolve({ blob, ext: fmt.ext, mime: fmt.mime, bytes: blob.size });
        };
        try {
          rec.stop();
        } catch {
          encerrarStream();
          resolve(null);
        }
      });
    },

    estado: () => rec?.state || 'inactive',
  };
}
