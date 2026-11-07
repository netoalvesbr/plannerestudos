import { useEffect, useRef, useState } from 'react';
import { PERIODOS, fmtPct, porCampo, resumo } from '../lib/stats.js';
import { MiniBarra } from './Graficos.jsx';

export default function MenuDesempenho({ questoes, respostas, aoAbrirPainel }) {
  const [aberto, setAberto] = useState(false);
  const [aba, setAba] = useState('comparar');
  const [pa, setPa] = useState('ult7');
  const [pb, setPb] = useState('ant7');
  const [disc, setDisc] = useState(null);
  const botao = useRef(null);
  const painel = useRef(null);

  useEffect(() => {
    if (!aberto) return;
    const esc = (e) => e.key === 'Escape' && fechar();
    document.addEventListener('keydown', esc);
    painel.current?.focus();
    return () => document.removeEventListener('keydown', esc);
  }, [aberto]);

  function fechar() {
    setAberto(false);
    setDisc(null);
    botao.current?.focus();
  }

  const linhasA = porCampo(questoes, respostas, 'materia', pa);
  const linhasB = Object.fromEntries(porCampo(questoes, respostas, 'materia', pb).map((l) => [l.chave, l]));
  const tA = resumo(questoes, respostas, pa);
  const tB = resumo(questoes, respostas, pb);

  const dif = (a, b) => {
    if (a == null || b == null) return <span className="sub">—</span>;
    const d = Math.round((a - b) * 100);
    if (d > 0) return <span className="sobe">▲ +{d} p.p.</span>;
    if (d < 0) return <span className="desce">▼ {d} p.p.</span>;
    return <span>=</span>;
  };
  const cel = (s) => (
    <>
      {fmtPct(s?.pct)}
      <div className="peq sub">{s?.resolvidas ? `${s.certas}/${s.resolvidas}` : '0/0'}</div>
    </>
  );

  return (
    <>
      <button ref={botao} className="fab" aria-label="Desempenho rápido" aria-expanded={aberto} onClick={() => (aberto ? fechar() : setAberto(true))}>
        📊
      </button>
      {aberto && (
        <>
          <div className="pop-fundo" onClick={fechar} />
          <div className="pop" role="dialog" aria-label="Desempenho" tabIndex={-1} ref={painel}>
            <div className="abas" role="tablist">
              <button role="tab" aria-selected={aba === 'comparar'} onClick={() => setAba('comparar')}>Comparar períodos</button>
              <button role="tab" aria-selected={aba === 'disc'} onClick={() => setAba('disc')}>Por disciplina</button>
            </div>

            {aba === 'comparar' && (
              <>
                <div className="linha" style={{ flexWrap: 'nowrap' }}>
                  <label className="campo" style={{ flex: 1 }}>
                    Período A
                    <select value={pa} onChange={(e) => setPa(e.target.value)}>
                      {Object.entries(PERIODOS).map(([k, p]) => <option key={k} value={k}>{p.nome}</option>)}
                    </select>
                  </label>
                  <label className="campo" style={{ flex: 1 }}>
                    Período B
                    <select value={pb} onChange={(e) => setPb(e.target.value)}>
                      {Object.entries(PERIODOS).map(([k, p]) => <option key={k} value={k}>{p.nome}</option>)}
                    </select>
                  </label>
                </div>
                <div className="tabela-wrap" style={{ marginTop: 10 }}>
                  <table>
                    <thead>
                      <tr><th>Disciplina</th><th>A</th><th>B</th><th>Diferença</th></tr>
                    </thead>
                    <tbody>
                      {linhasA.map((l) => (
                        <tr key={l.chave}>
                          <td>{l.chave}</td>
                          <td>{cel(l)}</td>
                          <td>{cel(linhasB[l.chave])}</td>
                          <td>{dif(l.pct, linhasB[l.chave]?.pct)}</td>
                        </tr>
                      ))}
                      <tr className="total">
                        <td>Total</td>
                        <td>{cel(tA)}</td>
                        <td>{cel(tB)}</td>
                        <td>{dif(tA.pct, tB.pct)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {aba === 'disc' && !disc && (
              <table>
                <thead>
                  <tr><th>Disciplina</th><th>Certas</th><th>Erradas</th><th>%</th></tr>
                </thead>
                <tbody>
                  {porCampo(questoes, respostas, 'materia').map((l) => (
                    <tr key={l.chave} onClick={() => setDisc(l.chave)} style={{ cursor: 'pointer' }}>
                      <td>
                        <button className="praticar" onClick={() => setDisc(l.chave)}>{l.chave}</button>
                        <div className="peq sub">{l.resolvidas} resolvidas de {l.total} do banco</div>
                      </td>
                      <td className="ok">{l.certas}</td>
                      <td className="erro">{l.erradas}</td>
                      <td>{fmtPct(l.pct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {aba === 'disc' && disc && (
              <>
                <button className="btn peq" onClick={() => setDisc(null)}>← Disciplinas</button>
                <h3 style={{ marginTop: 10 }}>{disc}</h3>
                <table>
                  <thead>
                    <tr><th>Assunto</th><th>Certas</th><th>%</th></tr>
                  </thead>
                  <tbody>
                    {porCampo(questoes.filter((q) => q.materia === disc), respostas, 'assunto').map((l) => (
                      <tr key={l.chave}>
                        <td>{l.chave}<div className="peq sub">{l.resolvidas}/{l.total} resolvidas</div></td>
                        <td>{l.certas}/{l.resolvidas}</td>
                        <td>{fmtPct(l.pct)}<MiniBarra v={l.pct} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            <div className="linha entre" style={{ marginTop: 12 }}>
              <button className="praticar" onClick={() => { fechar(); aoAbrirPainel(); }}>Painel completo</button>
              <button className="btn peq" onClick={fechar}>Fechar</button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
