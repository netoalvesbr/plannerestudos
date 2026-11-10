import { useEffect, useRef, useState } from 'react';
import { LEIS, PORTAL_LEGISLACAO, registrarLeisExtras, todasAsLeis } from '../data/leis.js';
import { salvarTextoLei, statusLeis } from '../lib/remoto.js';
import fonteParser from '../lib/leiParser.js?raw';

// O site do Planalto recusa conexões vindas de servidores (nuvem). Por isso o administrador importa
// as leis pelo próprio navegador: o EstudaAí abre o Planalto numa janela, um "favorito" (bookmarklet)
// lê as leis ali mesmo e envia o texto de volta para cá, que grava no banco para todos os usuários.
const ORIGEM = typeof window !== 'undefined' ? window.location.origin : '';
const PLANALTO = /^https:\/\/(www\.)?planalto\.gov\.br$/;

export function scriptImportador() {
  const parser = fonteParser.replace(/^export /gm, '');
  return `(async()=>{${parser}
const ORIGEM=${JSON.stringify(ORIGEM)};const alvo=window.opener;
if(!alvo){alert('Abra o Planalto pelo botão "Importar leis do Planalto" do painel do administrador do EstudaAí e clique neste favorito de novo.');return;}
const lista=await new Promise(res=>{window.addEventListener('message',e=>{if(e.origin===ORIGEM&&e.data&&e.data.tipo==='estudaai-lista')res(e.data.leis);});alvo.postMessage({tipo:'estudaai-pronto'},ORIGEM);});
for(const l of lista){try{const u=l.url.replace(/^https?:\\/\\/(www\\.)?planalto\\.gov\\.br/,location.origin);const r=await fetch(u);if(!r.ok)throw new Error('HTTP '+r.status);const b=await r.arrayBuffer();let h=new TextDecoder('windows-1252').decode(b);if(/charset=["']?utf-8/i.test(h.slice(0,3000)))h=new TextDecoder('utf-8').decode(b);const d=lerLeiHtml(h);alvo.postMessage({tipo:'estudaai-lei',id:l.id,dados:d},ORIGEM);}catch(e){alvo.postMessage({tipo:'estudaai-erro',id:l.id,erro:String(e&&e.message||e)},ORIGEM);}}
alvo.postMessage({tipo:'estudaai-fim'},ORIGEM);})();`;
}

export default function ImportarLeis() {
  const [status, setStatus] = useState({});
  const [erroBanco, setErroBanco] = useState(null);
  const [log, setLog] = useState([]);
  const [rodando, setRodando] = useState(false);
  const [escolha, setEscolha] = useState('todas');
  const link = useRef(null);
  const janela = useRef(null);
  const pendentes = useRef([]);
  const [nova, setNova] = useState({ nome: '', materia: '', url: '' });
  const [novas, setNovas] = useState([]); // leis acrescentadas agora, ainda não importadas

  const atualizar = () =>
    statusLeis()
      .then((l) => {
        registrarLeisExtras(l.map((x) => x.meta && { id: x.id, ...x.meta }).filter(Boolean));
        setStatus(Object.fromEntries(l.map((x) => [x.id, x.atualizado])));
      })
      .catch((e) => setErroBanco(e.message));
  useEffect(() => {
    atualizar();
  }, []);
  // o React não aceita "javascript:" no href; coloca direto no elemento
  useEffect(() => {
    link.current?.setAttribute('href', 'javascript:' + encodeURIComponent(scriptImportador()));
  });

  useEffect(() => {
    const ouvir = async (e) => {
      if (!PLANALTO.test(e.origin) || !e.data?.tipo?.startsWith('estudaai-')) return;
      const d = e.data;
      if (d.tipo === 'estudaai-pronto') {
        setRodando(true);
        e.source.postMessage({ tipo: 'estudaai-lista', leis: pendentes.current.map((l) => ({ id: l.id, url: l.url })) }, e.origin);
      } else if (d.tipo === 'estudaai-lei') {
        const nArt = d.dados?.itens?.filter((i) => i.tipo === 'artigo').length || 0;
        const lei = [...todasAsLeis(), ...pendentes.current].find((l) => l.id === d.id);
        const nome = lei?.nome || d.id;
        if (nArt < 1) {
          setLog((v) => [...v, `✗ ${nome}: nenhum artigo encontrado`]);
          return;
        }
        try {
          const extra = !LEIS.some((l) => l.id === d.id);
          await salvarTextoLei(d.id, extra ? { ...d.dados, meta: { nome: lei.nome, materia: lei.materia, url: lei.url } } : d.dados, lei?.url);
          setLog((v) => [...v, `✓ ${nome}: ${nArt} artigos`]);
          setStatus((s) => ({ ...s, [d.id]: new Date().toISOString() }));
        } catch (er) {
          setLog((v) => [...v, `✗ ${nome}: ${er.message}`]);
        }
      } else if (d.tipo === 'estudaai-erro') {
        setLog((v) => [...v, `✗ ${[...todasAsLeis(), ...pendentes.current].find((l) => l.id === d.id)?.nome || d.id}: ${d.erro}`]);
      } else if (d.tipo === 'estudaai-fim') {
        setRodando(false);
        setLog((v) => [...v, '— Importação concluída. Pode fechar a janela do Planalto.']);
      }
    };
    window.addEventListener('message', ouvir);
    return () => window.removeEventListener('message', ouvir);
  }, []);

  function abrir() {
    const todas = [...todasAsLeis(), ...novas.filter((n) => !todasAsLeis().some((l) => l.id === n.id))];
    pendentes.current = escolha === 'faltando' ? todas.filter((l) => !status[l.id]) : todas;
    setLog([`Abrindo o Planalto… ${pendentes.current.length} leis na fila.`]);
    janela.current = window.open(LEIS[0].url, 'estudaai-planalto');
    if (!janela.current) setLog(['✗ O navegador bloqueou a janela. Permita janelas pop-up para este site e tente de novo.']);
  }

  const lista = [...todasAsLeis(), ...novas.filter((n) => !todasAsLeis().some((l) => l.id === n.id))];
  const total = lista.filter((l) => status[l.id]).length;
  const urlOk = /^https?:\/\/(www\d?\.)?planalto\.gov\.br\/ccivil_03\/.+\.htm/i.test(nova.url.trim());
  const adicionar = (e) => {
    e.preventDefault();
    if (!urlOk || !nova.nome.trim()) return;
    const url = nova.url.trim().replace(/^http:/, 'https:');
    const id = 'x-' + url.split('/').pop().replace(/\.htm.*$/i, '').toLowerCase().replace(/[^a-z0-9]+/g, '');
    setNovas((v) => [...v.filter((x) => x.id !== id), { id, nome: nova.nome.trim(), materia: nova.materia.trim() || 'Outras leis', url }]);
    setNova({ nome: '', materia: '', url: '' });
  };
  return (
    <section className="card">
      <h2>⚖️ Textos das leis (Planalto)</h2>
      <p className="sub">O site do Planalto não aceita conexões dos servidores da plataforma; por isso, a importação é feita pelo <b>seu navegador</b>. Os textos ficam guardados no banco e aparecem para todos os usuários.</p>
      {erroBanco && <p className="aviso">⚠️ {erroBanco}</p>}
      <p><b>{total}</b> de {lista.length} leis carregadas.</p>
      <details className="card" style={{ marginBottom: 10 }}>
        <summary><b>➕ Acrescentar outra lei pelo link do Planalto</b></summary>
        <p className="peq">Procure a lei no <a href={PORTAL_LEGISLACAO} target="_blank" rel="noreferrer">Portal da Legislação do Planalto ↗</a>, abra o texto e copie o endereço (de preferência o “texto compilado”). Depois clique em Importar: ela entra na fila.</p>
        <form className="form-anot" onSubmit={adicionar}>
          <label className="campo">Nome (ex.: Lei 13.964/2019 – Pacote Anticrime)<input value={nova.nome} onChange={(e) => setNova({ ...nova, nome: e.target.value })} /></label>
          <label className="campo">Matéria<input value={nova.materia} onChange={(e) => setNova({ ...nova, materia: e.target.value })} placeholder="ex.: Direito Penal" /></label>
          <label className="campo">Link do Planalto<input value={nova.url} onChange={(e) => setNova({ ...nova, url: e.target.value })} placeholder="https://www.planalto.gov.br/ccivil_03/..." /></label>
          {nova.url && !urlOk && <p className="peq desce">✗ O link precisa ser de uma lei em www.planalto.gov.br/ccivil_03/… terminando em .htm</p>}
          <button className="btn peq" disabled={!urlOk || !nova.nome.trim()}>Acrescentar à fila</button>
        </form>
        {novas.length > 0 && <ul className="peq">{novas.map((n) => <li key={n.id}>{status[n.id] ? '✓' : '⏳ na fila'} – {n.nome} ({n.materia})</li>)}</ul>}
      </details>
      <ol className="peq">
        <li>Uma vez só: arraste este botão para a barra de favoritos do navegador → <a ref={link} className="btn peq" onClick={(e) => e.preventDefault()} title="Arraste para a barra de favoritos">📥 Enviar ao EstudaAí</a></li>
        <li>Clique em <b>Importar leis do Planalto</b>: abre uma janela no site do Planalto.</li>
        <li>Nessa janela, clique no favorito <b>📥 Enviar ao EstudaAí</b>. Deixe as duas janelas abertas até terminar.</li>
      </ol>
      <div className="linha">
        <select value={escolha} onChange={(e) => setEscolha(e.target.value)} aria-label="Quais leis importar">
          <option value="todas">Todas as leis (atualizar)</option>
          <option value="faltando">Só as que faltam</option>
        </select>
        <button className="btn pri" onClick={abrir} disabled={rodando}>📥 Importar leis do Planalto</button>
        <button className="btn" onClick={() => navigator.clipboard?.writeText(scriptImportador())}>Copiar código do importador</button>
      </div>
      {log.length > 0 && (
        <ul className="peq lista-leitura" role="log" aria-live="polite" style={{ maxHeight: 260, overflow: 'auto' }}>
          {log.map((l, i) => <li key={i}>{l}</li>)}
        </ul>
      )}
      <details>
        <summary className="peq">Ver situação de cada lei</summary>
        <ul className="peq">
          {lista.map((l) => <li key={l.id}>{status[l.id] ? `✓ ${new Date(status[l.id]).toLocaleDateString('pt-BR')}` : '✗ não carregada'} – {l.nome}</li>)}
        </ul>
      </details>
    </section>
  );
}
