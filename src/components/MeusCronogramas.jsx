import { useState } from 'react';
import { getConcurso } from '../data/concursos.js';
import { fmtData } from '../lib/stats.js';

// 📆 Lista de cronogramas: um por concurso (e por fase/área). Criar novo, abrir ou excluir.
export const chaveCrono = (cid, fase, area) => [cid, fase || '', area || ''].join('|');

export default function MeusCronogramas({ ctx, abrir }) {
  const { prefs, setPrefs } = ctx;
  const [novo, setNovo] = useState(false);
  const [conf, setConf] = useState(null);
  const seguindo = (prefs.seguindo || []).map(getConcurso).filter(Boolean);
  const itens = Object.entries(prefs.cronogramas || {})
    .map(([k, v]) => {
      const [cid, fase, area] = k.split('|');
      const c = getConcurso(cid);
      if (!c) return null;
      const f = c.fases?.find((x) => x.id === fase);
      const a = f?.areas?.find((x) => x.id === area);
      return { k, cid, fase, area, c, f, a, cfg: v?.cfg || {}, feitos: Object.keys(v?.feitos || {}).filter((x) => !x.startsWith('rev#')).length };
    })
    .filter(Boolean)
    .sort((x, y) => (x.cid === prefs.ativo ? -1 : y.cid === prefs.ativo ? 1 : x.c.sigla.localeCompare(y.c.sigla)));
  const excluir = (k) => {
    const n = { ...(prefs.cronogramas || {}) };
    delete n[k];
    setPrefs({ cronogramas: n });
    setConf(null);
  };

  return (
    <div>
      <div className="linha entre" style={{ alignItems: 'center' }}>
        <h1 style={{ margin: 0 }}>📆 Meus cronogramas</h1>
        <button className="btn pri" onClick={() => setNovo(!novo)} aria-expanded={novo}>➕ Criar cronograma novo</button>
      </div>
      <p className="sub">Você pode ter um cronograma para cada concurso (e para cada fase ou área). Escolha qual quer estudar, crie um novo ou exclua os que não usa mais.</p>
      {novo && <NovoCronograma seguindo={seguindo} existentes={prefs.cronogramas || {}} abrir={abrir} prefs={prefs} />}
      {!itens.length && !novo && (
        <div className="card">
          <p style={{ marginTop: 0 }}>Você ainda não tem cronograma. Clique em <b>➕ Criar cronograma novo</b> e escolha o concurso.</p>
        </div>
      )}
      <div className="grade">
        {itens.map((it) => (
          <div key={it.k} className="card" style={{ borderColor: it.cid === prefs.ativo ? 'var(--pri)' : undefined }}>
            <h2 style={{ marginBottom: 2 }}>{it.c.sigla}</h2>
            <p className="sub" style={{ marginTop: 0 }}>
              {it.c.nome}
              {it.f && <><br />{it.f.nome}{it.a ? ` – ${it.a.nome}` : ''}</>}
            </p>
            <p className="peq">
              {it.cfg.inicio && it.cfg.fim ? <>De {fmtData(it.cfg.inicio)} a {fmtData(it.cfg.fim)}<br /></> : null}
              {it.cfg.modo === 'ciclo' ? '🔄 Ciclo' : '📌 Fixo'} · ✓ {it.feitos} {it.feitos === 1 ? 'bloco feito' : 'blocos feitos'}
            </p>
            <div className="linha">
              <button className="btn pri" onClick={() => abrir({ cid: it.cid, fase: it.fase, area: it.area })}>▶ Estudar</button>
              {conf === it.k ? (
                <>
                  <button className="btn peq perigo" onClick={() => excluir(it.k)}>Sim, excluir</button>
                  <button className="btn peq" onClick={() => setConf(null)}>Cancelar</button>
                </>
              ) : (
                <button className="btn peq" onClick={() => setConf(it.k)}>🗑️ Excluir</button>
              )}
            </div>
            {conf === it.k && <p className="peq aviso" role="alert" style={{ marginBottom: 0 }}>O cronograma e as marcações de blocos feitos serão apagados. O concurso, as questões e o histórico de respostas continuam.</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

function NovoCronograma({ seguindo, existentes, abrir, prefs }) {
  const [cid, setCid] = useState(prefs.ativo && seguindo.some((c) => c.id === prefs.ativo) ? prefs.ativo : seguindo[0]?.id || '');
  const c = seguindo.find((x) => x.id === cid);
  const pc = prefs.concursos?.[cid] || {};
  const [fase, setFase] = useState(pc.fase || '');
  const [area, setArea] = useState(pc.area || '');
  const fObj = c?.fases?.find((f) => f.id === fase);
  const precisaFase = c?.fases?.length > 0 && !fObj;
  const precisaArea = fObj?.areas?.length > 0 && !fObj.areas.some((a) => a.id === area);
  const ja = existentes[[cid, fase || '', area || ''].join('|')];
  if (!seguindo.length) return <p className="card">Primeiro acompanhe um concurso em 🏆 Concursos.</p>;
  return (
    <section className="card" style={{ borderColor: 'var(--pri)' }}>
      <h2 style={{ marginTop: 0 }}>Novo cronograma</h2>
      <div className="filtros">
        <label className="campo">Concurso
          <select value={cid} onChange={(e) => { setCid(e.target.value); const p = prefs.concursos?.[e.target.value] || {}; setFase(p.fase || ''); setArea(p.area || ''); }}>
            {seguindo.map((x) => <option key={x.id} value={x.id}>{x.sigla} – {x.nome}</option>)}
          </select>
        </label>
        {c?.fases?.length > 0 && (
          <label className="campo">Fase
            <select value={fase} onChange={(e) => { setFase(e.target.value); setArea(''); }}>
              <option value="">— escolha —</option>
              {c.fases.map((f) => <option key={f.id} value={f.id}>{f.nome}{f.data ? ` (${fmtData(f.data)})` : ''}</option>)}
            </select>
          </label>
        )}
        {fObj?.areas?.length > 0 && (
          <label className="campo">Área
            <select value={area} onChange={(e) => setArea(e.target.value)}>
              <option value="">— escolha —</option>
              {fObj.areas.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </select>
          </label>
        )}
      </div>
      {ja && <p className="peq aviso">Já existe um cronograma para essa escolha: ele será aberto para você ajustar.</p>}
      <button className="btn pri" disabled={!cid || precisaFase || precisaArea} onClick={() => abrir({ cid, fase, area, novo: !ja })}>
        {ja ? 'Abrir cronograma' : 'Montar cronograma →'}
      </button>
    </section>
  );
}
