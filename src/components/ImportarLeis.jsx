import { useEffect, useRef, useState } from 'react';
import { LEIS } from '../data/leis.js';
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

  const atualizar = () =>
    statusLeis()
      .then((l) => setStatus(Object.fromEntries(l.map((x) => [x.id, x.atualizado]))))
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
        const nome = LEIS.find((l) => l.id === d.id)?.nome || d.id;
        if (nArt < 1) {
          setLog((v) => [...v, `✗ ${nome}: nenhum artigo encontrado`]);
          return;
        }
        try {
          await salvarTextoLei(d.id, d.dados, LEIS.find((l) => l.id === d.id)?.url);
          setLog((v) => [...v, `✓ ${nome}: ${nArt} artigos`]);
          setStatus((s) => ({ ...s, [d.id]: new Date().toISOString() }));
        } catch (er) {
          setLog((v) => [...v, `✗ ${nome}: ${er.message}`]);
        }
      } else if (d.tipo === 'estudaai-erro') {
        setLog((v) => [...v, `✗ ${LEIS.find((l) => l.id === d.id)?.nome || d.id}: ${d.erro}`]);
      } else if (d.tipo === 'estudaai-fim') {
        setRodando(false);
        setLog((v) => [...v, '— Importação concluída. Pode fechar a janela do Planalto.']);
      }
    };
    window.addEventListener('message', ouvir);
    return () => window.removeEventListener('message', ouvir);
  }, []);

  function abrir() {
    pendentes.current = escolha === 'faltando' ? LEIS.filter((l) => !status[l.id]) : LEIS;
    setLog([`Abrindo o Planalto… ${pendentes.current.length} leis na fila.`]);
    janela.current = window.open(LEIS[0].url, 'estudaai-planalto');
    if (!janela.current) setLog(['✗ O navegador bloqueou a janela. Permita janelas pop-up para este site e tente de novo.']);
  }

  const total = LEIS.filter((l) => status[l.id]).length;
  return (
    <section className="card">
      <h2>⚖️ Textos das leis (Planalto)</h2>
      <p className="sub">O site do Planalto não aceita conexões dos servidores da plataforma; por isso, a importação é feita pelo <b>seu navegador</b>. Os textos ficam guardados no banco e aparecem para todos os usuários.</p>
      {erroBanco && <p className="aviso">⚠️ {erroBanco}</p>}
      <p><b>{total}</b> de {LEIS.length} leis carregadas.</p>
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
          {LEIS.map((l) => <li key={l.id}>{status[l.id] ? `✓ ${new Date(status[l.id]).toLocaleDateString('pt-BR')}` : '✗ não carregada'} – {l.nome}</li>)}
        </ul>
      </details>
    </section>
  );
}
