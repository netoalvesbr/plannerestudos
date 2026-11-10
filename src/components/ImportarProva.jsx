import { textoDoPdf } from '../lib/leitorPdf.js';
import { useEffect, useMemo, useState } from 'react';
import { lerGabarito, lerProva } from '../lib/leitura.js';
import { salvarQuestoes, uidDe } from '../lib/remoto.js';

const campo = { width: '100%', minHeight: 38, padding: '6px 9px', borderRadius: 9, border: '1px solid var(--borda)', background: 'var(--card)', color: 'var(--txt)', font: 'inherit' };
const LETRAS = { 'A-E': ['A', 'B', 'C', 'D', 'E'], 'A-D': ['A', 'B', 'C', 'D'], CE: ['C', 'E'] };

async function textoDeArquivo(arquivo, aoProgredir) {
  return textoDoPdf(arquivo, aoProgredir);
}

// Linhas que identificam de onde veio o material (cursinho, site, professor, contato, direitos autorais)
const ORIGEM = /(https?:\/\/|www\.|\S+@\S+\.\S+|editora|apostila|material (exclusivo|protegido)|todos os direitos|direitos reservados|©|proibida a (reprodu|venda)|\bprof(\.|essora?)\s|instagram|whatsapp|telegram|youtube|p[áa]gina\s*\d+\s*(de|\/)\s*\d+)/i;
const MARCA = /\b(concursos?|cursos?|cursinho|preparat[óo]rio|academia)\b/i;
const QUESTAO_OU_ALT = /^\s*(QUEST[ÃA]O\s*\d|\d{1,3}\s*[.)\-–]|\(?[A-Ea-e]\s*[).\-–])/;
export function limparOrigem(linhas, marcas = []) {
  const re = marcas.length ? new RegExp(marcas.map((m) => m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'gi') : null;
  const out = [];
  for (let l of linhas) {
    if (!l) {
      out.push(l);
      continue;
    }
    if (QUESTAO_OU_ALT.test(l)) {
      // na linha da questão, tira só a referência: "(Céus Concursos)", links e e-mails
      l = l.replace(/\((?:[^()]*\b(?:concursos?|cursos?|prof\.?)\b[^()]*)\)/gi, '').replace(/https?:\/\/\S+|www\.\S+|\S+@\S+\.\S+/gi, '');
    } else if (ORIGEM.test(l) || (MARCA.test(l) && l.length < 80)) continue;
    if (re) l = l.replace(re, '');
    out.push(l.replace(/\s{2,}/g, ' ').trim());
  }
  return out;
}
// separa a lista de questões do gabarito que vem no fim do mesmo PDF
function separarGabarito(linhas) {
  let i = -1;
  for (let k = linhas.length - 1; k >= Math.floor(linhas.length * 0.4); k--) if (/^\s*(GABARITO|RESPOSTAS?)\b/i.test(linhas[k])) { i = k; break; }
  return i < 0 ? { prova: linhas, gabarito: '' } : { prova: linhas.slice(0, i), gabarito: linhas.slice(i).join('\n') };
}

export default function ImportarProva({ concursos, concursoInicial, faseInicial, areaInicial, aoConcluir, aoCancelar, material = null }) {
  const [cid, setCid] = useState(concursoInicial || concursos[0]?.id || '');
  const concurso = concursos.find((c) => c.id === cid);
  const [fase, setFase] = useState(faseInicial || '');
  const faseObj = concurso?.fases?.find((f) => f.id === fase);
  const [area, setArea] = useState(areaInicial || '');
  const [formato, setFormato] = useState(faseObj?.formato || concurso?.formato || 'A-E');
  const [meta, setMeta] = useState({ banca: concurso?.banca || '', ano: new Date().getFullYear() - 1, orgao: '' });
  const [questoes, setQuestoes] = useState([]);
  const [materiaPadrao, setMateriaPadrao] = useState('');
  const [status, setStatus] = useState(null);
  const [erro, setErro] = useState(null);
  const [colarProva, setColarProva] = useState('');
  const [colarGab, setColarGab] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [semOrigem, setSemOrigem] = useState(!!material);
  const [marcas, setMarcas] = useState('');
  // material da Biblioteca: lê o PDF, tira as referências de origem e separa o gabarito do fim
  useEffect(() => {
    if (!material?.arquivo) return;
    (async () => {
      setStatus('Lendo o material da Biblioteca…');
      try {
        const linhas = await textoDeArquivo(material.arquivo, (p, n) => setStatus(`Lendo página ${p} de ${n}…`));
        const limpas = limparOrigem(linhas);
        const { prova, gabarito } = separarGabarito(limpas);
        if (material.materia) setMateriaPadrao(material.materia);
        setMeta((m) => ({ ...m, banca: '', orgao: '', ano: '' }));
        let qs = lerProva(prova, formato).map((q) => ({ ...q, incluir: true }));
        if (!qs.length) throw new Error('Não consegui separar as questões deste PDF. Verifique se as questões são numeradas (1, 2, 3… ou "QUESTÃO 1") e se o PDF tem texto (não é imagem escaneada).');
        const mapa = gabarito ? lerGabarito(gabarito, formato) : {};
        qs = qs.map((q) => (mapa[q.numero] ? (mapa[q.numero] === 'ANULADA' ? { ...q, anulada: true, gabarito: '' } : { ...q, gabarito: mapa[q.numero] }) : q));
        setQuestoes(qs);
        const comGab = qs.filter((q) => q.gabarito).length;
        setStatus(`${qs.length} questões encontradas${gabarito ? ` · gabarito do fim do PDF aplicado em ${comGab}` : ' · gabarito não encontrado no PDF: importe abaixo'}. Confira cada questão antes de salvar.`);
      } catch (e) {
        setErro(e.message);
        setStatus(null);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [material]);

  const disciplinas = useMemo(() => (concurso?.disciplinas || []).filter((d) => (!fase || !d.fase || d.fase === fase) && (!area || !d.area || d.area === area)).map((d) => d.nome), [concurso, fase, area]);

  function trocarConcurso(id) {
    setCid(id);
    const c = concursos.find((x) => x.id === id);
    setFase('');
    setFormato(c?.formato || 'A-E');
    setMeta((m) => ({ ...m, banca: c?.banca || m.banca }));
  }
  function trocarFase(f) {
    setFase(f);
    setArea('');
    const fo = concurso?.fases?.find((x) => x.id === f)?.formato;
    if (fo) setFormato(fo);
  }

  function aplicarProva(linhas) {
    const qs = lerProva(linhas, formato).map((q) => ({ ...q, incluir: true }));
    if (!qs.length) {
      setErro('Não consegui separar as questões automaticamente. Verifique se o PDF tem texto (não é imagem escaneada) e se as questões são numeradas (1, 2, 3… ou "QUESTÃO 1").');
      return;
    }
    setQuestoes(qs);
    setStatus(`${qs.length} questões encontradas. Agora importe o gabarito e confira cada questão abaixo.`);
  }

  async function lerArquivoProva(arquivo) {
    if (!arquivo) return;
    setErro(null);
    setStatus('Abrindo o PDF…');
    try {
      const linhas = await textoDeArquivo(arquivo, (p, n) => setStatus(`Lendo página ${p} de ${n}…`));
      if (linhas.filter(Boolean).length < 5) throw new Error('Não encontrei texto neste PDF (pode ser imagem escaneada). Tente colar o texto da prova no campo abaixo.');
      aplicarProva(linhas);
    } catch (e) {
      setErro(e.message);
      setStatus(null);
    }
  }

  function aplicarGabarito(texto) {
    const mapa = lerGabarito(texto, formato);
    const n = Object.keys(mapa).length;
    if (!n) return setErro('Não encontrei respostas no gabarito. Formatos aceitos: "1-A 2-C…", "01 A 02 C…" ou tabela de números e letras.');
    setErro(null);
    const casadas = questoes.filter((q) => mapa[q.numero]).length;
    setQuestoes((qs) =>
      qs.map((q) => {
        const g = mapa[q.numero];
        if (!g) return q;
        return g === 'ANULADA' ? { ...q, anulada: true, gabarito: '' } : { ...q, gabarito: g, anulada: false };
      }),
    );
    setStatus(`Gabarito aplicado: ${casadas} de ${questoes.length} questões receberam resposta.`);
  }

  async function lerArquivoGabarito(arquivo) {
    if (!arquivo) return;
    setStatus('Lendo o gabarito…');
    try {
      const linhas = await textoDeArquivo(arquivo);
      aplicarGabarito(linhas.join('\n'));
    } catch (e) {
      setErro(e.message);
    }
  }

  const setQ = (i, k, v) => setQuestoes((qs) => qs.map((q, j) => (j === i ? { ...q, [k]: v } : q)));
  const setAlt = (i, L, v) => setQuestoes((qs) => qs.map((q, j) => (j === i ? { ...q, alternativas: { ...q.alternativas, [L]: v } } : q)));

  const letras = LETRAS[formato] || [];
  const problemas = (q) => {
    const p = [];
    if (!q.enunciado.trim()) p.push('sem enunciado');
    if (!(q.materia || materiaPadrao)) p.push('sem disciplina');
    if (formato !== 'discursiva' && !q.anulada && !q.gabarito) p.push('sem gabarito');
    if (formato === 'A-E' || formato === 'A-D') if (letras.some((L) => !(q.alternativas?.[L] || '').trim())) p.push('alternativa vazia');
    return p;
  };
  const incluidas = questoes.filter((q) => q.incluir);
  const comProblema = incluidas.filter((q) => problemas(q).length).length;

  async function salvar() {
    setErro(null);
    if (!cid) return setErro('Escolha o concurso.');
    if (faseObj?.areas?.length && !area) return setErro('Escolha a área da prova (ex.: Direito Civil).');
    if (comProblema) return setErro(`Há ${comProblema} questão(ões) com pendências (marcadas em vermelho). Corrija ou desmarque "incluir".`);
    setSalvando(true);
    try {
      const lista = [];
      for (const q of incluidas) {
        lista.push({
          ...q,
          materia: (q.materia || materiaPadrao).trim(),
          uid: await uidDe(q.enunciado),
          concursoId: cid,
          fase: fase || null,
          area: area || null,
          concursoRef: [concurso?.sigla, faseObj?.nome?.split(' –')[0], faseObj?.areas?.find((a) => a.id === area)?.nome].filter(Boolean).join(' · '),
          formato,
          banca: meta.banca,
          ano: meta.ano,
          orgao: meta.orgao,
          ...(semOrigem ? limparQuestao(q, marcas) : {}),
          origem: material ? 'material_biblioteca' : q.origem,
          fonte: semOrigem ? 'Banco de questões EstudaAí' : [meta.banca, meta.ano, meta.orgao].filter(Boolean).join(' · ') + ` – questão ${q.numero}`,
        });
      }
      const r = await salvarQuestoes(lista);
      aoConcluir(r);
    } catch (e) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div>
      <button className="btn peq" onClick={aoCancelar} style={{ marginBottom: 10 }}>← Voltar</button>
      <h1>{material ? 'Gerar questões do material' : 'Importar prova'}</h1>
      <p className="sub">As questões vão para o <b>banco unificado</b>: ficam disponíveis para todos os usuários. Questões repetidas (mesmo enunciado) não são duplicadas.</p>
      {material && (
        <section className="card" style={{ borderColor: 'var(--pri)' }}>
          <p style={{ marginTop: 0 }}>📚 Material da Biblioteca: <b>{material.titulo}</b>. O PDF continua guardado na Biblioteca; aqui só as questões vão para o banco.</p>
          <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <input type="checkbox" checked={semOrigem} onChange={() => setSemOrigem(!semOrigem)} style={{ width: 20, height: 20, marginTop: 2 }} />
            <span>Tirar as referências de origem: linhas com nome de cursinho, site, e-mail, redes sociais, professor e direitos autorais. As questões entram como <b>“Banco de questões EstudaAí”</b>.</span>
          </label>
          {semOrigem && (
            <label className="campo" style={{ marginTop: 8 }}>Nomes que também devem sair do texto (separe por vírgula)
              <input style={campo} value={marcas} onChange={(e) => setMarcas(e.target.value)} placeholder="ex.: Céus Concursos, Prof. Fulano" />
            </label>
          )}
          <p className="peq sub" style={{ marginBottom: 0 }}>Confira as questões abaixo antes de salvar: a leitura automática pode errar a separação ou o gabarito.</p>
        </section>
      )}

      <section className="card">
        <h2>1. De onde é a prova</h2>
        <div className="filtros">
          <label className="campo">Concurso
            <select value={cid} onChange={(e) => trocarConcurso(e.target.value)}>
              {concursos.map((c) => <option key={c.id} value={c.id}>{c.sigla} – {c.nome}</option>)}
            </select>
          </label>
          {concurso?.fases?.length > 0 && (
            <label className="campo">Fase
              <select value={fase} onChange={(e) => trocarFase(e.target.value)}>
                <option value="">Escolha…</option>
                {concurso.fases.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>
            </label>
          )}
          {faseObj?.areas?.length > 0 && (
            <label className="campo">Área
              <select value={area} onChange={(e) => { setArea(e.target.value); const nome = faseObj.areas.find((a) => a.id === e.target.value)?.nome; if (nome && !materiaPadrao) setMateriaPadrao(nome); }}>
                <option value="">Escolha…</option>
                {faseObj.areas.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
              </select>
            </label>
          )}
          <label className="campo">Formato
            <select value={formato} onChange={(e) => setFormato(e.target.value)} disabled={questoes.length > 0}>
              <option value="A-E">A a E</option>
              <option value="A-D">A a D</option>
              <option value="CE">Certo ou Errado</option>
              <option value="discursiva">Discursiva</option>
            </select>
          </label>
          <label className="campo">Banca<input style={campo} value={meta.banca} onChange={(e) => setMeta({ ...meta, banca: e.target.value })} /></label>
          <label className="campo">Ano<input style={campo} type="number" value={meta.ano} onChange={(e) => setMeta({ ...meta, ano: e.target.value })} /></label>
          <label className="campo">Órgão / cargo / exame<input style={campo} value={meta.orgao} onChange={(e) => setMeta({ ...meta, orgao: e.target.value })} placeholder="Ex.: 39º Exame, PC-AC Agente" /></label>
        </div>
      </section>

      <section className="card">
        <h2>2. Prova</h2>
        <label className="campo">PDF da prova (caderno de questões)
          <input type="file" accept="application/pdf" onChange={(e) => lerArquivoProva(e.target.files[0])} style={{ display: 'block', marginTop: 6 }} />
        </label>
        <details style={{ marginTop: 10 }}>
          <summary className="sub">Ou cole o texto da prova</summary>
          <textarea rows={6} style={{ ...campo, marginTop: 6 }} value={colarProva} onChange={(e) => setColarProva(e.target.value)} placeholder="1. Enunciado… (A) … (B) …" />
          <button type="button" className="btn peq" onClick={() => aplicarProva(colarProva.split('\n'))} disabled={!colarProva.trim()}>Separar questões</button>
        </details>
      </section>

      {questoes.length > 0 && formato !== 'discursiva' && (
        <section className="card">
          <h2>3. Gabarito</h2>
          <label className="campo">PDF do gabarito (de preferência o definitivo)
            <input type="file" accept="application/pdf" onChange={(e) => lerArquivoGabarito(e.target.files[0])} style={{ display: 'block', marginTop: 6 }} />
          </label>
          <details style={{ marginTop: 10 }}>
            <summary className="sub">Ou cole o gabarito</summary>
            <textarea rows={3} style={{ ...campo, marginTop: 6 }} value={colarGab} onChange={(e) => setColarGab(e.target.value)} placeholder="1-A 2-C 3-B … (X ou * = anulada)" />
            <button type="button" className="btn peq" onClick={() => aplicarGabarito(colarGab)} disabled={!colarGab.trim()}>Aplicar gabarito</button>
          </details>
        </section>
      )}

      {status && <p className="aviso" role="status" style={{ background: 'var(--pri-claro)', color: 'var(--txt)' }}>{status}</p>}
      {erro && <p className="aviso" role="alert">{erro}</p>}

      {questoes.length > 0 && (
        <>
          <section className="card">
            <h2>{formato === 'discursiva' ? '3' : '4'}. Conferir questões</h2>
            <p className="sub">{incluidas.length} de {questoes.length} marcadas para importar · {comProblema ? <b className="desce">✗ {comProblema} com pendências</b> : <b className="sobe">✓ sem pendências</b>}</p>
            <label className="campo" style={{ maxWidth: 420 }}>Disciplina para as questões sem disciplina
              <input list="lista-disciplinas" style={campo} value={materiaPadrao} onChange={(e) => setMateriaPadrao(e.target.value)} placeholder="Ex.: Direito Civil" />
            </label>
            <datalist id="lista-disciplinas">{disciplinas.map((d) => <option key={d} value={d} />)}</datalist>
          </section>

          {questoes.map((q, i) => {
            const pr = q.incluir ? problemas(q) : [];
            return (
              <article key={i} className="card" style={{ borderColor: pr.length ? 'var(--erro)' : undefined, opacity: q.incluir ? 1 : 0.55 }}>
                <div className="linha entre">
                  <b>Questão {q.numero}</b>
                  <label className="linha" style={{ gap: 6 }}><input type="checkbox" checked={q.incluir} onChange={(e) => setQ(i, 'incluir', e.target.checked)} /> incluir</label>
                </div>
                {pr.length > 0 && <p className="desce peq">✗ {pr.join(' · ')}</p>}
                <div className="filtros" style={{ margin: '8px 0' }}>
                  <label className="campo">Disciplina<input list="lista-disciplinas" style={campo} value={q.materia} onChange={(e) => setQ(i, 'materia', e.target.value)} placeholder={materiaPadrao || 'Disciplina'} /></label>
                  <label className="campo">Assunto (opcional)<input style={campo} value={q.assunto || ''} onChange={(e) => setQ(i, 'assunto', e.target.value)} /></label>
                  {formato !== 'discursiva' && (
                    <label className="campo">Gabarito
                      <select value={q.anulada ? 'ANULADA' : q.gabarito} onChange={(e) => (e.target.value === 'ANULADA' ? setQuestoes((qs) => qs.map((x, j) => (j === i ? { ...x, anulada: true, gabarito: '' } : x))) : setQuestoes((qs) => qs.map((x, j) => (j === i ? { ...x, anulada: false, gabarito: e.target.value } : x))))}>
                        <option value="">—</option>
                        {letras.map((L) => <option key={L} value={L}>{formato === 'CE' ? (L === 'C' ? 'Certo' : 'Errado') : L}</option>)}
                        <option value="ANULADA">Anulada</option>
                      </select>
                    </label>
                  )}
                </div>
                <label className="campo">Enunciado
                  <textarea rows={Math.min(10, Math.max(3, Math.ceil(q.enunciado.length / 90)))} style={campo} value={q.enunciado} onChange={(e) => setQ(i, 'enunciado', e.target.value)} />
                </label>
                {(formato === 'A-E' || formato === 'A-D') &&
                  letras.map((L) => (
                    <label key={L} className="campo" style={{ marginTop: 4 }}>{L})
                      <input style={campo} value={q.alternativas?.[L] || ''} onChange={(e) => setAlt(i, L, e.target.value)} />
                    </label>
                  ))}
                {formato === 'discursiva' && (
                  <label className="campo" style={{ marginTop: 6 }}>Espelho / padrão de resposta (opcional)
                    <textarea rows={3} style={campo} value={q.espelho || ''} onChange={(e) => setQ(i, 'espelho', e.target.value)} />
                  </label>
                )}
              </article>
            );
          })}

          <div className="linha" style={{ position: 'sticky', bottom: 0, background: 'var(--bg)', padding: '10px 0' }}>
            <button className="btn pri" onClick={salvar} disabled={salvando || !incluidas.length}>{salvando ? 'Salvando…' : `Salvar ${incluidas.length} questões no banco`}</button>
            <button className="btn" onClick={aoCancelar}>Cancelar</button>
          </div>
        </>
      )}
    </div>
  );
}

// tira nomes de cursinho/site/professor do enunciado, das alternativas e do comentário
function limparQuestao(q, marcas) {
  const lista = marcas.split(/[,;\n]/).map((x) => x.trim()).filter((x) => x.length > 2);
  const limpa = (t) => {
    if (!t) return t;
    let r = t.replace(/https?:\/\/\S+|www\.\S+|\S+@\S+\.\S+/gi, '');
    for (const m of lista) r = r.replace(new RegExp(m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '');
    return r.replace(/\(\s*\)|\[\s*\]/g, '').replace(/\s{2,}/g, ' ').trim();
  };
  return {
    enunciado: limpa(q.enunciado),
    alternativas: q.alternativas ? Object.fromEntries(Object.entries(q.alternativas).map(([k, v]) => [k, limpa(v)])) : q.alternativas,
    comentario: limpa(q.comentario),
  };
}
