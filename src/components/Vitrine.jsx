// Página de apresentação do EstudaAí — é o que o visitante vê antes de criar a conta.
// Tudo aqui descreve o que a plataforma realmente faz: nada de depoimento, número de alunos
// ou promessa de aprovação. Se um recurso sair do ar, tire a linha dele daqui também.

// ----- mexa aqui quando fechar os valores -----
export const PLANO = {
  preco: 'R$ 19,90',
  periodo: '/mês',
  diasTeste: 7,
  contato: 'estudaai.suporte@gmail.com', // troque pelo e-mail/WhatsApp que você vai divulgar
};

const RECURSOS = [
  {
    ico: '📄',
    titulo: 'Joga o edital em PDF, sai o cronograma',
    texto: 'A plataforma lê o edital, separa as matérias e os tópicos e monta um cronograma até o dia da prova, com o peso que cada matéria tem no edital.',
  },
  {
    ico: '📆',
    titulo: 'Cronograma que cabe na sua rotina',
    texto: 'Você diz os dias e os horários — ou só quantas horas tem naquele dia — e ele distribui as matérias. Faltou um dia? Replaneja sem perder o que já foi feito.',
  },
  {
    ico: '📝',
    titulo: 'Questões com filtro de verdade',
    texto: 'Filtra por matéria, assunto, banca, ano e dificuldade; separa as que você errou, as que marcou para revisar e monta simulado com o que escolher.',
  },
  {
    ico: '⏱',
    titulo: 'Cronômetro que vira registro',
    texto: 'Cronômetro livre, pomodoro ou timer com alarme. No fim você salva o que estudou — matéria, assunto, páginas lidas e horário — e aquilo entra no seu histórico.',
  },
  {
    ico: '📊',
    titulo: 'Desempenho por matéria',
    texto: 'Acerto por matéria e por assunto, comparação com a meta, evolução por semana e as revisões espaçadas (1, 7, 14 e 30 dias) já marcadas no cronograma.',
  },
  {
    ico: '✍️',
    titulo: 'Discursivas e 2ª fase',
    texto: 'Peça prático-profissional e questões discursivas com espelho de resposta: você escreve, compara com o espelho e registra como foi.',
  },
  {
    ico: '📅',
    titulo: 'As datas do edital no lugar certo',
    texto: 'Inscrição, isenção, locais de prova e o dia da prova com o horário do edital — inclusive convertido para o seu fuso. Dá para anotar tarefas em qualquer dia.',
  },
  {
    ico: '🔀',
    titulo: 'Mais de um concurso ao mesmo tempo',
    texto: 'Estudando para dois? Junta os dois num cronograma só, define qual é a prioridade e cada matéria é estudada até a véspera da prova dela.',
  },
];

const PASSOS = [
  ['1', 'Crie a conta', `Leva um minuto. O teste é gratuito por ${PLANO.diasTeste} dias e não pede cartão.`],
  ['2', 'Importe o edital', 'Anexe o PDF do edital do seu concurso. As matérias, os tópicos e as datas são lidos automaticamente.'],
  ['3', 'Comece a estudar', 'O cronograma do dia aparece na tela inicial. Você estuda, responde questões e acompanha o desempenho.'],
];

const PERGUNTAS = [
  ['Preciso instalar alguma coisa?', 'Não. Funciona no navegador do celular, do tablet e do computador, com o mesmo login nos três.'],
  ['Serve para qualquer concurso?', 'Sim. O cronograma é montado a partir do edital que você importar. Também dá para cadastrar as matérias na mão.'],
  ['Meu histórico fica visível para outras pessoas?', 'Não. Cada conta enxerga só o próprio histórico de estudos e de desempenho. O banco de questões é compartilhado; o seu desempenho, não.'],
  ['Posso cancelar?', 'Pode cancelar quando quiser, sem multa. Você continua com acesso até o fim do período já pago.'],
  ['E se eu perder dias de estudo?', 'O cronograma tem replanejamento: o que já foi feito sai da fila e o restante é redistribuído a partir de hoje, sem apagar o seu histórico.'],
];

export default function Vitrine({ aoCriarConta, aoEntrar }) {
  const caixa = { maxWidth: 1040, margin: '0 auto', padding: '0 16px' };
  return (
    <div style={{ paddingBottom: 40 }}>
      {/* topo */}
      <header style={{ ...caixa, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '16px' }}>
        <div className="logo" style={{ fontSize: '1.4rem' }}>📚 EstudaAí</div>
        <button className="btn peq" onClick={aoEntrar}>Entrar</button>
      </header>

      {/* chamada principal */}
      <section style={{ ...caixa, textAlign: 'center', padding: '28px 16px 8px' }}>
        <h1 style={{ fontSize: 'clamp(1.8rem, 5vw, 2.8rem)', lineHeight: 1.15, margin: '0 0 12px' }}>
          Seu edital vira cronograma.<br />Seu estudo vira resultado.
        </h1>
        <p className="sub" style={{ fontSize: '1.1rem', maxWidth: 620, margin: '0 auto 20px' }}>
          Uma plataforma só para quem estuda para concurso: importe o edital, receba o cronograma até o dia da prova,
          resolva questões e acompanhe o seu desempenho matéria por matéria.
        </p>
        <div className="linha" style={{ justifyContent: 'center' }}>
          <button className="btn pri" onClick={aoCriarConta} style={{ fontSize: '1.05rem', padding: '12px 24px' }}>
            Testar grátis por {PLANO.diasTeste} dias
          </button>
          <button className="btn" onClick={aoEntrar}>Já tenho conta</button>
        </div>
        <p className="sub peq" style={{ marginTop: 10 }}>Sem cartão de crédito para testar · cancele quando quiser</p>
      </section>

      {/* o problema */}
      <section style={{ ...caixa, padding: '24px 16px' }}>
        <div className="card" style={{ background: 'var(--pri-claro)', borderColor: 'var(--pri)' }}>
          <p style={{ margin: 0, fontSize: '1.05rem' }}>
            Estudar para concurso dá trabalho antes mesmo de abrir o livro: ler o edital inteiro, montar o cronograma,
            lembrar das datas, anotar o que já foi feito, descobrir onde você está errando.
            <b> O EstudaAí cuida dessa parte</b> — o que sobra para você é estudar.
          </p>
        </div>
      </section>

      {/* recursos */}
      <section style={{ ...caixa, padding: '8px 16px 16px' }}>
        <h2 style={{ textAlign: 'center' }}>O que você tem desde o primeiro dia</h2>
        <div className="grade" style={{ marginTop: 16, gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
          {RECURSOS.map((r) => (
            <div key={r.titulo} className="card">
              <div style={{ fontSize: '1.8rem', lineHeight: 1 }} aria-hidden="true">{r.ico}</div>
              <h3 style={{ margin: '8px 0 6px' }}>{r.titulo}</h3>
              <p className="sub" style={{ margin: 0 }}>{r.texto}</p>
            </div>
          ))}
        </div>
      </section>

      {/* como funciona */}
      <section style={{ ...caixa, padding: '16px' }}>
        <h2 style={{ textAlign: 'center' }}>Como começa</h2>
        <div className="grade" style={{ marginTop: 16, gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
          {PASSOS.map(([n, t, d]) => (
            <div key={n} className="card">
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--pri)', color: 'var(--pri-txt)', display: 'grid', placeItems: 'center', fontWeight: 800 }}>{n}</div>
              <h3 style={{ margin: '8px 0 6px' }}>{t}</h3>
              <p className="sub" style={{ margin: 0 }}>{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* plano */}
      <section style={{ ...caixa, padding: '16px' }}>
        <h2 style={{ textAlign: 'center' }}>Quanto custa</h2>
        <div className="card" style={{ maxWidth: 420, margin: '16px auto 0', textAlign: 'center', borderColor: 'var(--pri)', borderWidth: 2 }}>
          <div className="etiqueta" style={{ display: 'inline-block' }}>Plano único</div>
          <p style={{ margin: '10px 0 2px' }}>
            <span style={{ fontSize: '2.4rem', fontWeight: 800 }}>{PLANO.preco}</span>
            <span className="sub">{PLANO.periodo}</span>
          </p>
          <p className="sub peq" style={{ marginTop: 0 }}>Comece com {PLANO.diasTeste} dias grátis</p>
          <ul className="lista-limpa" style={{ textAlign: 'left', margin: '14px 0' }}>
            {[
              'Todos os recursos, sem limite de concursos',
              'Cronograma, calendário e replanejamento',
              'Banco de questões, simulados e discursivas',
              'Cronômetro, registro de estudos e desempenho',
              'Acesso no celular e no computador',
            ].map((l) => (
              <li key={l} style={{ padding: '3px 0' }}>✓ {l}</li>
            ))}
          </ul>
          <button className="btn pri" style={{ width: '100%' }} onClick={aoCriarConta}>Começar agora</button>
          <p className="sub peq" style={{ marginBottom: 0 }}>Cancele quando quiser, sem multa.</p>
        </div>
      </section>

      {/* dúvidas */}
      <section style={{ ...caixa, padding: '16px' }}>
        <h2 style={{ textAlign: 'center' }}>Perguntas frequentes</h2>
        <div className="card" style={{ marginTop: 16 }}>
          {PERGUNTAS.map(([p, r], i) => (
            <details key={p} style={{ borderTop: i ? '1px solid var(--borda)' : 'none', padding: '10px 0' }}>
              <summary style={{ fontWeight: 700, cursor: 'pointer' }}>{p}</summary>
              <p className="sub" style={{ margin: '8px 0 0' }}>{r}</p>
            </details>
          ))}
        </div>
      </section>

      {/* chamada final */}
      <section style={{ ...caixa, padding: '8px 16px 24px', textAlign: 'center' }}>
        <div className="card" style={{ background: 'var(--pri-claro)', borderColor: 'var(--pri)' }}>
          <h2 style={{ marginTop: 0 }}>A sua prova tem data. O seu cronograma não precisa esperar.</h2>
          <button className="btn pri" onClick={aoCriarConta} style={{ fontSize: '1.05rem', padding: '12px 24px' }}>
            Testar grátis por {PLANO.diasTeste} dias
          </button>
        </div>
      </section>

      <footer style={{ ...caixa, textAlign: 'center' }}>
        <p className="sub peq">
          Dúvidas? <a href={`mailto:${PLANO.contato}`}>{PLANO.contato}</a>
        </p>
        <p className="sub peq">
          <a href="/privacidade.html">Política de Privacidade</a> · <a href="/termos.html">Termos de Uso</a>
        </p>
      </footer>
    </div>
  );
}
