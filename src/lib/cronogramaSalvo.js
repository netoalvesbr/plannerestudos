// Reconstrói as sessões de um cronograma já salvo (mesma regra usada na tela do cronograma),
// pra quem só tem a configuração salva (prefs.cronogramas[chave]) e precisa das sessões geradas:
// o Dashboard (progresso de hoje) e o Cronômetro (sugestão de matérias e baixa automática) usam isso.
import { getConcurso } from '../data/concursos.js';
import { disciplinasDo } from './dados.js';
import { gerarCronograma, gerarRevisoes } from './cronograma.js';
import { itensNaOrdem, mesclarConcursos, segmentosSequenciais } from '../components/Cronograma.jsx';
import { verticalizadoDe } from '../components/EditalVerticalizado.jsx';

export function sessoesDoCronograma(k, v, prefs) {
  const cfg = v?.cfg;
  if (!cfg?.inicio || !cfg.janelas) return null;
  let discs;
  let titulo;
  let discursiva = false;
  let abrir;
  if (k.startsWith('mix|')) {
    titulo = '🔀 ' + (v.nome || 'Combinado');
    abrir = { mix: k };
    if (cfg.sequencial) {
      // mesma regra da tela do cronograma: uma prova inteira antes da próxima, pela prioridade escolhida
      const itensOrd = itensNaOrdem(v.mix || [], cfg.ordemItens);
      const segmentos = segmentosSequenciais(itensOrd, cfg.folgaDias, cfg.inicio);
      const sessoes = segmentos.flatMap((seg) => {
        const c = getConcurso(seg.cid);
        const f = c?.fases?.find((x) => x.id === seg.fase);
        const discSeg = disciplinasDo(seg.cid, seg.cargo || 'ambos', seg.fase || '', seg.area || '');
        const cfgSeg = { ...cfg, inicio: seg.inicio, fim: seg.fim };
        const discursivaSeg = (f?.formato || c?.formato) === 'discursiva';
        return gerarCronograma(cfgSeg, discSeg, { discursiva: discursivaSeg }).map((s) => ({ ...s, origemCid: seg.cid, origemSigla: c?.sigla }));
      });
      const fim = segmentos.at(-1)?.fim || cfg.fim;
      return { k, titulo, abrir, sessoes, revisoes: gerarRevisoes(sessoes, { ...cfg, fim }), feitos: v.feitos || {} };
    }
    discs = mesclarConcursos(v.mix || []);
  } else {
    const [cid, fase, area] = k.split('|');
    const c = getConcurso(cid);
    if (!c) return null;
    const f = c.fases?.find((x) => x.id === fase);
    const a = f?.areas?.find((x) => x.id === area);
    const vert = verticalizadoDe(prefs, cid, fase, area);
    const cargo = cfg.cargos?.length ? cfg.cargos : prefs.concursos?.[cid]?.cargo || 'ambos';
    discs = vert ? vert.disciplinas : disciplinasDo(cid, cargo, fase, area);
    discursiva = (f?.formato || c.formato) === 'discursiva';
    titulo = c.sigla + (f ? ` – ${f.nome}` : '') + (a ? ` – ${a.nome}` : '');
    abrir = { cid, fase, area };
  }
  const sessoes = gerarCronograma(cfg, discs, { discursiva });
  return { k, titulo, abrir, sessoes, revisoes: gerarRevisoes(sessoes, cfg), feitos: v.feitos || {} };
}
