// OAB: exame anterior que o candidato ainda aguarda o resultado (ex.: fez a 2ª fase do 47º e
// estuda a 2ª fase do 48º como repescagem, caso não passe). É pessoal: fica nas preferências.
// prefs.exameAnterior = { [idDoConcurso]: { exame, datas: [{ titulo, data, fim }], resultado: null | 'aprovado' | 'reprovado' } }
import { eventosDoConcurso } from '../components/Calendario.jsx';

export const anteriorDe = (prefs, cid) => prefs?.exameAnterior?.[cid] || null;

// "OAB 48" / "48º Exame de Ordem" -> "47º Exame de Ordem"
export function nomeAnterior(c) {
  const n = Number(`${c.sigla} ${c.nome}`.match(/(\d{2,3})\s*[ºo°]?/)?.[1]);
  return n > 1 ? `${n - 1}º Exame de Ordem` : 'Exame anterior';
}

export const DATAS_PADRAO = [
  { titulo: 'Resultado preliminar da 2ª fase', data: '', fim: '' },
  { titulo: 'Prazo para recurso contra o resultado preliminar', data: '', fim: '' },
  { titulo: 'Resultado definitivo da 2ª fase', data: '', fim: '' },
];

// do edital do exame anterior: só o que é da 2ª fase em diante
export function datasDoEdital(lido) {
  return (lido.cronograma || [])
    .filter((e) => e.data && /2[ªa] fase|segunda fase|pr[áa]tico|resultado (final|definitivo)|padr[ãa]o de resposta/i.test(e.evento) && !/inscri|pagamento|isen|reaproveit/i.test(e.evento))
    .map((e) => ({ titulo: e.evento, data: e.data, fim: e.fim || '' }));
}

export function eventosAnterior(prefs, c) {
  const a = anteriorDe(prefs, c.id);
  if (!a) return [];
  return (a.datas || []).filter((d) => d.data).map((d) => ({ data: d.data, fim: d.fim || '', titulo: `${a.exame}: ${d.titulo}`, prova: false, anterior: true }));
}

// todas as datas que interessam ao aluno: as do concurso + as do exame anterior que ele aguarda
export function eventosDoAluno(c, prefs, fase = prefs?.concursos?.[c.id]?.fase) {
  return [...eventosDoConcurso(c, fase), ...eventosAnterior(prefs, c)].sort((x, y) => x.data.localeCompare(y.data));
}

// próxima data ainda pendente do exame anterior (para avisos)
export function proximaDoAnterior(prefs, c) {
  const hoje = new Date().toLocaleDateString('sv-SE');
  return eventosAnterior(prefs, c).filter((e) => (e.fim || e.data) >= hoje).sort((x, y) => x.data.localeCompare(y.data))[0] || null;
}
