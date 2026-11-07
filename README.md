# EstudaAí – Plataforma de estudos para concursos

Banco de questões com correção imediata, provas diárias, simulado, painel de desempenho, menu 📊 e mapas mentais.
O primeiro concurso cadastrado é a **PC/AC (IDECAN, 2026)**. A especificação completa está em `docs/especificacao.md`.

## O que já está pronto (Versão 1)

- Login (Google ou link por e-mail) com histórico privado de cada pessoa, ou **modo de teste local** sem login.
- Tela "Meus concursos", ficha do concurso (vagas, prova, pesos, cronograma) e escolha de cargo.
- Provas diárias (blocos de 20) e questões avulsas com filtros. A base de respostas é a mesma para os dois formatos.
- Tela da questão com correção na hora, comentário, fundamentação, anotação pessoal e alternativa travada depois de respondida.
- Simulado com cronômetro de 50 minutos e gabarito só no final.
- Painel com tabela de rendimento, gráfico dos últimos 14 dias, barras com a meta de 75%, estimativa de nota pelos pesos oficiais, assuntos para revisar, exportar histórico e zerar respostas.
- Ícone 📊 em todas as telas, com as abas "Comparar períodos" e "Por disciplina" (detalhamento por assunto).
- Mapas mentais em árvore recolhível, com o atalho "✎ praticar".
- Modo claro e escuro, layout para celular.

**Conteúdo atual:** Dia 1 (09/11/2026), Prova 1 – Manhã (20 questões, Oficial Investigador). Há mapas mentais de Direito Constitucional, Raciocínio Lógico, Arquivologia e Estatística.

**Próximas versões:** mais dias e blocos de questões, os demais mapas, cronômetro de estudos, calendário, importação de provas em PDF e cadastro de concursos pelo administrador.

## Link da plataforma

**https://plannerestudos-sage.vercel.app**: login com e-mail e senha, e cada pessoa com a própria conta. Toda alteração enviada ao GitHub é publicada automaticamente neste mesmo link.

## Versão de teste publicada no Claude

A plataforma está publicada como página no Claude: https://claude.ai/artifact/5ChZ3DxEqsXAt3PBR6bXWe

- Quem abre o link com login no Claude e permissão de **Colaborador** (Contributor) tem o histórico salvo na própria conta Claude, sincronizado entre celular e computador. Ninguém vê o histórico de outra pessoa.
- Quem abre só como Visualizador (Viewer), ou sem login, usa normalmente, mas as respostas ficam salvas apenas naquele aparelho.
- Para republicar depois de mudanças: `npm run build` e publicar de novo os arquivos de `dist/` (o link continua o mesmo).

Para que qualquer pessoa crie a própria conta com e-mail, sem precisar do Claude, use o caminho Supabase + Vercel abaixo.

---

## 1. Rodar no seu computador

Pré-requisito: [Node.js](https://nodejs.org) (versão LTS).

```
npm install
npm run dev
```

Abra o endereço que aparecer (normalmente http://localhost:5173). Sem o Supabase configurado, a plataforma abre em **modo de teste**: pede só o nome e salva tudo neste navegador.

## 2. Ligar login e banco de dados (Supabase, gratuito)

1. Crie uma conta em https://supabase.com e clique em **New project**.
2. No menu **SQL Editor**, cole todo o conteúdo de `supabase/schema.sql` e clique em **Run**.
3. Em **Project Settings → API**, copie a **Project URL** e a chave **anon public**.
4. Crie um arquivo `.env` na pasta do projeto (use `.env.example` como modelo):
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```
5. Em **Authentication → URL Configuration**, coloque em *Site URL* o endereço do site (depois da etapa 3, o link da Vercel). Em *Redirect URLs*, adicione também `http://localhost:5173`.
6. (Opcional) Para o botão "Entrar com Google", ative o provedor Google em **Authentication → Providers**. O login por link de e-mail já funciona sem essa etapa.

## 3. Publicar online (Vercel, gratuito)

1. Envie esta pasta para um repositório no GitHub.
2. Em https://vercel.com, clique em **Add New → Project** e importe o repositório. A Vercel reconhece o Vite sozinha.
3. Em **Environment Variables**, adicione `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
4. Clique em **Deploy**. O link gerado (ex.: `estudaai.vercel.app`) é o que você compartilha.

Cada novo envio ao GitHub publica a atualização **no mesmo link**, sem apagar o histórico dos usuários.

## 4. Acrescentar questões

As questões ficam em `src/data/questoes/*.json`, no formato `versao_esquema 2.0` (seção 12 da especificação). Todo arquivo novo nessa pasta entra automaticamente na plataforma.

- `ferramentas/gerar_pcac_s01_d1.py` é o modelo de gerador. Ele **calcula** o gabarito das questões de cálculo, posiciona as respostas para manter 4 de cada letra e confere que não há alternativas repetidas:
  ```
  python3 ferramentas/gerar_pcac_s01_d1.py src/data/questoes/pcac-s01-d1.json
  ```
- Antes de publicar, toda questão deve passar por revisão independente: alguém resolve sem ver o gabarito.

## 5. Acrescentar um concurso

Inclua a ficha em `src/data/concursos.js` (siga a estrutura da PC/AC) e as questões com `concurso_id` correspondente. Para mapas mentais, use `src/data/mapas.js`, com uma chave por disciplina.

## Estrutura

```
src/
  App.jsx               navegação e estado
  components/           telas (Questao, Inicio, Painel, Mapas, Concursos, MenuDesempenho, Graficos)
  data/                 concursos, mapas mentais e questões (JSON)
  lib/store.js          login e dados do usuário (Supabase ou local)
  lib/stats.js          cálculos de desempenho
supabase/schema.sql     tabelas e regras de privacidade
ferramentas/            geradores de questões
docs/especificacao.md   especificação completa
```
