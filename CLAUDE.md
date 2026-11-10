# EstudaAí – instruções para o Claude Code

Plataforma de estudos para concursos (React 19 + Vite, Supabase opcional, deploy na Vercel). O dono do projeto não é programador: explique em linguagem simples, trabalhe em etapas pequenas e testáveis e guie passo a passo tudo o que for preciso fazer fora do computador.

- Especificação completa: `docs/especificacao.md`. A ordem de entrega está na seção 16. A Versão 1 já está pronta (ver README).
- Interface 100% em português do Brasil, mobile-first, modos claro e escuro, acessível (nunca transmitir informação só por cor: usar ✓/✗ e texto).
- Dados do usuário: `src/lib/store.js` (modo conta = Supabase com RLS; modo local = localStorage). Respostas: `{ uid: [letra, acertou, ts, segundos] }`. Uma resposta fica travada depois de dada.
- Questões: JSON `versao_esquema 2.0` em `src/data/questoes/`. O `uid` é o hash do enunciado normalizado, então mudar o enunciado gera uma questão nova.
- Regras obrigatórias do conteúdo (seção 13 da especificação): gabarito de cálculo gerado por programa (ver `ferramentas/`), 4 de cada letra por bloco de 20, comentário + fundamentação, legislação vigente e revisão independente sem gabarito antes de publicar.
- Nunca mudar o link nem apagar o histórico dos usuários ao publicar novidades.
- Antes de entregar, rode `npm run build` e teste no navegador.
- Legislação: a referência para procurar leis é sempre o Portal da Legislação do Planalto (https://www4.planalto.gov.br/legislacao/); textos em www.planalto.gov.br/ccivil_03/ (versão compilada). O Planalto bloqueia servidores: a importação do texto é feita pelo navegador do administrador (👑 Admin → Textos das leis).
