import { useState } from 'react';
import { lerEdital } from '../lib/leitura.js';
import { salvarConcurso } from '../lib/remoto.js';
import { diasAte, fmtData } from '../lib/stats.js';
import { aplicarModeloOAB, ehOAB } from '../data/modelos.js';

const slug = (t) => t.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '');

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

export default function NovoConcurso({ inicial, escolhaInicial, aoSalvar, aoCancelar }) {
  const [c, setC] = useState(() => ({ ...vazio, ...(inicial || {}), disciplinas: (inicial?.disciplinas || []).map((d) => ({ ...d, topicosTxt: (d.topicos || []).join('\n') })) }));
  const [pdf, setPdf] = useState(null);
  const [lendo, setLendo] = useState(null);
  const [erro, setErro] = useState(null);
  const [salvando, setSalvando] = useState(false);
  // escolha pessoal de quem está cadastrando: fase que vai estudar, fases descartadas e área
  const [estudar, setEstudar] = useState(escolhaInicial?.fase || null);
  const [area, setArea] = useState(escolhaInicial?.area || null);
  const [descartadas, setDescartadas] = useState([]);
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
      const oab = ehOAB(r);
      setC((x) => {
        const novo = {
        ...x,
        sigla: x.sigla || r.sigla,
        nome: x.nome || r.nome,
        orgao: x.orgao || r.orgao,
        banca: x.banca || r.banca,
        edital: x.edital || r.edital,
        dataProva: x.dataProva || r.dataProva,
        cronograma: x.cronograma.length ? x.cronograma : r.cronograma,
        disciplinas: x.disciplinas.length ? x.disciplinas : r.disciplinas.map((d) => ({ ...d, fase: '', topicosTxt: d.topicos.join('\n') })),
        };
        return oab && !x.fases.length ? aplicarModeloOAB(novo, r.datasFases) : novo;
      });
      setLendo(
        `Edital lido: ${r.disciplinas.length} disciplinas, ${r.cronograma.length} datas encontradas.` +
          (oab ? ' Reconheci o Exame de Ordem: apliquei o modelo OAB/FGV (1ª fase objetiva e 2ª fase com as 7 áreas).' : '') +
          ' Confira tudo abaixo antes de salvar.',
      );
    } catch (e) {
      setErro(e.message);
      setLendo(null);
    }
  }

  async function salvar(e) {
    e.preventDefault();
    setErro(null);
    if (!c.sigla.trim() || !c.nome.trim()) return setErro('Preencha pelo menos a sigla e o nome do concurso.');
    const fEsc = c.fases.find((f) => f.id === estudar);
    if (fEsc?.areas?.length && !area) return setErro(`Escolha a sua matéria da ${fEsc.nome.split(' –')[0]} (uma das ${fEsc.areas.length} áreas).`);
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
      aoSalvar(id, estudar ? { fase: estudar, area: area || null } : null);
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

      {c.modelo === 'oab' ? (
        <section className="card">
          <h2>⚖️ Fases do Exame de Ordem (modelo OAB/FGV)</h2>
          <p className="sub">Confira as datas das provas (lidas do edital) e escolha para qual fase <b>você</b> vai estudar. Use ✕ na fase que você não vai fazer. Na 2ª fase, escolha a sua matéria.</p>
          {c.fases.map((f, i) => {
            if (descartadas.includes(f.id)) {
              return (
                <div key={f.id} className="linha entre peq sub" style={{ padding: '8px 4px' }}>
                  <span>✕ {f.nome}: você não vai estudar esta fase.</span>
                  <button type="button" className="praticar" onClick={() => setDescartadas((d) => d.filter((x) => x !== f.id))}>Desfazer</button>
                </div>
              );
            }
            const faltam = f.data ? diasAte(f.data) : null;
            const escolhida = estudar === f.id;
            return (
              <div key={f.id} className="card" style={{ boxShadow: 'none', background: escolhida ? 'var(--pri-claro)' : 'var(--bg)', borderColor: escolhida ? 'var(--pri)' : undefined, borderWidth: escolhida ? 2 : 1 }}>
                <div className="linha entre" style={{ alignItems: 'flex-start' }}>
                  <div>
                    <b>{f.nome}</b>
                    <div className="sub peq">{f.formato === 'A-D' ? 'Objetiva · 80 questões (A a D)' : 'Peça prático-profissional + 4 questões discursivas'}</div>
                    {faltam != null && (
                      <span className="peq" style={{ display: 'inline-block', marginTop: 4, padding: '2px 8px', borderRadius: 99, background: faltam <= 30 ? 'var(--erro-bg)' : 'var(--ok-bg)', color: faltam <= 30 ? 'var(--erro)' : 'var(--ok)', fontWeight: 700 }}>
                        ⏳ {faltam < 0 ? 'prova já realizada' : faltam === 0 ? 'a prova é hoje' : `faltam ${faltam} dias`} · {fmtData(f.data)}
                      </span>
                    )}
                  </div>
                  <div className="linha" style={{ justifyContent: 'flex-end' }}>
                    {!escolhida ? (
                      <button type="button" className="btn peq pri" onClick={() => { setEstudar(f.id); setArea(null); }}>✓ Vou estudar esta fase</button>
                    ) : (
                      <span className="peq" style={{ fontWeight: 700, color: 'var(--pri)' }}>✓ Você vai estudar esta fase</span>
                    )}
                    <button type="button" className="btn peq perigo" title="Não vou estudar esta fase" aria-label={`Não vou estudar a ${f.nome}`} onClick={() => {
                        setDescartadas((d) => [...d, f.id]);
                        if (escolhida || !estudar) {
                          const outra = c.fases.find((x) => x.id !== f.id && !descartadas.includes(x.id));
                          setEstudar(outra ? outra.id : null);
                          setArea(null);
                        }
                      }}>✕</button>
                  </div>
                </div>
                <label className="campo" style={{ maxWidth: 260, marginTop: 8 }}>Data da prova
                  <input type="date" style={campo} value={f.data || ''} onChange={(e) => setItem('fases', i, 'data', e.target.value)} />
                </label>
                {f.areas?.length > 0 && !escolhida && <p className="peq" style={{ marginTop: 8 }}>Áreas: {f.areas.map((a) => a.nome).join(' · ')}</p>}
                {f.areas?.length > 0 && escolhida && (
                  <div style={{ marginTop: 10 }}>
                    <b className="peq">Qual a sua matéria da peça?</b>
                    <div className="linha" role="radiogroup" style={{ marginTop: 6 }}>
                      {f.areas.map((a) => (
                        <button key={a.id} type="button" role="radio" aria-checked={area === a.id} className="btn peq" style={area === a.id ? { background: 'var(--pri)', color: 'var(--pri-txt)', borderColor: 'var(--pri)' } : {}} onClick={() => setArea(a.id)}>
                          {area === a.id ? '✓ ' : ''}{a.nome}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {estudar && (
            <p className="aviso" style={{ background: 'var(--ok-bg)', color: 'var(--ok)' }}>
              Ao salvar, você passa a acompanhar este concurso na {c.fases.find((f) => f.id === estudar)?.nome.split(' –')[0]}
              {area ? ` – ${c.fases.find((f) => f.id === estudar)?.areas?.find((a) => a.id === area)?.nome}` : ''} e já recebe o seu cronograma sugerido.
              As fases continuam completas no concurso para os outros usuários.
            </p>
          )}
          <button type="button" className="btn peq" onClick={() => setC((x) => ({ ...x, modelo: null }))}>Personalizar fases manualmente</button>
        </section>
      ) : (
        <section className="card">
        <h2>Fases</h2>
        <p className="sub">Opcional. Ex.: OAB – "1ª fase" (A a D) e "2ª fase" (discursiva). Quem acompanha o concurso escolhe a fase que vai estudar. Se a fase tiver <b>áreas</b> (como a 2ª fase da OAB), escreva uma por linha: o candidato escolhe a dele e estuda só o conteúdo daquela área.</p>
        <button type="button" className="btn peq" style={{ marginBottom: 10 }} onClick={() => setC((x) => aplicarModeloOAB(x))}>⚖️ Usar modelo OAB (FGV)</button>
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
        {c.fases.map((f, i) => (
          <label key={'a' + i} className="campo" style={{ marginBottom: 8 }}>
            Áreas da {f.nome || 'fase'} (opcional, uma por linha)
            <textarea
              rows={Math.max(2, (f.areas || []).length)}
              style={campo}
              defaultValue={(f.areas || []).map((a) => a.nome).join('\n')}
              key={(f.areas || []).map((a) => a.id).join()}
              onBlur={(e) => setItem('fases', i, 'areas', e.target.value.split('\n').map((t) => t.trim()).filter(Boolean).map((nome) => ({ id: slug(nome), nome })))}
              placeholder="Ex.: Direito Civil"
            />
          </label>
        ))}
        <button type="button" className="btn peq" onClick={() => incluir('fases', { id: 'f' + Math.random().toString(36).slice(2, 8), nome: `${c.fases.length + 1}ª fase`, formato: c.formato, data: '' })}>+ Adicionar fase</button>
      </section>
      )}

      <section className="card">
        <h2>Datas importantes do edital</h2>
        <p className="sub">{c.cronograma.length} datas (inscrições, provas, resultados). Elas aparecem no <b>calendário</b> da ficha do concurso, com a próxima data em destaque.</p>
        <details>
          <summary className="sub">Conferir ou editar as datas</summary>
        {c.cronograma.map((x, i) => (
          <div key={i} className="linha" style={{ marginBottom: 8, flexWrap: 'nowrap' }}>
            <input type="date" style={{ ...campo, flex: 1.3 }} value={x.data || ''} onChange={(e) => setItem('cronograma', i, 'data', e.target.value)} aria-label="Data" />
            <input style={{ ...campo, flex: 3 }} value={x.evento} onChange={(e) => setItem('cronograma', i, 'evento', e.target.value)} placeholder="Evento" aria-label="Evento" />
            <button type="button" className="btn peq perigo" onClick={() => remover('cronograma', i)} aria-label="Remover data">✕</button>
          </div>
        ))}
        <button type="button" className="btn peq" onClick={() => incluir('cronograma', { data: '', evento: '' })}>+ Adicionar data</button>
        </details>
      </section>

      <section className="card">
        <h2>Matérias do conteúdo programático</h2>
        <p className="sub">
          {c.modelo === 'oab'
            ? `Automático pelo modelo OAB/FGV: ${c.disciplinas.filter((d) => d.fase === 'f1').length} matérias da 1ª fase e as 7 áreas da 2ª fase. O candidato monta o edital verticalizado dele na ficha do concurso.`
            : 'Uma disciplina por bloco; um tópico por linha. Indique a fase (e a área, se houver) de cada disciplina.'}
        </p>
        <details open={c.modelo !== 'oab'}>
          <summary className="sub">{c.modelo === 'oab' ? 'Ver ou ajustar as matérias' : 'Disciplinas'}</summary>
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
              {c.fases.find((f) => f.id === d.fase)?.areas?.length > 0 && (
                <select style={{ flex: 1 }} value={d.area || ''} onChange={(e) => setItem('disciplinas', i, 'area', e.target.value)} aria-label="Área">
                  <option value="">Todas as áreas</option>
                  {c.fases.find((f) => f.id === d.fase).areas.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
                </select>
              )}
            </div>
            <textarea rows={Math.min(8, Math.max(3, (d.topicosTxt || '').split('\n').length))} style={{ ...campo, minHeight: 70 }} value={d.topicosTxt || ''} onChange={(e) => setItem('disciplinas', i, 'topicosTxt', e.target.value)} placeholder="Tópicos, um por linha" aria-label={`Tópicos de ${d.nome}`} />
          </div>
        ))}
        <button type="button" className="btn peq" onClick={() => incluir('disciplinas', { nome: '', bloco: '', fase: '', topicosTxt: '' })}>+ Adicionar disciplina</button>
        </details>
      </section>

      {erro && <p className="aviso" role="alert">{erro}</p>}
      <div className="linha">
        <button className="btn pri" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar concurso'}</button>
        <button type="button" className="btn" onClick={aoCancelar}>Cancelar</button>
      </div>
    </form>
  );
}
