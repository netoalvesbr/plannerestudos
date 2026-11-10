import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { preCarregarLeitor } from './lib/leitorPdf.js';
import { lerEdital } from './lib/leitura.js';

// usado para conferir a leitura de editais reais (diagnóstico)
window.estudaaiLerEdital = lerEdital;
window.estudaaiLinhasDaPagina = (itens, largura) => import('./lib/linhasPdf.js').then((m) => m.linhasDaPagina(itens, largura));

// baixa o leitor de PDF logo no início, para a importação de editais não falhar após uma atualização
preCarregarLeitor();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
