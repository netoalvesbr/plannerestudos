import { textoDoPdf } from '../lib/leitorPdf.js';
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
  cargos: [],
};

const campo = { width: '100%', minHeight: 40, padding: '6px 9px', borderRadius: 9, border: '1px solid var(--borda)', background: 'var(--card)', color: 'var(--txt)', font: 'inherit' };

export default function NovoConcurso({ inicial, escolhaInicial, aoSalvar, aoCancelar }) {
  const [c, setC] = useState(() => ({ ...vazio, ...(inicial || {}), disciplinas: (inicial?.disciplinas || []).map((d) => ({ ...d, topicosTxt: (d.topicos || []).join('\n') })) }));
  const [pdf, setPdf] = useState(null);
  const [lendo, setLendo] = useState(null);
  const [leitura, setLeitura] = useState(null);
  const [erro, setErro] = useState(null);
  const [salvando, setSalvando] = useState(false);
  // escolha pessoal de quem está cadastrando: fase que vai estudar, fases descartadas e área
  const [estudar, setEstudar] = useState(escolhaInicial?.fase || null);
  const [area, setArea] = useState(escolhaInicial?.area || null);
  // cargos a que a pessoa vai concorrer (pode ser mais de um, quando as provas são no mesmo dia)
  const [meusCargos, setMeusCargos] = useState(() => {
    const k = escolhaInicial?.cargo;
    return !k || k === 'ambos' ? [] : Array.isArray(k) ? k : [k];
  });
  const [novoCargo, setNovoCargo] = useState('');
  const [descartadas, setDescartadas] = useState([]);
  const [substituir, setSubstituir] = useState(true);
  const set = (k, v) => setC((x) => ({ ...x, [k]: v }));
  const setItem = (lista, i, k, v) => setC((x) => ({ ...x, [lista]: x[lista].map((it, j) => (j === i ? { ...it, [k]: v } : it)) }));
  const remover = (lista, i) => setC((x) => ({ ...x, [lista]: x[lista].filter((_, j) => j !== i) }));
  const incluir = (lista, it) => setC((x) => ({ ...x, [lista]: [...x[lista], it] }));

  async function importarEdital(arquivo) {
    if (!arquivo) return;
    setErro(null);
    setPdf(arquivo);
    setLendo('Abrindo o PDF…');
    setLeitura({ estado: 'lendo', arquivo: arquivo.name, pagina: 0, total: 0 });
    try {
      const linhas = await textoDoPdf(arquivo, (p, n) => {
        setLendo(`Lendo página ${p} de ${n}…`);
        setLeitura({ estado: 'lendo', arquivo: arquivo.name, pagina: p, total: n });
      });
      if (linhas.filter(Boolean).length < 5) throw new Error('Não encontrei texto neste PDF. Ele pode ser uma imagem escaneada; nesse caso, preencha os campos à mão.');
      const r = lerEdital(linhas);
      const oab = ehOAB(r);
      // ao editar, o novo edital substitui os dados lidos (datas, cronograma, matérias); ao cadastrar, só preenche o que está vazio
      const trocar = !!inicial && substituir;
      const pega = (atual, lido) => (trocar ? lido || atual : atual || lido);
      setC((x) => {
        const novo = {
          ...x,
          sigla: x.sigla || r.sigla,
          nome: pega(x.nome, r.nome),
          orgao: pega(x.orgao, r.orgao),
          banca: pega(x.banca, r.banca),
          edital: pega(x.edital, r.edital),
          dataProva: pega(x.dataProva, r.dataProva),
          cronograma: trocar ? (r.cronograma.length ? r.cronograma : x.cronograma) : x.cronograma.length ? x.cronograma : r.cronograma,
          cargos: (trocar || !x.cargos?.length) && r.cargos?.length > 1 ? r.cargos : x.cargos || [],
          disciplinas:
            (trocar ? r.disciplinas.length > 0 : !x.disciplinas.length) && !oab
              ? r.disciplinas.map((d) => ({ ...d, fase: '', topicosTxt: d.topicos.join('\n') }))
              : x.disciplinas,
        };
        if (!oab) return novo;
        // modelo OAB: refaz as fases com as datas do novo edital, mantendo as matérias fixas
        if (x.fases.length && !trocar) return novo;
        const m = aplicarModeloOAB(trocar ? { ...novo, fases: x.fases } : novo, r.datasFases);
        // ao editar, mantém só as fases que você já tinha escolhido estudar
        if (trocar && x.fases.length) {
          const ids = new Set(x.fases.map((f) => f.id));
          return { ...m, fases: m.fases.filter((f) => ids.has(f.id)), disciplinas: m.disciplinas.filter((d) => !d.fase || ids.has(d.fase)) };
        }
        return m;
      });
      const nPag = linhas.filter((l) => l === '').length;
      setLeitura({
        estado: 'ok',
        arquivo: arquivo.name,
        pagina: nPag,
        total: nPag,
        itens: [
          ['Nome do concurso', r.nome || r.sigla],
          ['Banca', r.banca],
          ['Data da prova', r.dataProva ? r.dataProva.split('-').reverse().join('/') : ''],
          ['Datas do cronograma', r.cronograma.length ? `${r.cronograma.length} datas` : ''],
          ['Cargos', r.cargos?.length ? `${r.cargos.length}: ${r.cargos.map((c) => c.nome).join(', ')}` : ''],
          ['Matérias do conteúdo programático', oab ? 'modelo OAB (20 matérias + 7 áreas)' : r.disciplinas.length ? `${r.disciplinas.length} matérias, ${r.disciplinas.reduce((s, d) => s + d.topicos.length, 0)} tópicos` : ''],
        ],
      });
      setLendo(
        `Edital lido: ${r.disciplinas.length} disciplinas, ${r.cronograma.length} datas encontradas.` +
          (oab ? ' Reconheci o Exame de Ordem: apliquei o modelo OAB/FGV (1ª fase objetiva e 2ª fase com as 7 áreas).' : '') +
          ' Confira tudo abaixo antes de salvar.',
      );
    } catch (e) {
      setErro(e.message);
      setLendo(null);
      setLeitura({ estado: 'falha', arquivo: arquivo.name, msg: e.message });
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
        fases: c.fases.filter((f) => f.nome.trim() && !descartadas.includes(f.id)).map((f, i) => ({ ...f, id: f.id || `f${i + 1}`, nome: f.nome.trim() })),
        cronograma: c.cronograma.filter((x) => x.data && x.evento),
        disciplinas: c.disciplinas
          .filter((d) => d.nome.trim() && !descartadas.includes(d.fase))
          .map(({ topicosTxt, ...d }) => ({ ...d, nome: d.nome.trim(), topicos: (topicosTxt || '').split('\n').map((t) => t.trim()).filter(Boolean) })),
      };
      const id = await salvarConcurso(dados, pdf, inicial?.id || null);
      const ids = dados.cargos.map((k) => k.id);
      const meus = meusCargos.filter((k) => ids.includes(k));
      const cargo = !meus.length ? null : meus.length === ids.length ? 'ambos' : meus.length === 1 ? meus[0] : meus;
      aoSalvar(id, estudar ? { fase: estudar, area: area || null } : null, cargo);
    } catch (er) {
      setErro(er.message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={salvar}>
      {leitura && <PainelLeitura leitura={leitura} fechar={() => setLeitura(null)} />}
      <button type="button" className="btn peq" onClick={aoCancelar} style={{ marginBottom: 10 }}>← Voltar</button>
      <h1>{inicial ? 'Editar concurso' : 'Adicionar concurso'}</h1>
      <p className="sub">O concurso é <b>só seu</b>: suas fases, matérias, datas e cronograma não aparecem para outros usuários. O que é compartilhado é o banco de questões (provas importadas) e os editais verticalizados que você decidir compartilhar.</p>

      <section className="card">
        <h2>📄 Importar edital (PDF)</h2>
        <p className="sub">A plataforma lê o edital e preenche sozinha o que encontrar: órgão, banca, data da prova, cronograma e o conteúdo programático (edital verticalizado). O PDF fica guardado no seu concurso.</p>
        {inicial && (
          <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', margin: '6px 0 10px' }}>
            <input type="checkbox" checked={substituir} onChange={() => setSubstituir(!substituir)} style={{ width: 20, height: 20, marginTop: 2 }} />
            <span>Atualizar com o novo edital (retificação ou edital definitivo): datas, cronograma, banca e matérias passam a ser as do PDF novo. <span className="sub">Desmarque para só completar o que estiver vazio.</span></span>
          </label>
        )}
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

      {c.modelo !== 'oab' && (
        <section className="card">
          <h2>🎯 Cargos do concurso</h2>
          {c.cargos?.length ? (
            <>
              <p className="sub">
                {pdf ? 'Cargos lidos do edital. ' : ''}Marque o cargo a que <b>você vai concorrer</b>. Se o edital permitir (provas no mesmo dia, em turnos diferentes), marque dois ou mais.
              </p>
              <div className="escolha" role="group" aria-label="Meus cargos">
                {c.cargos.map((k) => {
                  const on = meusCargos.includes(k.id);
                  return (
                    <button key={k.id} type="button" role="checkbox" aria-checked={on} className={'opcao' + (on ? ' sel' : '')} style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', padding: '9px 12px' }} onClick={() => setMeusCargos(on ? meusCargos.filter((x) => x !== k.id) : [...meusCargos, k.id])}>
                      <span aria-hidden="true">{on ? '☑' : '☐'}</span> {k.nome}
                      {on && <span className="peq"> · ✓ vou concorrer</span>}
                    </button>
                  );
                })}
              </div>
              <p className="peq sub" role="status">
                {meusCargos.length === 0
                  ? 'Nenhum cargo marcado: você escolhe depois, ao montar o cronograma.'
                  : `✓ ${meusCargos.length} ${meusCargos.length === 1 ? 'cargo marcado' : 'cargos marcados'}: as matérias do seu cronograma e das suas questões serão as ${meusCargos.length === 1 ? 'desse cargo' : 'desses cargos'}.`}
              </p>
              <details>
                <summary className="sub peq">Corrigir a lista de cargos</summary>
                {c.cargos.map((k, i) => (
                  <div key={k.id} className="linha" style={{ marginBottom: 6, flexWrap: 'nowrap' }}>
                    <input style={{ ...campo, flex: 1 }} value={k.nome} onChange={(e) => setItem('cargos', i, 'nome', e.target.value)} aria-label={`Nome do cargo ${i + 1}`} />
                    <button type="button" className="btn peq perigo" aria-label={`Remover o cargo ${k.nome}`} onClick={() => { remover('cargos', i); setMeusCargos(meusCargos.filter((x) => x !== k.id)); }}>✕</button>
                  </div>
                ))}
              </details>
            </>
          ) : (
            <p className="sub">{pdf ? 'Não encontrei a lista de cargos neste edital (ou ele tem um cargo só).' : 'Anexe o edital acima para puxar os cargos automaticamente,'} {pdf ? 'Se' : 'ou, se'} houver mais de um cargo, inclua abaixo.</p>
          )}
          <div className="linha" style={{ marginTop: 8, flexWrap: 'nowrap', maxWidth: 520 }}>
            <input style={{ ...campo, flex: 1 }} value={novoCargo} onChange={(e) => setNovoCargo(e.target.value)} placeholder="Ex.: Analista Legislativo" aria-label="Nome de um cargo para incluir" />
            <button
              type="button"
              className="btn peq"
              disabled={!novoCargo.trim()}
              onClick={() => {
                const id = slug(novoCargo.trim()).slice(0, 40) || 'cargo-' + (c.cargos.length + 1);
                if (!c.cargos.some((k) => k.id === id)) incluir('cargos', { id, nome: novoCargo.trim() });
                setNovoCargo('');
              }}
            >
              + Incluir cargo
            </button>
          </div>
        </section>
      )}

      {c.modelo === 'oab' ? (
        <section className="card">
          <h2>⚖️ Fases do Exame de Ordem (modelo OAB/FGV)</h2>
          <p className="sub">Confira as datas das provas (lidas do edital) e escolha para qual fase você vai estudar. Use ✕ para apagar a fase que você não vai fazer. Na 2ª fase, escolha a sua matéria.</p>
          {c.fases.map((f, i) => {
            if (descartadas.includes(f.id)) {
              return (
                <div key={f.id} className="linha entre peq sub" style={{ padding: '8px 4px' }}>
                  <span>✕ {f.nome}: será removida ao salvar (você não vai fazer esta fase).</span>
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
        {c.cargos?.length > 1 && (
          <p className="peq">
            <b>Cargos do edital ({c.cargos.length}):</b> {c.cargos.map((k) => k.nome).join(' · ')}. Cada matéria mostra para quais cargos ela vale; ao montar o cronograma você escolhe os seus cargos.
          </p>
        )}
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
            {c.cargos?.length > 1 && (
              <div className="linha peq" role="group" aria-label={`Cargos de ${d.nome}`} style={{ marginBottom: 6 }}>
                <span className="sub">Vale para:</span>
                {c.cargos.map((k) => {
                  const on = !d.cargos?.length || d.cargos.includes(k.id);
                  return (
                    <label key={k.id} className="btn peq" style={{ background: on ? 'var(--pri-claro)' : undefined }}>
                      <input type="checkbox" className="oculto" checked={on} onChange={() => {
                        const atual = d.cargos?.length ? d.cargos : c.cargos.map((x) => x.id);
                        const novo = on ? atual.filter((x) => x !== k.id) : [...atual, k.id];
                        setItem('disciplinas', i, 'cargos', novo.length === c.cargos.length ? undefined : novo);
                      }} />
                      {on ? '✓ ' : ''}{k.nome}
                    </label>
                  );
                })}
              </div>
            )}
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

// Painel ao lado mostrando a leitura do edital: progresso, sucesso (com o que foi encontrado) ou falha
export function PainelLeitura({ leitura: l, fechar }) {
  const pct = l.total ? Math.round((l.pagina / l.total) * 100) : 0;
  const atualizada = l.msg?.startsWith('A plataforma foi atualizada');
  return (
    <aside className={`painel-leitura ${l.estado}`} role="status" aria-live="polite">
      <div className="linha entre" style={{ alignItems: 'center' }}>
        <b>{l.estado === 'lendo' ? '⏳ Lendo o edital…' : l.estado === 'ok' ? '✓ Edital 100% carregado' : '✗ Falha ao ler o edital'}</b>
        {l.estado !== 'lendo' && <button type="button" className="crono-ic" onClick={fechar} aria-label="Fechar painel">✕</button>}
      </div>
      <div className="peq sub" style={{ wordBreak: 'break-all' }}>📄 {l.arquivo}</div>
      {l.estado === 'lendo' && (
        <>
          <div className="barra" style={{ margin: '8px 0 4px' }}><i style={{ width: `${pct}%` }} /></div>
          <div className="peq">{l.total ? `Página ${l.pagina} de ${l.total} (${pct}%)` : 'Abrindo o arquivo…'}</div>
        </>
      )}
      {l.estado === 'ok' && (
        <>
          <div className="peq">{l.total} {l.total === 1 ? 'página lida' : 'páginas lidas'}.</div>
          <ul className="lista-leitura">
            {l.itens.map(([rot, v]) => (
              <li key={rot}>{v ? '✓' : '✗'} <b>{rot}:</b> {v || <span className="desce">não encontrado – preencha à mão</span>}</li>
            ))}
          </ul>
          <div className="peq sub">Confira os campos ao lado antes de salvar.</div>
        </>
      )}
      {l.estado === 'falha' && (
        <>
          <p className="peq" style={{ margin: '6px 0' }}>{l.msg}</p>
          {atualizada ? (
            <button type="button" className="btn peq pri" onClick={() => window.location.reload()}>↻ Recarregar a página</button>
          ) : (
            <p className="peq sub" style={{ margin: 0 }}>Você pode tentar outro arquivo ou preencher os campos à mão.</p>
          )}
        </>
      )}
    </aside>
  );
}
