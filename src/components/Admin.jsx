import { useEffect, useMemo, useState } from 'react';
import { dadosAdmin } from '../lib/remoto.js';
import ImportarLeis from './ImportarLeis.jsx';

// Painel do administrador: quantas pessoas têm conta, quantas já entraram e quantas vezes cada uma acessou.
const DIA = 86400000;
const iso = (d) => new Date(d).toLocaleDateString('sv-SE');
const fmtD = (d) => (d ? new Date(d).toLocaleDateString('pt-BR') : '—');
const fmtDH = (d) => (d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');
const PERIODOS = { dia: ['Hoje', 0], semana: ['Últimos 7 dias', 6], mes: ['Últimos 30 dias', 29] };
const PROV = { google: 'Google', email: 'E-mail e senha' };

export default function Admin() {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(null);
  const [periodo, setPeriodo] = useState('semana');
  const [busca, setBusca] = useState('');
  const [ordem, setOrdem] = useState('acessos');

  const carregar = () => {
    setErro(null);
    dadosAdmin().then(setDados).catch((e) => setErro(e.message));
  };
  useEffect(carregar, []);

  const calc = useMemo(() => {
    if (!dados) return null;
    const hoje = iso(Date.now());
    const inicio = (n) => iso(Date.now() - n * DIA);
    const doPeriodo = (n) => dados.acessos.filter((a) => iso(a.em) >= inicio(n));
    const ativos = (n) => new Set(doPeriodo(n).map((a) => a.user_id)).size;
    const porUsuario = {};
    for (const a of dados.acessos) {
      const p = (porUsuario[a.user_id] ||= { dia: 0, semana: 0, mes: 0, total: 0, ultimo: null, aparelhos: new Set() });
      const d = iso(a.em);
      p.total++;
      if (d === hoje) p.dia++;
      if (d >= inicio(6)) p.semana++;
      if (d >= inicio(29)) p.mes++;
      if (!p.ultimo || a.em > p.ultimo) p.ultimo = a.em;
      if (a.aparelho) p.aparelhos.add(a.aparelho);
    }
    const dias = [];
    for (let i = 29; i >= 0; i--) {
      const d = inicio(i);
      const doDia = dados.acessos.filter((a) => iso(a.em) === d);
      dias.push({ d, acessos: doDia.length, pessoas: new Set(doDia.map((a) => a.user_id)).size });
    }
    return {
      total: dados.usuarios.length,
      entraram: dados.usuarios.filter((u) => u.ultimo_login).length,
      novos7: dados.usuarios.filter((u) => iso(u.criado_em) >= inicio(6)).length,
      ativos: { dia: ativos(0), semana: ativos(6), mes: ativos(29) },
      acessos: { dia: doPeriodo(0).length, semana: doPeriodo(6).length, mes: doPeriodo(29).length },
      porUsuario,
      dias,
    };
  }, [dados]);

  if (erro) {
    return (
      <div>
        <h1>👑 Painel do administrador</h1>
        <p className="aviso" role="alert">✗ {erro}</p>
        <button className="btn" onClick={carregar}>↻ Tentar de novo</button>
        <ImportarLeis />
      </div>
    );
  }
  if (!calc) return <p className="sub">Carregando dados de acesso…</p>;

  const termo = busca.trim().toLowerCase();
  const lista = dados.usuarios
    .filter((u) => !termo || `${u.nome} ${u.email}`.toLowerCase().includes(termo))
    .map((u) => ({ ...u, est: calc.porUsuario[u.id] || { dia: 0, semana: 0, mes: 0, total: 0, ultimo: null, aparelhos: new Set() } }))
    .sort((a, b) => (ordem === 'acessos' ? b.est[periodo] - a.est[periodo] : ordem === 'recente' ? String(b.est.ultimo || b.ultimo_login || '').localeCompare(String(a.est.ultimo || a.ultimo_login || '')) : String(b.criado_em).localeCompare(String(a.criado_em))));
  const max = Math.max(1, ...calc.dias.map((d) => d.acessos));

  return (
    <div>
      <div className="linha entre">
        <h1 style={{ margin: 0 }}>👑 Painel do administrador</h1>
        <button className="btn peq" onClick={carregar}>↻ Atualizar</button>
      </div>
      <p className="sub">Contas, entradas e acessos à plataforma. Cada abertura do site conta como 1 acesso.</p>

      <div className="resumos">
        <div className="card"><div className="sub">Pessoas com conta</div><div className="numero">{calc.total}</div><div className="peq sub">{calc.novos7} novas nos últimos 7 dias</div></div>
        <div className="card"><div className="sub">Já fizeram login</div><div className="numero">{calc.entraram}</div><div className="peq sub">{calc.total - calc.entraram} nunca entraram</div></div>
        <div className="card"><div className="sub">Ativas hoje</div><div className="numero">{calc.ativos.dia}</div><div className="peq sub">{calc.acessos.dia} acessos</div></div>
        <div className="card"><div className="sub">Ativas na semana</div><div className="numero">{calc.ativos.semana}</div><div className="peq sub">{calc.acessos.semana} acessos</div></div>
        <div className="card"><div className="sub">Ativas no mês</div><div className="numero">{calc.ativos.mes}</div><div className="peq sub">{calc.acessos.mes} acessos</div></div>
      </div>

      <section className="card">
        <h2>Acessos por dia (últimos 30 dias)</h2>
        <div className="barras-dias" role="img" aria-label={`Acessos por dia. Maior valor: ${max}.`}>
          {calc.dias.map((d) => (
            <div key={d.d} className="barra-dia" title={`${fmtD(d.d + 'T12:00')}: ${d.acessos} acessos, ${d.pessoas} pessoas`}>
              <span className="valor">{d.acessos || ''}</span>
              <i style={{ height: `${(d.acessos / max) * 100}%` }} />
              <span className="rot">{d.d.slice(8)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Pessoas e acessos</h2>
        <div className="abas" role="tablist" aria-label="Período">
          {Object.entries(PERIODOS).map(([k, [rot]]) => (
            <button key={k} role="tab" aria-selected={periodo === k} onClick={() => setPeriodo(k)}>{rot}</button>
          ))}
        </div>
        <div className="filtros">
          <input type="text" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="🔎 Procurar por nome ou e-mail" aria-label="Procurar pessoa" />
          <label className="campo">Ordenar por
            <select value={ordem} onChange={(e) => setOrdem(e.target.value)}>
              <option value="acessos">Mais acessos no período</option>
              <option value="recente">Acesso mais recente</option>
              <option value="cadastro">Cadastro mais recente</option>
            </select>
          </label>
        </div>
        <div className="tabela-rolagem">
          <table className="tabela-admin">
            <thead>
              <tr><th>Pessoa</th><th>Acessos ({PERIODOS[periodo][0].toLowerCase()})</th><th>Hoje</th><th>7 dias</th><th>30 dias</th><th>Último acesso</th><th>Cadastro</th><th>Entrada</th></tr>
            </thead>
            <tbody>
              {lista.map((u) => (
                <tr key={u.id}>
                  <td><b>{u.nome || '(sem nome)'}</b><div className="peq sub">{u.email}</div></td>
                  <td className="num"><b>{u.est[periodo]}</b></td>
                  <td className="num">{u.est.dia}</td>
                  <td className="num">{u.est.semana}</td>
                  <td className="num">{u.est.mes}</td>
                  <td>{fmtDH(u.est.ultimo || u.ultimo_login)}<div className="peq sub">{[...u.est.aparelhos].join(', ')}</div></td>
                  <td>{fmtD(u.criado_em)}</td>
                  <td>{PROV[u.provedor] || u.provedor}{!u.confirmado && <div className="peq desce">✗ e-mail não confirmado</div>}{!u.ultimo_login && <div className="peq sub">nunca entrou</div>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!lista.length && <p className="sub">Ninguém encontrado.</p>}
        <p className="peq sub" style={{ marginTop: 8 }}>Os acessos passaram a ser contados a partir da ativação deste painel; antes disso só existe a data do último login.</p>
      </section>
      <ImportarLeis />
    </div>
  );
}
