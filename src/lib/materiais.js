// Materiais de estudo (livros, apostilas, doutrina, jurisprudência) em PDF.
// O texto fica guardado neste aparelho (IndexedDB), porque costuma ser grande e é material pessoal.
// A plataforma monta o pedido para o Claude (sem custo) e importa de volta o que ele gerar:
// questões, resumo, mapa mental ou slides.

const BANCO = 'estudaai-materiais';
const LOJA = 'materiais';

function abrir() {
  return new Promise((ok, erro) => {
    const r = indexedDB.open(BANCO, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(LOJA, { keyPath: 'id' });
    r.onsuccess = () => ok(r.result);
    r.onerror = () => erro(r.error);
  });
}
async function operar(modo, f) {
  const db = await abrir();
  return new Promise((ok, erro) => {
    const tx = db.transaction(LOJA, modo);
    const req = f(tx.objectStore(LOJA));
    tx.oncomplete = () => ok(req?.result);
    tx.onerror = () => erro(tx.error);
  });
}
export const listarMateriais = async () => ((await operar('readonly', (s) => s.getAll())) || []).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
export const salvarMaterial = (m) => operar('readwrite', (s) => s.put(m));
export const excluirMaterial = (id) => operar('readwrite', (s) => s.delete(id));

// linhas do pdf.js (com '' marcando o fim de cada página) → uma string por página
export function paginasDe(linhas) {
  const paginas = [];
  let atual = [];
  for (const l of linhas) {
    if (l === '') {
      paginas.push(atual.join('\n'));
      atual = [];
    } else atual.push(l);
  }
  if (atual.length) paginas.push(atual.join('\n'));
  return paginas;
}

export const TIPOS_MATERIAL = ['Apostila', 'Livro / doutrina', 'Jurisprudência', 'Legislação', 'Resumo / aula', 'Outro'];
export const LIMITE_CARACTERES = 350000; // acima disso o pedido fica grande demais para uma conversa

export const SAIDAS = {
  questoes: { rotulo: '✎ Questões', desc: 'Questões no estilo da banca, com gabarito e comentário' },
  resumo: { rotulo: '📝 Resumo', desc: 'Resumo organizado, para ler e baixar em PDF' },
  mapa: { rotulo: '🧠 Mapa mental', desc: 'Mapa mental com os tópicos e notas curtas' },
  slides: { rotulo: '🖥️ Slides', desc: 'Apresentação de revisão, para ver e baixar em PDF' },
};

const FORMATOS = {
  'A-E': 'múltipla escolha com 5 alternativas (A a E)',
  'A-D': 'múltipla escolha com 4 alternativas (A a D)',
  CE: 'Certo ou Errado (estilo Cebraspe)',
  discursiva: 'discursiva (questão aberta ou peça), com padrão de resposta',
};

function distribuicao(n, formato) {
  if (formato === 'discursiva') return '';
  const letras = formato === 'CE' ? ['C', 'E'] : formato === 'A-D' ? ['A', 'B', 'C', 'D'] : ['A', 'B', 'C', 'D', 'E'];
  const cada = Math.floor(n / letras.length);
  return `- Distribua os gabaritos de forma equilibrada: cerca de ${Math.max(1, cada)} de cada (${letras.join(', ')}), em ordem aleatória.\n`;
}

// Monta o pedido completo para colar no Claude
export function montarPedido({ saida, material, paginas, contexto, opcoes = {} }) {
  const texto = paginas.map((p) => `[página ${p + 1}]\n${material.paginas[p]}`).join('\n\n');
  const alvo = [contexto.concurso && `Concurso: ${contexto.concurso}`, contexto.cargo && `Cargo/fase: ${contexto.cargo}`, contexto.banca && `Banca: ${contexto.banca}`, contexto.materia && `Matéria: ${contexto.materia}`]
    .filter(Boolean)
    .join('\n');
  const base = `Você é um professor especialista em concursos públicos no Brasil. Use SOMENTE o material abaixo (${material.tipo}: "${material.titulo}") como base, conferindo se a legislação citada está vigente; se algo do material estiver desatualizado, avise no comentário.\n\n${alvo}\n`;
  let tarefa = '';
  if (saida === 'questoes') {
    const n = opcoes.quantidade || 10;
    const f = opcoes.formato || 'A-E';
    const letras = f === 'A-D' ? '"A","B","C","D"' : '"A","B","C","D","E"';
    tarefa = `TAREFA: elabore ${n} questões inéditas no formato ${FORMATOS[f]}, no estilo da banca${contexto.banca ? ` ${contexto.banca}` : ''}, cobrindo os pontos mais cobrados do material${opcoes.dificuldade ? `, dificuldade ${opcoes.dificuldade}` : ', com dificuldade variada'}.
Regras:
- Cada questão deve ter uma única resposta correta, sem ambiguidade, e distratores plausíveis.
${distribuicao(n, f)}- No comentário, explique por que a correta está certa e por que as outras estão erradas, com a fundamentação (artigo de lei, súmula, tese ou página do material).
- Não copie trechos longos do material: reescreva com suas palavras.

Responda APENAS com um bloco JSON neste formato exato:
\`\`\`json
{"questoes":[{"assunto":"tema curto","dificuldade":"fácil|média|difícil","enunciado":"...",${
      f === 'discursiva' ? '"espelho":"padrão de resposta esperado, com os pontos que valem nota"' : f === 'CE' ? '"gabarito":"C ou E"' : `"alternativas":{${letras.split(',').map((l) => `${l}:"..."`).join(',')}},"gabarito":"A"`
    },"comentario":"explicação + fundamentação"}]}
\`\`\``;
  } else if (saida === 'resumo') {
    tarefa = `TAREFA: faça um resumo completo e bem organizado para revisão${opcoes.foco ? `, com foco em: ${opcoes.foco}` : ''}.
- Use Markdown: títulos com #, ## e ###, listas com "-", destaque em **negrito** os conceitos, prazos, exceções e artigos de lei.
- Inclua ao final uma seção "## Pegadinhas de prova" e outra "## Revisão em 10 linhas".
- Escreva com suas palavras; não copie parágrafos do material.
Responda APENAS com o resumo em Markdown.`;
  } else if (saida === 'mapa') {
    tarefa = `TAREFA: crie um mapa mental do conteúdo, com 4 a 8 ramos principais e até 3 níveis.
Cada nó tem "t" (título curto) e, quando útil, "n" (nota de até 2 linhas com artigo de lei, prazo ou macete) e "c" (filhos).
Responda APENAS com um bloco JSON neste formato exato:
\`\`\`json
{"titulo":"tema central","c":[{"t":"Ramo","n":"nota curta","c":[{"t":"Sub-ramo","n":"..."}]}]}
\`\`\``;
  } else if (saida === 'slides') {
    tarefa = `TAREFA: crie uma apresentação de revisão com ${opcoes.quantidade || 12} slides.
- Formato Markdown: cada slide começa com "# Título do slide"; separe os slides com uma linha contendo apenas ---
- No máximo 6 tópicos curtos por slide, com **negrito** nos pontos-chave. O último slide é "# Resumo final".
Responda APENAS com os slides em Markdown.`;
  }
  return `${base}\n${tarefa}\n\n===== MATERIAL (${paginas.length} páginas) =====\n${texto}\n===== FIM DO MATERIAL =====`;
}

// Lê a resposta colada do Claude
export function lerResposta(saida, texto) {
  const t = (texto || '').trim();
  if (!t) throw new Error('Cole a resposta do Claude no campo acima.');
  if (saida === 'resumo' || saida === 'slides') {
    const m = t.match(/```(?:markdown|md)?\s*\n([\s\S]*?)```/);
    const md = (m ? m[1] : t).trim();
    if (saida === 'slides') {
      const slides = md.split(/\n-{3,}\s*\n/).map((s) => s.trim()).filter(Boolean);
      if (!slides.length) throw new Error('Não encontrei slides na resposta.');
      return slides;
    }
    return md;
  }
  const bloco = t.match(/```(?:json)?\s*\n([\s\S]*?)```/);
  let bruto = bloco ? bloco[1] : t;
  if (!bloco) {
    const i = bruto.indexOf('{');
    const j = bruto.lastIndexOf('}');
    if (i < 0 || j < i) throw new Error('Não encontrei o bloco JSON na resposta. Copie a resposta inteira do Claude.');
    bruto = bruto.slice(i, j + 1);
  }
  let obj;
  try {
    obj = JSON.parse(bruto);
  } catch {
    throw new Error('A resposta veio incompleta ou com erro de formato. Peça ao Claude: "envie de novo só o JSON completo".');
  }
  if (saida === 'mapa') {
    if (!Array.isArray(obj.c) || !obj.c.length) throw new Error('O mapa mental veio vazio.');
    return obj;
  }
  const qs = Array.isArray(obj) ? obj : obj.questoes;
  if (!Array.isArray(qs) || !qs.length) throw new Error('Não encontrei questões na resposta.');
  return qs;
}

// Página de impressão (o usuário salva como PDF pela janela de impressão)
export const escapar = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export function mdParaHtml(md) {
  const linhas = md.split('\n');
  let html = '';
  let lista = false;
  const inline = (s) => escapar(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*(?!\s)(.+?)\*/g, '$1<i>$2</i>');
  for (const l of linhas) {
    const h = l.match(/^(#{1,4})\s+(.*)/);
    const li = l.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)/);
    if (!li && lista) {
      html += '</ul>';
      lista = false;
    }
    if (h) html += `<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`;
    else if (li) {
      if (!lista) html += '<ul>';
      lista = true;
      html += `<li>${inline(li[1])}</li>`;
    } else if (l.trim()) html += `<p>${inline(l)}</p>`;
  }
  if (lista) html += '</ul>';
  return html;
}

export function imprimir(titulo, corpoHtml, { paisagem = false } = {}) {
  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escapar(titulo)}</title>
<style>
@page { size: A4 ${paisagem ? 'landscape' : 'portrait'}; margin: 16mm; }
body { font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; color: #111; line-height: 1.5; }
h1 { color: #1d3f9e; border-bottom: 2px solid #1d3f9e; padding-bottom: 4px; }
h2 { color: #1d3f9e; margin-top: 1.2em; } h3 { margin-bottom: 0.2em; }
.slide { page-break-after: always; min-height: 150mm; display: flex; flex-direction: column; justify-content: center; font-size: 1.35rem; }
.slide h1 { font-size: 2rem; } .slide:last-child { page-break-after: auto; }
.rodape { color: #666; font-size: 0.8rem; margin-top: 2em; }
ul.mapa, ul.mapa ul { list-style: none; padding-left: 1.2em; border-left: 2px solid #c9d6f5; }
ul.mapa li { margin: 4px 0; } .nota { color: #444; font-size: 0.9em; }
</style></head><body>${corpoHtml}<p class="rodape">EstudaAí · ${escapar(titulo)}</p>
<script>window.onload = () => setTimeout(() => window.print(), 300);</script></body></html>`);
  w.document.close();
  return true;
}

export function mapaParaHtml(no) {
  const item = (n) => `<li><b>${escapar(n.t)}</b>${n.n ? `<div class="nota">${escapar(n.n)}</div>` : ''}${n.c?.length ? `<ul>${n.c.map(item).join('')}</ul>` : ''}</li>`;
  return `<h1>${escapar(no.titulo || 'Mapa mental')}</h1><ul class="mapa">${(no.c || []).map(item).join('')}</ul>`;
}
