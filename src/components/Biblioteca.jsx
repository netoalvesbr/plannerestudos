import { useEffect, useState } from 'react';
import { contarBiblioteca, enviarArquivo, excluirArquivo, linkArquivo, listarBiblioteca } from '../lib/remoto.js';
import { catalogoMaterias, mesmaMateria } from '../data/materias.js';
import Leis from './Leis.jsx';

// 📚 Biblioteca: arquivos compartilhados entre os usuários (PDF, imagem, Word), por categoria
export const CATEGORIAS = [
  { id: 'doutrina', icone: '📚', nome: 'Doutrinas', desc: 'Livros, apostilas, resumos e materiais de estudo' },
  { id: 'jurisprudencia', icone: '⚖️', nome: 'Jurisprudência', desc: 'Informativos, súmulas comentadas e julgados' },
  { id: 'leis', icone: '📜', nome: 'Leis', desc: 'Lei seca navegável e PDFs de legislação' },
  { id: 'questoes', icone: '✎', nome: 'Questões', desc: 'Provas anteriores, listas e simulados em PDF' },
  { id: 'pecas', icone: '🖋️', nome: 'Modelos de peças', desc: 'Modelos de peças processuais e pareceres' },
  { id: 'rascunho', icone: '🗒️', nome: 'Cadernos de rascunho', desc: 'Modelos de caderno de rascunho e folhas de resposta' },
  { id: 'outros', icone: '📁', nome: 'Outros arquivos', desc: 'Mapas, cronogramas, imagens e demais arquivos' },
];
const TODAS = { id: 'todas', icone: '🔎', nome: 'Todos os materiais', desc: 'Arquivos de todas as seções, por matéria' };
const ACEITOS = '.pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.txt';
const fmtTam = (b) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const icoTipo = (t = '') => (t.includes('pdf') ? '📄' : t.startsWith('image') ? '🖼️' : t.includes('word') || t.includes('msword') ? '📝' : '📎');

export default function Biblioteca({ ctx }) {
  const cat = ctx.prefs.bibliotecaCat || null;
  const ir = (c) => {
    ctx.setPrefs({ bibliotecaCat: c });
    window.scrollTo(0, 0);
  };
  const [contagem, setContagem] = useState({});
  const [erro, setErro] = useState(null);
  useEffect(() => {
    if (!cat) contarBiblioteca().then(setContagem).catch((e) => setErro(e.message));
  }, [cat]);

  if (cat) return <Categoria ctx={ctx} cat={cat === 'todas' ? TODAS : CATEGORIAS.find((c) => c.id === cat) || CATEGORIAS[0]} voltar={() => ir(null)} />;
  return (
    <div>
      <h1>📚 Biblioteca</h1>
      <p className="sub">Materiais compartilhados entre os usuários do EstudaAí. Escolha uma seção para ver os arquivos ou enviar os seus (PDF, imagem ou Word).</p>
      {erro && <p className="aviso">⚠️ {erro}</p>}
      <button className="btn" style={{ marginBottom: 12 }} onClick={() => ir('todas')}>🔎 Procurar material por matéria (todas as seções)</button>
      <div className="grade-bib">
        {CATEGORIAS.map((c) => (
          <button key={c.id} className="card bloco-bib" onClick={() => ir(c.id)}>
            <span className="ico-bib" aria-hidden="true">{c.icone}</span>
            <b>{c.nome}</b>
            <span className="peq sub">{c.desc}</span>
            <span className="peq">{contagem[c.id] ? `${contagem[c.id]} ${contagem[c.id] === 1 ? 'arquivo' : 'arquivos'}` : c.id === 'leis' ? 'Lei seca + arquivos' : 'Nenhum arquivo ainda'}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Categoria({ ctx, cat, voltar }) {
  const { usuario, concurso } = ctx;
  const [lista, setLista] = useState(null);
  const [erro, setErro] = useState(null);
  const [busca, setBusca] = useState('');
  const [materia, setMateria] = useState('');
  const [enviar, setEnviar] = useState(false);
  const [aba, setAba] = useState(cat.id === 'leis' ? 'seca' : 'arquivos');
  const [conf, setConf] = useState(null);
  const recarregar = () =>
    listarBiblioteca(cat.id === 'todas' ? null : cat.id)
      .then(setLista)
      .catch((e) => setErro(e.message));
  useEffect(() => {
    recarregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat.id]);
  const grupos = catalogoMaterias((lista || []).map((x) => x.materia).filter(Boolean));
  const materias = Object.values(grupos).flat();
  const qtd = (m) => (lista || []).filter((x) => mesmaMateria(x.materia, m)).length;
  const [filtroMat, setFiltroMat] = useState('');
  const termo = busca.trim().toLowerCase();
  const vis = (lista || []).filter((x) => (!materia || mesmaMateria(x.materia, materia)) && (!termo || `${x.titulo} ${x.descricao || ''} ${x.materia || ''} ${x.concurso || ''} ${x.nome_arquivo || ''}`.toLowerCase().includes(termo)));
  const fm = filtroMat.trim().toLowerCase();
  const abrir = async (x, baixar) => {
    try {
      const url = await linkArquivo(x, baixar);
      if (baixar) {
        const a = document.createElement('a');
        a.href = url;
        a.download = x.nome_arquivo || x.titulo;
        a.click();
      } else window.open(url, '_blank', 'noopener');
    } catch (e) {
      setErro(e.message);
    }
  };
  const excluir = async (x) => {
    try {
      await excluirArquivo(x);
      setConf(null);
      recarregar();
    } catch (e) {
      setErro(e.message);
    }
  };

  return (
    <div>
      <button className="btn peq" onClick={voltar}>← Biblioteca</button>
      <h1 style={{ marginBottom: 4 }}>{cat.icone} {cat.nome}</h1>
      <p className="sub" style={{ marginTop: 0 }}>{cat.desc}</p>
      {cat.id === 'leis' && (
        <div className="abas" role="tablist">
          <button role="tab" aria-selected={aba === 'seca'} onClick={() => setAba('seca')}>⚖️ Lei seca (navegável)</button>
          <button role="tab" aria-selected={aba === 'arquivos'} onClick={() => setAba('arquivos')}>📄 Arquivos de leis</button>
        </div>
      )}
      {cat.id === 'leis' && aba === 'seca' ? (
        <Leis ctx={ctx} />
      ) : (
        <>
          {cat.id === 'questoes' && (
            <p className="aviso" style={{ background: 'var(--pri-claro)', color: 'var(--txt)' }}>
              💡 Quer resolver as questões dentro da plataforma? Use <b>📝 Questões → Importar prova</b>: a prova em PDF vira questões no banco, com gabarito e desempenho.
              <button className="btn peq" style={{ marginLeft: 6 }} onClick={() => ctx.abrirImportarProva?.()}>Importar prova</button>
            </p>
          )}
          <div className="linha" style={{ margin: '10px 0' }}>
            <button className="btn pri" onClick={() => setEnviar(!enviar)} aria-expanded={enviar}>⬆️ Enviar arquivo</button>
            <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="🔎 Procurar por título, matéria ou concurso" aria-label="Procurar arquivo" style={{ flex: 1, minWidth: 180 }} />
          </div>
          {enviar && <FormEnvio cat={cat} materias={materias} materiaInicial={materia} concurso={concurso} aoEnviar={() => { setEnviar(false); recarregar(); }} />}
          {erro && <p className="aviso" role="alert">⚠️ {erro}</p>}
          <div className="pdf-layout">
          <nav className="card lista-disc" aria-label="Matérias">
            <input type="search" value={filtroMat} onChange={(e) => setFiltroMat(e.target.value)} placeholder="Filtrar matérias" aria-label="Filtrar matérias" />
            <button aria-current={!materia} onClick={() => setMateria('')}>
              Todas as matérias<span className="peq sub">{(lista || []).length} {(lista || []).length === 1 ? 'arquivo' : 'arquivos'}</span>
            </button>
            {Object.entries(grupos).map(([g, ms]) => {
              const vm = ms.filter((m) => !fm || m.toLowerCase().includes(fm));
              if (!vm.length) return null;
              return (
                <div key={g}>
                  <div className="peq sub" style={{ margin: '8px 8px 2px', fontWeight: 700 }}>{g}</div>
                  {vm.map((m) => {
                    const n = qtd(m);
                    return (
                      <button key={m} aria-current={mesmaMateria(materia, m)} onClick={() => { setMateria(m); window.scrollTo(0, 0); }}>
                        {m}
                        <span className="peq sub">{n ? `${n} ${n === 1 ? 'arquivo' : 'arquivos'}` : 'sem material'}</span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </nav>
          <div>
          {materia && <h2 style={{ marginTop: 0 }}>{materia}</h2>}
          {!lista && !erro && <p className="sub">Carregando…</p>}
          {lista && !vis.length && (
            <p className="card sub">
              {materia && !termo
                ? `📭 A matéria “${materia}” ainda não tem material${cat.id === 'todas' ? '' : ` em ${cat.nome}`}. Use ⬆️ Enviar arquivo para compartilhar o primeiro.`
                : lista.length ? 'Nenhum arquivo com esse filtro.' : 'Ainda não há arquivos nesta seção. Seja o primeiro a compartilhar!'}
            </p>
          )}
          <ul className="lista-bib">
            {vis.map((x) => (
              <li key={x.id} className="card">
                <div className="linha" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
                  <span className="ico-arq" aria-hidden="true">{icoTipo(x.tipo)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <b>{x.titulo}</b>
                    {x.descricao && <div className="peq">{x.descricao}</div>}
                    <div className="peq sub">
                      {[x.materia, x.concurso, x.nome_arquivo && `${x.nome_arquivo.split('.').pop().toUpperCase()} · ${fmtTam(x.tamanho || 0)}`, `enviado por ${x.autor_nome || (x.criado_por === usuario?.id ? 'você' : 'usuário')} em ${new Date(x.criado_em).toLocaleDateString('pt-BR')}`].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                </div>
                <div className="linha" style={{ marginTop: 6 }}>
                  <button className="btn peq" onClick={() => abrir(x, false)}>👁️ Abrir</button>
                  <button className="btn peq" onClick={() => abrir(x, true)}>⬇️ Baixar</button>
                  {(x.criado_por === usuario?.id || x.criado_por === 'local' || usuario?.admin) &&
                    (conf === x.id ? (
                      <>
                        <button className="btn peq perigo" onClick={() => excluir(x)}>Confirmar exclusão</button>
                        <button className="btn peq" onClick={() => setConf(null)}>Cancelar</button>
                      </>
                    ) : (
                      <button className="btn peq" onClick={() => setConf(x.id)}>🗑️ Excluir</button>
                    ))}
                </div>
              </li>
            ))}
          </ul>
          </div>
          </div>
        </>
      )}
    </div>
  );
}

function FormEnvio({ cat, materias, materiaInicial, concurso, aoEnviar }) {
  const [arq, setArq] = useState(null);
  const [categoria, setCategoria] = useState(cat.id === 'todas' ? 'doutrina' : cat.id);
  const [f, setF] = useState({ titulo: '', descricao: '', materia: materiaInicial || '', concurso: concurso?.sigla || '' });
  const [ok, setOk] = useState(false);
  const [status, setStatus] = useState(null);
  const [erro, setErro] = useState(null);
  async function enviar(e) {
    e.preventDefault();
    setErro(null);
    if (!arq) return setErro('Escolha o arquivo.');
    if (arq.size > 25 * 1024 * 1024) return setErro('Arquivo grande demais: o máximo é 25 MB. Comprima o PDF e tente de novo.');
    try {
      setStatus('Enviando…');
      await enviarArquivo({ categoria, titulo: f.titulo.trim() || arq.name.replace(/\.\w+$/, ''), descricao: f.descricao.trim() || null, materia: f.materia.trim() || null, concurso: f.concurso.trim() || null }, arq, setStatus);
      setStatus(null);
      aoEnviar();
    } catch (er) {
      setStatus(null);
      setErro(er.message);
    }
  }
  return (
    <form className="card form-anot" onSubmit={enviar}>
      <h3 style={{ margin: 0 }}>Enviar arquivo</h3>
      <label className="campo">Seção
        <select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
          {CATEGORIAS.map((c) => <option key={c.id} value={c.id}>{c.icone} {c.nome}</option>)}
        </select>
      </label>
      <label className="campo">Arquivo (PDF, imagem ou Word, até 25 MB) *
        <input type="file" accept={ACEITOS} onChange={(e) => { const a = e.target.files[0]; setArq(a); if (a && !f.titulo) setF({ ...f, titulo: a.name.replace(/\.\w+$/, '').replace(/[-_]+/g, ' ') }); }} />
      </label>
      <label className="campo">Título *<input value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} required /></label>
      <div className="filtros">
        <label className="campo">Matéria *
          <input list="mat-bib" required value={f.materia} onChange={(e) => setF({ ...f, materia: e.target.value })} />
          <datalist id="mat-bib">{materias.map((m) => <option key={m} value={m} />)}</datalist>
        </label>
        <label className="campo">Concurso (opcional)<input value={f.concurso} onChange={(e) => setF({ ...f, concurso: e.target.value })} placeholder="ex.: OAB 48, PC/AC" /></label>
      </div>
      <label className="campo">Descrição (opcional)<textarea rows="2" value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} placeholder="Do que se trata, autor, ano, edição…" /></label>
      <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <input type="checkbox" checked={ok} onChange={() => setOk(!ok)} style={{ width: 20, height: 20, marginTop: 2 }} />
        <span className="peq">Declaro que posso compartilhar este arquivo: é material meu, de domínio público (como leis e decisões judiciais) ou tenho autorização do autor. Não envio apostilas ou livros pagos de terceiros.</span>
      </label>
      {status && <p className="peq" role="status">⏳ {status}</p>}
      {erro && <p className="aviso peq" role="alert">✗ {erro}</p>}
      <div className="linha">
        <button className="btn pri" disabled={!ok || !arq || !!status}>⬆️ Enviar</button>
      </div>
    </form>
  );
}
