import { useMemo, useState } from 'react';
import { disciplinasDo } from '../lib/dados.js';
import { chaveSessao, configPadrao, DIAS_SEMANA, gerarCronograma, gerarIcs, vespera } from '../lib/cronograma.js';
import { fmtData } from '../lib/stats.js';
import { verticalizadoDe } from './EditalVerticalizado.jsx';
import { eventosDoConcurso, ProximaData } from './Calendario.jsx';

const campo = { width: '100%', minHeight: 40, padding: '6px 9px', borderRadius: 9, border: '1px solid var(--borda)', background: 'var(--card)', color: 'var(--txt)', font: 'inherit' };
const nomeDia = (iso) => DIAS_SEMANA[new Date(iso + 'T12:00:00').getDay()];

export default function Cronograma({ ctx }) {
  const { concurso, cargo, fase, area, prefs, setPrefs, abrirAvulsas } = ctx;
  const faseObj = concurso.fases?.find((f) => f.id === fase);
  const areaObj = faseObj?.areas?.find((a) => a.id === area);
  const dataProva = faseObj?.data || concurso.dataProva || '';
  const chave = [concurso.id, fase || '', area || ''].join('|');
  const salvo = prefs.cronogramas?.[chave];
  const [editando, setEditando] = useState(!salvo);
  const [cfg, setCfg] = useState(() => salvo?.cfg || configPadrao(dataProva));
  const [todos, setTodos] = useState(false);
  const set = (k, v) => setCfg((c) => ({ ...c, [k]: v }));

  const vert = verticalizadoDe(prefs, concurso.id, fase, area);
  // usa o edital verticalizado do aluno (se houver); senão, as matérias do concurso
  const discs = vert ? vert.disciplinas : disciplinasDo(concurso.id, cargo, fase, area);
  const usar = editando ? cfg : salvo?.cfg || cfg;
  const discursiva = (faseObj?.formato || concurso.formato) === 'discursiva';
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const sessoes = useMemo(() => gerarCronograma(usar, discs, { discursiva }), [usar, discs.length, discursiva, concurso.id, fase, area]);
  const feitos = salvo?.feitos || {};
  const hoje = new Date().toLocaleDateString('sv-SE');

  const salvar = (novo) => setPrefs({ cronogramas: { ...(prefs.cronogramas || {}), [chave]: novo } });
  const marcar = (s) => {
    const k = chaveSessao(s);
    const n = { ...feitos };
    n[k] ? delete n[k] : (n[k] = 1);
    salvar({ ...salvo, feitos: n });
  };

  const titulo = `${concurso.sigla}${faseObj ? ` – ${faseObj.nome}` : ''}${areaObj ? ` – ${areaObj.nome}` : ''}`;
  const horas = Math.round(sessoes.reduce((s, x) => s + (parseInt(x.fim) * 60 + +x.fim.slice(3) - parseInt(x.ini) * 60 - +x.ini.slice(3)), 0) / 60);

  function baixarIcs() {
    const blob = new Blob([gerarIcs(sessoes, `Cronograma ${titulo}`)], { type: 'text/calendar' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `cronograma-${concurso.sigla.replace(/\W+/g, '-').toLowerCase()}.ics`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  if (editando) {
    return (
      <div>
        <h1>📆 {salvo ? 'Ajustar cronograma' : 'Seu cronograma sugerido'}</h1>
        <p className="sub">{titulo} · {discs.length} {discs.length === 1 ? 'matéria' : 'matérias'} · {discs.reduce((s, d) => s + (d.topicos?.length || 0), 0)} tópicos</p>
        {!salvo && <p className="aviso" style={{ background: 'var(--pri-claro)', color: 'var(--txt)' }}>Já deixamos uma sugestão pronta, de hoje até a véspera da prova. Ajuste os dias e horários, se quiser, e clique em <b>Confirmar cronograma</b>.</p>}
        <section className="card">
          <h2>Período</h2>
          <div className="filtros">
            <label className="campo">Começar em<input type="date" style={campo} value={cfg.inicio} onChange={(e) => set('inicio', e.target.value)} /></label>
            <label className="campo">Até (véspera da prova)<input type="date" style={campo} value={cfg.fim} onChange={(e) => set('fim', e.target.value)} /></label>
          </div>
          <p className="sub" style={{ marginTop: 8 }}>
            {dataProva ? <>Prova em <b>{fmtData(dataProva)}</b>: o cronograma vai até {fmtData(vespera(dataProva))}.</> : <>A data da prova ainda não está cadastrada; escolha a data final acima.</>}
          </p>
        </section>
        <section className="card">
          <h2>Dias e horários</h2>
          <div className="linha" role="group" aria-label="Dias da semana">
            {DIAS_SEMANA.map((d, i) => (
              <label key={d} className="btn peq" style={{ background: cfg.dias.includes(i) ? 'var(--pri)' : undefined, color: cfg.dias.includes(i) ? 'var(--pri-txt)' : undefined }}>
                <input type="checkbox" className="oculto" checked={cfg.dias.includes(i)} onChange={() => set('dias', cfg.dias.includes(i) ? cfg.dias.filter((x) => x !== i) : [...cfg.dias, i].sort())} />
                {cfg.dias.includes(i) ? '✓ ' : ''}{d}
              </label>
            ))}
          </div>
          <div className="filtros" style={{ marginTop: 10 }}>
            <label className="campo">Segunda a sexta: das<input type="time" style={campo} value={cfg.horaIni} onChange={(e) => set('horaIni', e.target.value)} /></label>
            <label className="campo">até<input type="time" style={campo} value={cfg.horaFim} onChange={(e) => set('horaFim', e.target.value)} /></label>
            <label className="campo">Sábado e domingo: das<input type="time" style={campo} value={cfg.horaIniFds} onChange={(e) => set('horaIniFds', e.target.value)} /></label>
            <label className="campo">até<input type="time" style={campo} value={cfg.horaFimFds} onChange={(e) => set('horaFimFds', e.target.value)} /></label>
            <label className="campo">Duração de cada sessão (min)<input type="number" min="20" max="180" style={campo} value={cfg.bloco} onChange={(e) => set('bloco', Math.max(20, +e.target.value || 50))} /></label>
            <label className="campo">Pausa entre sessões (min)<input type="number" min="0" max="60" style={campo} value={cfg.pausa} onChange={(e) => set('pausa', Math.max(0, +e.target.value || 0))} /></label>
            <label className="campo">Dias finais só de revisão<input type="number" min="0" max="30" style={campo} value={cfg.diasRevisao} onChange={(e) => set('diasRevisao', Math.max(0, +e.target.value || 0))} /></label>
          </div>
        </section>
        <section className="card">
          <p>
            Prévia: <b>{sessoes.length} sessões</b> · <b>{horas} horas</b> de estudo
            {sessoes.length > 0 && <> · de {fmtData(sessoes[0].data)} a {fmtData(sessoes.at(-1).data)}</>}
          </p>
          {!discs.length && <p className="aviso">Este concurso ainda não tem disciplinas cadastradas. Importe o edital na ficha do concurso.</p>}
          <div className="linha">
            <button className="btn pri" disabled={!sessoes.length} onClick={() => { salvar({ cfg, feitos: salvo?.feitos || {} }); setEditando(false); }}>{salvo ? 'Salvar alterações' : 'Confirmar cronograma'}</button>
            {salvo && <button className="btn" onClick={() => setEditando(false)}>Cancelar</button>}
          </div>
        </section>
      </div>
    );
  }

  const feitas = sessoes.filter((s) => feitos[chaveSessao(s)]).length;
  const atrasadas = sessoes.filter((s) => s.data < hoje && !feitos[chaveSessao(s)]).length;
  const porDia = new Map();
  for (const s of sessoes) {
    if (!porDia.has(s.data)) porDia.set(s.data, []);
    porDia.get(s.data).push(s);
  }
  const dias = [...porDia.entries()];
  const proximos = todos ? dias : dias.filter(([d]) => d >= hoje).slice(0, 14);

  const Sessao = ({ s }) => {
    const k = chaveSessao(s);
    const ok = !!feitos[k];
    return (
      <li style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 0', borderTop: '1px solid var(--borda)' }}>
        <input type="checkbox" checked={ok} onChange={() => marcar(s)} aria-label={`Concluída: ${s.disciplina} às ${s.ini}`} style={{ marginTop: 5, width: 20, height: 20 }} />
        <div style={{ flex: 1, opacity: ok ? 0.6 : 1 }}>
          <div className="peq sub">{s.ini}–{s.fim} {s.tipo !== 'estudo' && <span>· 🔁 revisão</span>} {ok && <b className="sobe">· ✓ feito</b>}</div>
          <b>{s.disciplina}</b>
          <div className="peq">{s.tema}</div>
        </div>
        <button className="praticar peq" onClick={() => abrirAvulsas({ materia: s.disciplina, mostrar: 'nao' })}>✎ questões</button>
      </li>
    );
  };

  return (
    <div>
      <div className="linha entre">
        <h1 style={{ margin: 0 }}>📆 Cronograma de estudos</h1>
        <div className="linha">
          <button className="btn peq" onClick={() => setEditando(true)}>⚙️ Ajustar</button>
          <button className="btn peq" onClick={baixarIcs}>📅 Baixar para a agenda (.ics)</button>
          <button className="btn peq" onClick={() => { setTodos(true); setTimeout(() => window.print(), 300); }}>🖨️ Imprimir / PDF</button>
        </div>
      </div>
      <p className="sub">{titulo}{dataProva ? ` · prova em ${fmtData(dataProva)}` : ''}{vert ? ' · baseado no seu edital verticalizado' : ''}</p>
      <ProximaData eventos={eventosDoConcurso(concurso)} />
      <div className="resumos">
        <div className="card"><div className="sub">Sessões feitas</div><div className="numero">{feitas}/{sessoes.length}</div><div className="barra"><i style={{ width: `${(feitas / Math.max(1, sessoes.length)) * 100}%` }} /></div></div>
        <div className="card"><div className="sub">Carga total</div><div className="numero">{horas} h</div><div className="peq sub">{dias.length} dias de estudo</div></div>
        <div className="card"><div className="sub">Atrasadas</div><div className="numero" style={{ color: atrasadas ? 'var(--erro)' : 'var(--ok)' }}>{atrasadas}</div><div className="peq sub">{atrasadas ? 'sessões passadas não marcadas' : 'em dia ✓'}</div></div>
      </div>
      {proximos.map(([d, ss]) => (
        <section key={d} className="card" style={{ borderColor: d === hoje ? 'var(--pri)' : undefined }}>
          <h2 style={{ marginBottom: 2 }}>{d === hoje ? 'Hoje · ' : ''}{nomeDia(d)}, {fmtData(d)}</h2>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {ss.map((s) => <Sessao key={chaveSessao(s)} s={s} />)}
          </ul>
        </section>
      ))}
      {!proximos.length && <p className="card sub">Não há sessões futuras. Use "Ajustar" para gerar um novo período.</p>}
      <button className="btn" onClick={() => setTodos(!todos)}>{todos ? 'Mostrar só os próximos 14 dias' : `Mostrar todos os ${dias.length} dias`}</button>
      <p className="sub peq" style={{ marginTop: 10 }}>
        Para ver no Google Agenda: baixe o arquivo .ics e, no computador, abra o Google Agenda → Configurações → Importar e exportar → Importar. Se quiser, crie antes uma agenda separada (por exemplo, "Estudos") e importe nela.
      </p>
    </div>
  );
}
