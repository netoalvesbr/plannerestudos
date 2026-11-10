import { Component } from 'react';

// Se uma tela der erro, mostra um aviso com saída em vez de deixar a página em branco.
export default class ErroTela extends Component {
  state = { erro: null };
  static getDerivedStateFromError(erro) {
    return { erro };
  }
  componentDidCatch(erro) {
    console.error('Erro na tela', erro);
  }
  componentDidUpdate(antes) {
    if (this.state.erro && antes.chave !== this.props.chave) this.setState({ erro: null });
  }
  render() {
    if (!this.state.erro) return this.props.children;
    return (
      <div className="card" role="alert" style={{ borderColor: 'var(--erro)' }}>
        <h2 style={{ marginTop: 0 }}>✗ Esta tela teve um problema</h2>
        <p>Seus dados continuam salvos. Tente recarregar a página; se o erro voltar, envie esta mensagem em 💡 Sugestões e melhorias:</p>
        <p className="peq sub" style={{ wordBreak: 'break-word' }}>{String(this.state.erro?.message || this.state.erro)}</p>
        <div className="linha">
          <button className="btn pri" onClick={() => window.location.reload()}>↻ Recarregar a página</button>
          {this.props.aoSair && <button className="btn" onClick={() => { this.setState({ erro: null }); this.props.aoSair(); }}>Ir para Meus concursos</button>}
        </div>
      </div>
    );
  }
}
