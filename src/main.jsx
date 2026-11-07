import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { preCarregarLeitor } from './lib/leitorPdf.js';

// baixa o leitor de PDF logo no início, para a importação de editais não falhar após uma atualização
preCarregarLeitor();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
