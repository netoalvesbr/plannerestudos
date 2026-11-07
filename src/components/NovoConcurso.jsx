import { useState } from 'react';
import { lerEdital } from '../lib/leitura.js';
import { salvarConcurso } from '../lib/remoto.js';

const FORMATOS = [
  ['A-E', 'Múltipla escolha A a E'],
  ['A-D', 'Múltipla escolha A a D (ex.: OAB 1ª fase)'],
  ['CE', 'Certo ou Errado (ex.: Cebraspe)'],
  ['discursiva', 'Discursiva / peça (ex.: OAB 2ª fase)'],
];

const vazio = {
  sigla: '',
  nome: '',
  orgao: '',
  banca: '',
  edital: '',
  dataProva: '',
  formato: 'A-E',
  fases: [],
  cronograma: [],
  disciplinas: [],
};

const campo = { width: '100%', minHeight: 40, padding: '6px 9px', borderRadius: 9, border: '1px solid var(--borda)', background: 'var(--card)', color: 'var(--txt)', font: 'inherit' };

export default function NovoConcurso({ inicial, aoSalvar, aoCancelar }) {
  const [c, setC] = useState(() => ({ ...vazio, ...(inicial || {}), disciplinas: (inicial?.disciplinas || []).map((d) => ({ ...d, topicosTxt: (d.topicos || []).join('\n') })) }));
  const [pdf, setPdf] = useState(null);
  const [lendo, setLendo] = useState(null);
  const [erro, setErro] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const set = (k, v) => setC((x) => ({ ...x, [k]: v }));
  const setItem = (lista, i, k, v) => setC((x) => ({ ...x, [lista]: x[lista].map((it, j) => (j === i ? { ...it, [k]: v } : it)) }));
  const remover = (lista, i) => setC((x) => ({ ...x, [lista]: x[lista].filter((_, j) => j !== i) }));
  const incluir = (lista, it) => setC((x) => ({ ...x, [lista]: [...x[lista], it] }));

  async function importarEdital(arquivo) {
    if (!arquivo) return;
    setErro(null);
    setPdf(arquivo);
    setLendo('Abrindo o PDF…');
    try {
      const { textoDoPdf } = await import('../lib/pdf.js');
      const linhas = await textoDoPdf(arquivo, (p, n) => setLendo(`Lendo página ${p} de ${n}…`));
      if (linhas.filter(Boolean).length < 5) throw new Error('Não encontrei texto neste PDF. Ele pode ser uma imagem escaneada; nesse caso, preencha os campos à mão.');
      const r = lerEdital(linhas);
      setC((x) => ({
        ...x,
        sigla: x.sigla || r.sigla,
        nome: x.nome || r.nome,
        orgao: x.orgao || r.orgao,
        banca: x.banca || r.banca,
        edital: x.edital || r.edital,
        dataProva: x.dataProva || r.dataProva,
        cronograma: x.cronograma.length ? x.cronograma : r.cronograma,
        disciplinas: x.disciplinas.length ? x.disciplinas : r.disciplinas.map((d) => ({ ...d, fase: '', topicosTxt: d.topicos.join('\n') })),
      }));
      setLendo(`Edital lido: ${r.disciplinas.length} disciplinas, ${r.cronograma.length} datas encontradas. Confira tudo abaixo antes de salvar.`);
    } catch (e) {
      setErro(e.message);
      setLendo(null);
    }
  }

  async function salvar(e) {
    e.preventDefault();
    setErro(null);
    if (!c.sigla.trim() || !c.nome.trim()) return setErro('Preencha pelo menos a sigla e o nome do concurso.');
    setSalvando(true);
    try {
      const dados = {
        ...c,
        sigla: c.sigla.trim(),
        nome: c.nome.trim(),
        fases: c.fases.filter((f) => f.nome.trim()).map((f, i) => ({ ...f, id: f.id || `f${i + 1}`, nome: f.nome.trim() })),
        cronograma: c.cronograma.filter((x) => x.data && x.evento),
        disciplinas: c.disciplinas
          .filter((d) => d.nome.trim())
          .map(({ topicosTxt, ...d }) => ({ ...d, nome: d.nome.trim(), topicos: (topicosTxt || '').split('\n').map((t) => t.trim()).filter(Boolean) })),
      };
      const id = await salvarConcurso(dados, pdf, inicial?.id || null);
      aoSalvar(id);
    } catch (er) {
      setErro(er.message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={salvar}>
      <button type="button" className="btn peq" onClick={aoCancelar} style={{ marginBottom: 10 }}>← Voltar</button>
      <h1>{inicial ? 'Editar concurso' : 'Adicionar concurso'}</h1>
      <p className="sub">O concurso fica disponível para todos os usuários da plataforma. Cada pessoa escolhe se quer acompanhá-lo.</p>

      <section className="card">
        <h2>📄 Importar edital (PDF)</h2>
        <p className="sub">A plataforma lê o edital e preenche sozinha o que encontrar: órgão, banca, data da prova, cronograma e o conteúdo programático (edital verticalizado). O PDF fica disponível para todos baixarem.</p>
        <input type="file" accept="application/pdf" onChange={(e) => importarEdital(e.target.files[0])} />
        {lendo && <p className="aviso" style={{ marginTop: 10, background: 'var(--pri-claro)', color: 'var(--txt)' }} role="status">{lendo}</p>}
        {inicial?.editalUrl && !pdf && <p className="sub" style={{ marginTop: 8 }}>Edital atual: <a href={inicial.editalUrl} target="_blank" rel="noreferrer">abrir PDF</a></p>}
      </section>

      <section className="card">
        <h2>Dados do concurso</h2>
        <div className="filtros">
          <label className="campo">Sigla *<input style={campo} value={c.sigla} onChange={(e) => set('sigla', e.target.value)} placeholder="Ex.: OAB, PC/AC" /></label>
          <label className="campo">Nome *<input style={campo} value={c.nome} onChange={(e) => set('nome', e.target.value)} placeholder="Ex.: Exame de Ordem Unificado" /></label>
          <label className="campo">Órgão<input style={campo} value={c.orgao} onChange={(e) => set('orgao', e.target.value)} /></label>
          <label className="campo">Banca<input style={campo} value={c.banca} onChange={(e) => set('banca', e.target.value)} placeholder="Ex.: FGV" /></label>
          <label className="campo">Edital<input style={campo} value={c.edital} onChange={(e) => set('edital', e.target.value)} placeholder="Ex.: Edital nº 1/2026" /></label>
          <label className="campo">Data da prova<input type="date" style={campo} value={c.dataProva || ''} onChange={(e) => set('dataProva', e.target.value)} /></label>
          <label className="campo">Formato das questões
            <select value={c.formato} onChange={(e) => set('formato', e.target.value)}>
              {FORMATOS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
            </select>
          </label>
        </div>
      </section>

      <section className="card">
        <h2>Fases</h2>
        <p className="sub">Opcional. Ex.: OAB – "1ª fase" (A a D) e "2ª fase" (discursiva). Quem acompanha o concurso escolhe a fase que vai estudar.</p>
        {c.fases.map((f, i) => (
          <div key={i} className="linha" style={{ marginBottom: 8, flexWrap: 'nowrap' }}>
            <input style={{ ...campo, flex: 2 }} value={f.nome} onChange={(e) => setItem('fases', i, 'nome', e.target.value)} placeholder="Nome da fase" aria-label="Nome da fase" />
            <select style={{ flex: 2 }} value={f.formato || c.formato} onChange={(e) => setItem('fases', i, 'formato', e.target.value)} aria-label="Formato da fase">
              {FORMATOS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
            </select>
            <input type="date" style={{ ...campo, flex: 1.4 }} value={f.data || ''} onChange={(e) => setItem('fases', i, 'data', e.target.value)} aria-label="Data da fase" />
            <button type="button" className="btn peq perigo" onClick={() => remover('fases', i)} aria-label="Remover fase">✕</button>
          </div>
        ))}
        <button type="button" className="btn peq" onClick={() => incluir('fases', { id: 'f' + Math.random().toString(36).slice(2, 8), nome: `${c.fases.length + 1}ª fase`, formato: c.formato, data: '' })}>+ Adicionar fase</button>
      </section>

      <section className="card">
        <h2>Cronograma</h2>
        {c.cronograma.map((x, i) => (
          <div key={i} className="linha" style={{ marginBottom: 8, flexWrap: 'nowrap' }}>
            <input type="date" style={{ ...campo, flex: 1.3 }} value={x.data || ''} onChange={(e) => setItem('cronograma', i, 'data', e.target.value)} aria-label="Data" />
            <input style={{ ...campo, flex: 3 }} value={x.evento} onChange={(e) => setItem('cronograma', i, 'evento', e.target.value)} placeholder="Evento" aria-label="Evento" />
            <button type="button" className="btn peq perigo" onClick={() => remover('cronograma', i)} aria-label="Remover data">✕</button>
          </div>
        ))}
        <button type="button" className="btn peq" onClick={() => incluir('cronograma', { data: '', evento: '' })}>+ Adicionar data</button>
      </section>

      <section className="card">
        <h2>Conteúdo programático (edital verticalizado)</h2>
        <p className="sub">Uma disciplina por bloco; um tópico por linha.</p>
        {c.disciplinas.map((d, i) => (
          <div key={i} className="card" style={{ boxShadow: 'none', background: 'var(--bg)' }}>
            <div className="linha" style={{ flexWrap: 'nowrap', marginBottom: 6 }}>
              <input style={{ ...campo, flex: 3, fontWeight: 700 }} value={d.nome} onChange={(e) => setItem('disciplinas', i, 'nome', e.target.value)} placeholder="Disciplina" aria-label="Disciplina" />
              <button type="button" className="btn peq perigo" onClick={() => remover('disciplinas', i)} aria-label={`Remover ${d.nome}`}>✕</button>
            </div>
            <div className="linha" style={{ flexWrap: 'nowrap', marginBottom: 6 }}>
              <input style={{ ...campo, flex: 2 }} value={d.bloco || ''} onChange={(e) => setItem('disciplinas', i, 'bloco', e.target.value)} placeholder="Bloco (ex.: Conhecimentos Básicos)" aria-label="Bloco" />
              {c.fases.length > 0 && (
                <select style={{ flex: 1 }} value={d.fase || ''} onChange={(e) => setItem('disciplinas', i, 'fase', e.target.value)} aria-label="Fase">
                  <option value="">Todas as fases</option>
                  {c.fases.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
                </select>
              )}
            </div>
            <textarea rows={Math.min(8, Math.max(3, (d.topicosTxt || '').split('\n').length))} style={{ ...campo, minHeight: 70 }} value={d.topicosTxt || ''} onChange={(e) => setItem('disciplinas', i, 'topicosTxt', e.target.value)} placeholder="Tópicos, um por linha" aria-label={`Tópicos de ${d.nome}`} />
          </div>
        ))}
        <button type="button" className="btn peq" onClick={() => incluir('disciplinas', { nome: '', bloco: '', fase: '', topicosTxt: '' })}>+ Adicionar disciplina</button>
      </section>

      {erro && <p className="aviso" role="alert">{erro}</p>}
      <div className="linha">
        <button className="btn pri" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar concurso'}</button>
        <button type="button" className="btn" onClick={aoCancelar}>Cancelar</button>
      </div>
    </form>
  );
}
