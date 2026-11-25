import { useEffect, useMemo, useState } from 'react';
import { dadosAdmin, definirPlano, mudarSituacaoSugestao, planosDosUsuarios, todasSugestoes } from '../lib/remoto.js';
import ImportarLeis from './ImportarLeis.jsx';

// Painel do administrador: quantas pessoas têm conta, quantas já entraram e quantas vezes cada uma acessou.
const DIA = 86400000;
const iso = (d) => new Date(d).toLocaleDateString('sv-SE');
const fmtD = (d) => (d ? new Date(d).toLocaleDateString('pt-BR') : '—');
const fmtDH = (d) => (d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');
const PERIODOS = { dia: ['Hoje', 0], semana: ['Últimos 7 dias', 6], mes: ['Últimos 30 dias', 29] };
const PROV = { google: 'Google', email: 'E-mail e senha' };
const PLANOS = { teste: 'Teste grátis', mensal: 'Mensal', ilimitado: 'Ilimitado' };
const TIPO_SUG = { sugestao: '💡 Sugestão', problema: '🐞 Problema', duvida: '❓ Dúvida', elogio: '👍 Elogio' };
const SIT_SUG = { nova: 'Recebida', lendo: 'Em análise', feita: '✓ Atendida', arquivada: 'Arquivada' };

export default function Admin() {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(null);
  const [periodo, setPeriodo] = useState('semana');
  const [busca, setBusca] = useState('');
  const [ordem, setOrdem] = useState('acessos');

  const [sugs, setSugs] = useState({ lista: [] });
  const [planos, setPlanos] = useState({});
  const [salvandoPlano, setSalvandoPlano] = useState(null);
  const [avisoPlano, setAvisoPlano] = useState(null);

  const carregar = () => {
    setErro(null);
    dadosAdmin().then(setDados).catch((e) => setErro(e.message));
    planosDosUsuarios().then(setPlanos).catch(() => setPlanos({}));
    todasSugestoes().then((r) => setSugs(Array.isArray(r) ? { lista: r } : r)).catch(() => setSugs({ lista: [] }));
  };
  useEffect(carregar, []);

  // libera ou limita o acesso de uma pessoa
  const trocarPlano = async (u, plano) => {
    setSalvandoPlano(u.id);
    setAvisoPlano(null);
    try {
      const linha = await definirPlano(u.id, plano);
      setPlanos((p) => ({ ...p, [u.id]: linha }));
      setAvisoPlano({ ok: true, texto: `✓ ${u.nome || u.email}: plano ${PLANOS[plano].toLowerCase()}.` });
    } catch (e) {
      setAvisoPlano({ ok: false, texto: e.message });
    }
    setSalvandoPlano(null);
  };

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
        {planos._faltaTabela && (
          <p className="aviso">Para definir planos, rode antes o arquivo <b>supabase/009_planos.sql</b> no banco de dados.</p>
        )}
        {avisoPlano && <p className={avisoPlano.ok ? 'sub' : 'aviso'}>{avisoPlano.texto}</p>}
        <div className="tabela-rolagem">
          <table className="tabela-admin">
            <thead>
              <tr><th>Pessoa</th><th>Plano</th><th>Acessos ({PERIODOS[periodo][0].toLowerCase()})</th><th>Hoje</th><th>7 dias</th><th>30 dias</th><th>Último acesso</th><th>Cadastro</th><th>Entrada</th></tr>
            </thead>
            <tbody>
              {lista.map((u) => (
                <tr key={u.id}>
                  <td><b>{u.nome || '(sem nome)'}</b><div className="peq sub">{u.email}</div></td>
                  <td>
                    <select
                      aria-label={`Plano de ${u.nome || u.email}`}
                      value={planos[u.id]?.plano || 'teste'}
                      disabled={salvandoPlano === u.id || planos._faltaTabela}
                      onChange={(e) => trocarPlano(u, e.target.value)}
                    >
                      {Object.entries(PLANOS).map(([k, rot]) => <option key={k} value={k}>{rot}</option>)}
                    </select>
                    {planos[u.id]?.plano === 'ilimitado' && <div className="peq sobe">✓ acesso liberado</div>}
                  </td>
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
      <section>
        <h2>💬 Opiniões e melhorias ({sugs.lista?.length || 0})</h2>
        {sugs._faltaTabela && (
          <p className="aviso" role="alert">
            ✗ A caixa de sugestões ainda não existe no banco. Rode <b>supabase/010_sugestoes.sql</b> no SQL Editor do Supabase.
          </p>
        )}
        {!sugs._faltaTabela && !sugs.lista?.length && <p className="sub">Nenhum recado recebido ainda.</p>}
        {(sugs.lista || []).map((s) => (
          <div className="card" key={s.id}>
            <div className="linha entre">
              <b>{TIPO_SUG[s.tipo] || s.tipo}</b>
              <span className="peq sub">{fmtDH(s.criado_em)}</span>
            </div>
            <p className="peq sub" style={{ margin: '2px 0' }}>
              {s.nome || 'sem nome'} · {s.email || 'sem e-mail'}{s.nota ? ` · nota ${s.nota} de 5` : ''}{s.tela ? ` · tela: ${s.tela}` : ''}
            </p>
            <p style={{ whiteSpace: 'pre-line', margin: '8px 0' }}>{s.texto}</p>
            <label className="campo">
              Situação
              <select
                value={s.situacao || 'nova'}
                onChange={async (e) => {
                  const situacao = e.target.value;
                  try {
                    await mudarSituacaoSugestao(s.id, situacao);
                    setSugs((v) => ({ ...v, lista: v.lista.map((x) => (x.id === s.id ? { ...x, situacao } : x)) }));
                  } catch (err) {
                    setAvisoPlano({ ok: false, texto: err.message });
                  }
                }}
                style={{ width: 'auto' }}
              >
                {Object.entries(SIT_SUG).map(([k, rot]) => <option key={k} value={k}>{rot}</option>)}
              </select>
            </label>
            {s.email && (
              <p className="peq" style={{ marginBottom: 0 }}>
                <a href={`mailto:${s.email}?subject=${encodeURIComponent('EstudaAí – sobre o seu recado')}`}>Responder por e-mail</a>
              </p>
            )}
          </div>
        ))}
      </section>
      <ImportarLeis />
    </div>
  );
}
