// Tela que aparece quando o teste grátis acabou ou a assinatura está inativa.
//
// Duas decisões de projeto aqui:
//  1. Nada é apagado. O histórico da pessoa continua guardado e volta assim que ela
//     reativa — a tela diz isso, porque é a primeira dúvida de quem vê um bloqueio.
//  2. Ela pode levar os próprios dados embora (botão de baixar o histórico), mesmo
//     sem pagar. Dado de estudo é da pessoa, não da plataforma.
import { useState } from 'react';
import { CONTATO, DIAS_TESTE, LINK_ASSINATURA, PLANO_PERIODO, PLANO_PRECO } from '../data/config.js';

const INCLUI = [
  'Cronograma que se replaneja quando você perde um dia',
  'Banco de questões, simulados e discursivas com espelho',
  'Calendário dos concursos com as datas e horários do edital',
  'Leitura em voz alta com transcrição e áudio guardado',
  'Cronômetro, registro de estudos e desempenho por matéria',
];

export default function TesteEncerrado({ ctx, plano, aoSair }) {
  const [baixando, setBaixando] = useState(false);
  const eraTeste = !plano?.plano || plano.plano === 'teste';

  const baixarHistorico = async () => {
    setBaixando(true);
    try {
      const texto = await ctx.historicoTexto();
      const url = URL.createObjectURL(new Blob([texto], { type: 'text/plain;charset=utf-8' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'meu-historico-estudaai.txt';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // se falhar, o caminho do suporte continua logo abaixo
    }
    setBaixando(false);
  };

  const assunto = encodeURIComponent('Quero assinar o EstudaAí');
  const corpo = encodeURIComponent(
    `Olá! Quero assinar o EstudaAí.\n\nMeu e-mail de cadastro: ${ctx?.usuario?.email || ''}\n`,
  );

  return (
    <div style={{ maxWidth: 620, margin: '0 auto' }}>
      <div className="card" style={{ borderColor: 'var(--pri)', borderWidth: 2 }}>
        <h1 style={{ marginTop: 0 }}>
          {eraTeste ? `Seu teste de ${DIAS_TESTE} dias terminou` : 'Sua assinatura está inativa'}
        </h1>
        <p className="sub">
          {eraTeste
            ? 'Esperamos que tenha dado para sentir se a plataforma te ajuda a estudar. Para continuar, é só assinar.'
            : 'O acesso aos recursos está pausado até a assinatura ser reativada.'}
        </p>

        <p
          className="aviso"
          role="status"
          style={{ background: 'var(--ok-bg)', color: 'var(--ok)' }}
        >
          ✓ Nada do que você estudou foi apagado. Suas respostas, cronogramas, leituras e o seu
          desempenho continuam guardados e voltam exatamente como estavam.
        </p>

        <div className="card" style={{ background: 'var(--pri-claro)', borderColor: 'var(--pri)' }}>
          <p style={{ margin: 0, fontSize: '1.6rem', fontWeight: 800 }}>
            {PLANO_PRECO}<span className="sub" style={{ fontSize: '1rem', fontWeight: 400 }}>{PLANO_PERIODO}</span>
          </p>
          <p className="sub peq" style={{ marginTop: 2 }}>Sem fidelidade. Cancele quando quiser.</p>
          <ul style={{ listStyle: 'none', padding: 0, margin: '10px 0 0' }}>
            {INCLUI.map((l) => <li key={l} style={{ padding: '3px 0' }}>✓ {l}</li>)}
          </ul>
        </div>

        {LINK_ASSINATURA ? (
          <a className="btn pri" href={LINK_ASSINATURA} style={{ display: 'block', textAlign: 'center' }}>
            Assinar agora
          </a>
        ) : (
          <>
            <p>
              <b>Para assinar</b>, escreva para{' '}
              <a href={`mailto:${CONTATO.email}?subject=${assunto}&body=${corpo}`}>{CONTATO.email}</a>{' '}
              que eu te passo os dados de pagamento e libero o seu acesso na hora da confirmação.
            </p>
            <a
              className="btn pri"
              href={`mailto:${CONTATO.email}?subject=${assunto}&body=${corpo}`}
              style={{ display: 'block', textAlign: 'center' }}
            >
              Quero assinar
            </a>
          </>
        )}
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0, fontSize: '1rem' }}>Outras opções</h2>
        <div className="linha">
          <button className="btn" onClick={baixarHistorico} disabled={baixando}>
            {baixando ? 'Preparando…' : '⬇️ Baixar o meu histórico'}
          </button>
          <button className="btn" onClick={aoSair}>Sair da conta</button>
        </div>
        <p className="sub peq" style={{ marginBottom: 0 }}>
          O histórico sai em arquivo de texto, com as suas respostas e os seus registros de estudo.
          Ele é seu, independentemente de assinatura.
        </p>
      </div>
    </div>
  );
}

// Faixa discreta mostrada enquanto o teste ainda está correndo, nos últimos dias.
export function AvisoTeste({ plano }) {
  if (!plano || !plano.ativo || plano.plano !== 'teste') return null;
  if (plano.dias == null || plano.dias > 3) return null;
  return (
    <p className="aviso" role="status">
      {plano.dias <= 0
        ? 'Seu teste grátis termina hoje.'
        : `Faltam ${plano.dias} dia${plano.dias === 1 ? '' : 's'} do seu teste grátis.`}{' '}
      Para continuar depois, escreva para <a href={`mailto:${CONTATO.email}`}>{CONTATO.email}</a>.
    </p>
  );
}
