// Rodapé único da plataforma — aparece na página de apresentação e dentro do app.
// Serve para duas coisas: deixar à mão as páginas que todo site de estudo precisa ter
// (privacidade, termos, contato, opiniões) e dizer quem mantém o EstudaAí.
// Se você criar uma página nova em public/, acrescente o link aqui também.
import { CONTATO, NOME_PLATAFORMA } from '../data/config.js';

const ANO = new Date().getFullYear();

const colTitulo = { fontSize: '0.78rem', letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--sub)', fontWeight: 700, margin: '0 0 8px' };
const listaEstilo = { listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 6 };
const linkBotao = { background: 'none', border: 0, padding: 0, textAlign: 'left', color: 'var(--pri)', textDecoration: 'underline', cursor: 'pointer', font: 'inherit', minHeight: 0 };

export default function Rodape({ ir = null, aoCriarConta = null, compacto = false }) {
  // dentro do app navegamos por estado; na vitrine, por link
  // Dentro do app a navegação é por estado; na vitrine, por link.
  // Se o item só existe dentro do app e não há link equivalente, mostramos como texto
  // em vez de um link que não leva a lugar nenhum.
  const Item = ({ para, href, children }) => {
    let conteudo;
    if (para && ir) conteudo = <button type="button" style={linkBotao} onClick={() => ir(para)}>{children}</button>;
    else if (href) conteudo = <a href={href}>{children}</a>;
    else conteudo = <span style={{ color: 'var(--sub)' }}>{children}</span>;
    return <li>{conteudo}</li>;
  };

  const zap = CONTATO.whatsapp ? `https://wa.me/${CONTATO.whatsapp}` : null;

  return (
    <footer
      style={{
        borderTop: '1px solid var(--borda)',
        marginTop: 32,
        paddingTop: 20,
        fontSize: '0.9rem',
      }}
    >
      {!compacto && (
        <div style={{ display: 'grid', gap: 20, gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', marginBottom: 20 }}>
          <div>
            <h2 style={colTitulo}>{ir ? 'A plataforma' : 'O que ela faz'}</h2>
            <ul style={listaEstilo}>
              <Item para="dashboard">Início</Item>
              <Item para="cronograma">Cronograma de estudos</Item>
              <Item para="questoes">Banco de questões</Item>
              <Item para="calendario">Calendário dos concursos</Item>
              <Item para="painel">Meu desempenho</Item>
            </ul>
          </div>

          <div>
            <h2 style={colTitulo}>Ajuda</h2>
            <ul style={listaEstilo}>
              <Item href="/contato.html">Falar com o suporte</Item>
              <Item para="opinioes" href="/contato.html#sugestoes">Opiniões e melhorias</Item>
              <Item href="/contato.html#duvidas">Perguntas frequentes</Item>
              <Item href="/contato.html#problema">Relatar um problema</Item>
            </ul>
          </div>

          <div>
            <h2 style={colTitulo}>Institucional</h2>
            <ul style={listaEstilo}>
              <Item href="/sobre.html">Quem mantém o {NOME_PLATAFORMA}</Item>
              <Item href="/privacidade.html">Política de Privacidade</Item>
              <Item href="/termos.html">Termos de Uso</Item>
              <Item href="/privacidade.html#cookies">Política de Cookies</Item>
              <Item href="/termos.html#cancelamento">Cancelamento e reembolso</Item>
            </ul>
          </div>

          <div>
            <h2 style={colTitulo}>Contato</h2>
            <ul style={listaEstilo}>
              <li><a href={`mailto:${CONTATO.email}`}>{CONTATO.email}</a></li>
              {zap && <li><a href={zap} target="_blank" rel="noreferrer">WhatsApp</a></li>}
              <li className="sub peq" style={{ color: 'var(--sub)' }}>Resposta em {CONTATO.prazoResposta}</li>
              {aoCriarConta && (
                <li><button type="button" style={linkBotao} onClick={aoCriarConta}>Criar minha conta</button></li>
              )}
            </ul>
          </div>
        </div>
      )}

      <div className="sub peq" style={{ display: 'grid', gap: 6, paddingBottom: 16 }}>
        <p style={{ margin: 0 }}>
          © {ANO} {NOME_PLATAFORMA} · Mantido por {CONTATO.responsavel}, {CONTATO.cidade}.
        </p>
        <p style={{ margin: 0 }}>
          O {NOME_PLATAFORMA} é uma ferramenta de organização de estudos. Não tem vínculo com bancas
          organizadoras nem com órgãos públicos, não vende vagas, não garante aprovação e não substitui
          a leitura do edital, que é sempre a fonte oficial.
        </p>
        {compacto && (
          <p style={{ margin: 0 }}>
            <a href="/privacidade.html">Privacidade</a> · <a href="/termos.html">Termos</a> · <a href="/contato.html">Contato</a> · <a href="/sobre.html">Sobre</a>
          </p>
        )}
      </div>
    </footer>
  );
}
