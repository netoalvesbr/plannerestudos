# PROMPT – EstudaAí: Plataforma de Estudos para Concursos (multi-concurso)

Você vai construir uma plataforma web de estudos para concursos públicos chamada **EstudaAí**. Ela reúne vários concursos num só lugar, com banco de questões, mapas mentais, cronômetro, calendário, painel de desempenho e importação de provas anteriores. Poderá ser compartilhada por link com qualquer pessoa. Cada usuário tem os próprios estudos e o próprio histórico.

O **primeiro concurso pré-cadastrado** é o da **Polícia Civil do Acre (PC/AC)**, com conteúdo completo (seção 14). A estrutura deve aceitar outros concursos sem mudar o código, só com novos dados.

Siga todas as especificações abaixo.

---

## 1. Objetivo e público
- O candidato estuda pelo celular e pelo computador, em sessões curtas ao longo do dia.
- A plataforma deve:
  1. organizar o estudo de **vários concursos** e das suas disciplinas;
  2. oferecer questões no estilo da banca de cada concurso, com correção imediata e fundamentação;
  3. medir o rendimento por concurso, disciplina e assunto;
  4. oferecer mapas mentais do conteúdo do edital, ligados às questões;
  5. controlar o tempo de estudo (cronômetro) e o planejamento (calendário);
  6. permitir importar provas anteriores para alimentar o banco de questões.
- Interface 100% em português do Brasil, mobile-first, com modo claro e escuro.

## 2. Acesso, compartilhamento e dados do usuário
- Login pela conta do próprio provedor da plataforma. Não criar senha própria dentro da página: senha guardada em código do navegador não é segura.
- A plataforma é compartilhada por **um único link**. Qualquer pessoa que o abra entra com a própria conta.
- **Conteúdo comum** a todos os usuários: concursos, disciplinas do edital, banco de questões e mapas mentais publicados pelo administrador (eu).
- **Dados privados de cada usuário**: respostas, histórico, horas no cronômetro, calendário, disciplinas e anotações pessoais, concursos que ele escolheu acompanhar. Ninguém vê o desempenho de outro.
- As respostas são salvas na conta (sincroniza celular ↔ computador) e também localmente como cópia de segurança. Sem permissão de gravação na conta, avisar: "Respostas salvas apenas neste aparelho".
- Mostrar a saudação "Olá, [primeiro nome]".
- **Papel de administrador** (só eu): cadastrar concursos, importar provas, revisar questões e publicar conteúdo novo.

## 3. Concursos
- Tela "Meus concursos": cartões com o nome do concurso, banca, cargo(s), data da prova e contagem regressiva ("faltam 78 dias"), além do acerto geral do usuário naquele concurso.
- O usuário escolhe quais concursos acompanha. Um seletor no topo define o **concurso ativo**, e todas as telas (questões, rendimento, mapas, painel) passam a mostrar os dados dele.
- Cada concurso tem uma ficha com: órgão, edital, banca, cargos, vagas, remuneração, requisitos, datas do cronograma, estrutura da prova (número de questões, blocos, pesos, critérios de aprovação), formato das questões (5 alternativas A–E ou Certo/Errado) e meta de acerto (padrão 75%).
- O administrador cadastra um novo concurso preenchendo essa ficha (ou importando um JSON, seção 12).

## 4. Disciplinas e assuntos
- Cada concurso tem disciplinas agrupadas em blocos (ex.: Conhecimentos Básicos, Jurídicos, Específicos), cada uma com seus assuntos e o item do edital correspondente.
- Uma disciplina comum a vários concursos (ex.: Português, Constitucional) é a mesma disciplina, e as questões dela servem a todos.
- O usuário pode **criar disciplinas e assuntos pessoais** (visíveis só para ele) e marcar os tópicos como estudados, para ver o progresso de cada disciplina em %.

## 5. Escolha de formato de estudo (primeiro acesso a cada concurso)
Perguntar "Como você prefere estudar?" com duas opções, trocáveis depois por botões no topo:
1. **Provas diárias**: por dia, 3 blocos de 20 questões (Manhã, Tarde, Noite). Seletor de dias (Dia 1 · 09/11, Dia 2 · 10/11…). Cada cartão de bloco mostra o andamento ("12/20 resolvidas · 9 certas · 3 erradas"). Ao reabrir um bloco, ir para a primeira questão não respondida.
2. **Questões avulsas**: filtros por Concurso, Banca, Ano, Origem (Inédita / Prova anterior), Disciplina, Assunto (dependente da disciplina), Dificuldade (fácil/média/difícil) e Mostrar (Não resolvidas / Que errei / Que acertei / Todas). Mostrar "N questões encontradas" e os botões "Resolver na ordem" e "Resolver em ordem aleatória".
- Os dois formatos usam a MESMA base de respostas: uma questão respondida num formato conta no outro e em todos os concursos onde ela aparece.

## 6. Tela da questão
- Topo fixo: botão Sair, posição ("3 de 20"), acertos da sessão.
- Etiqueta: Concurso/Banca · Ano (se for de prova anterior) · Disciplina · Assunto · Dificuldade. Enunciado com as quebras de linha preservadas (textos de Português, listas I, II, III).
- Alternativas conforme o formato do concurso: A a E, ou Certo/Errado. **Ao tocar numa alternativa, corrigir na hora**:
  - "✓ Resposta certa!" (verde) ou "✗ Resposta errada. Você marcou B; o gabarito é D." (vermelho);
  - colorir a correta em verde e a marcada errada em vermelho;
  - exibir o **Comentário** (explicação) e a **Fundamentação** (artigo de lei, item do edital ou conceito) e rolar a tela até eles.
- Depois de respondida, a alternativa trava (não pode trocar).
- Botões Anterior / Próxima / Concluir. Ao concluir: placar e tabela por disciplina (Resolvidas, Certas, Erradas, %).
- Opção secundária "Simulado": gabarito só no final, com cronômetro regressivo (padrão de 50 min por bloco de 20, configurável). Simulado de prova completa usa a duração e a distribuição oficial do concurso.
- Botão "Anotar" para o usuário guardar uma nota pessoal na questão.

## 7. Cronômetro de estudos
- Botão ⏱ fixo em todas as telas: cronômetro livre ou Pomodoro (25/5 configurável), sempre vinculado a um concurso e a uma disciplina.
- Continua contando ao trocar de tela. Ao parar, salva a sessão (data, início, duração, disciplina).
- O tempo gasto resolvendo questões entra automaticamente no histórico da disciplina.
- Histórico com o total de horas por dia, semana, disciplina e concurso.

## 8. Calendário
- Visão mensal e semanal.
- Eventos de três tipos, com cores e ícones diferentes:
  1. **Datas do concurso** (inscrições, isenção, locais de prova, prova, resultados), preenchidas automaticamente a partir da ficha do concurso;
  2. **Sessões de estudo planejadas** pelo usuário (disciplina, horário, duração), com a opção de marcar como cumprida;
  3. **Revisões** sugeridas automaticamente para os assuntos com acerto abaixo da meta (ex.: revisar em 1, 7 e 30 dias).
- Tela "Hoje": o que está planejado para o dia, as horas já estudadas e o bloco de questões do dia.

## 9. Rendimento (sempre visível)
Tabela "Seu rendimento por disciplina" na tela inicial dos dois formatos, filtrada pelo concurso ativo:

| Disciplina | Resolvidas | Certas | Erradas | % |
|---|---|---|---|---|
| … | | | | |
| **Total** | | | | |

## 10. Painel de desempenho
- Cartões-resumo: Resolvidas (de N do banco e %), Acerto geral, Últimos 7 dias (com variação em pontos percentuais em relação aos 7 dias anteriores) e Horas estudadas na semana.
- Rendimento por disciplina (tabela da seção 9).
- Gráfico de colunas "Questões por dia (últimos 14 dias)": certas e erradas, com legenda e dica ao passar o dedo/mouse.
- Gráfico "Horas estudadas por dia (últimos 14 dias)", a partir do cronômetro.
- Barras horizontais de acerto por disciplina, por bloco e por dificuldade, ordenadas da pior para a melhor, com uma linha vertical na **meta do concurso** (padrão 75%) e a marcação "▼ abaixo da meta".
- **Estimativa de nota**: aplicar os pesos oficiais da prova ao acerto atual por bloco e mostrar a nota estimada, indicando se o usuário passaria nos critérios mínimos de aprovação.
- "Assuntos para revisar": até 12 assuntos com acerto abaixo da meta (mínimo de 2 questões). Tocar abre o modo avulso filtrado nas questões erradas daquele assunto.
- Botão "Zerar respostas" (do concurso ativo ou de todos), com confirmação.

### Ícone 📊 flutuante (canto superior direito, em todas as telas)
Abre um menu suspenso interativo com duas abas:
1. **Comparar períodos**: dois seletores (A e B) entre Todo o período, Hoje, Ontem, Últimos 7 dias, 7 dias anteriores e Últimos 30 dias. Tabela por disciplina com o % de A, o % de B (com certas/resolvidas abaixo) e a diferença (▲ +x p.p. / ▼ −x p.p. / =). Padrão: últimos 7 dias × 7 dias anteriores.
2. **Por disciplina**: Certas, Erradas, % e "x resolvidas de y do banco". Tocar numa disciplina mostra o detalhamento **por assunto**, com minibarra.
- Fecha ao tocar fora, com Esc ou no botão Fechar. Tem o link "Painel completo".

## 11. Mapas mentais
- Tela "🧠 Mapas mentais" do concurso ativo, com cartões agrupados por bloco do edital. Cada cartão mostra o acerto atual na disciplina ou "questões nas próximas semanas".
- Mapa em árvore vertical recolhível: a raiz é o nome da matéria; os ramos principais têm cor própria; cada nó tem título + nota curta (o que cai em prova: artigos, fórmulas, classificações, mnemônicos). Botões Expandir tudo / Recolher.
- Nós cujo assunto existe no banco exibem "✎ praticar", que abre as questões daquele assunto.
- Um mapa de disciplina comum é reaproveitado em vários concursos.

## 12. Importação de provas anteriores (administrador)
- Tela "Importar prova": enviar o PDF da prova e, se houver, o PDF do gabarito (definitivo, de preferência), informando o concurso, a banca, o ano, o cargo e o tipo de prova.
- A plataforma extrai cada questão (número, enunciado, textos de apoio, alternativas) e cruza com o gabarito. Questões **anuladas** ficam marcadas e não entram nas estatísticas.
- Classificação automática por disciplina e assunto (sugestão), com o item do edital quando for possível identificá-lo.
- **Tela de revisão obrigatória** antes de publicar: ver lado a lado o trecho original do PDF e a questão extraída; corrigir texto, alternativas, gabarito e classificação; aprovar uma a uma ou em lote.
- A partir das questões importadas, a plataforma pode **gerar questões inéditas semelhantes** (mesmo assunto e estilo da banca), que passam pelas regras da seção 13 antes de publicar.
- Detectar duplicatas pelo `uid` (hash do enunciado normalizado) para não importar a mesma questão duas vezes.
- Também aceitar a importação direta de arquivos JSON no formato abaixo.

### Formato dos dados das questões (JSON por dia ou por prova importada)
```json
{
  "versao_esquema": "2.0",
  "concurso_id": "pcac-2026",
  "semana": 1, "dia": 1, "data": "2026-11-09",
  "provas": [{
    "id": "PCAC-S01-D1-P1", "titulo": "Prova 1 – Manhã", "turno": "Manhã",
    "distribuicao_gabarito": {"A":4,"B":4,"C":4,"D":4,"E":4},
    "questoes": [{
      "id": "PCAC-S01-D1-P1-Q01", "uid": "hash-do-enunciado", "numero": 1,
      "origem": "inédita | prova_anterior",
      "banca": "IDECAN", "ano": null, "orgao_prova_original": null,
      "formato": "A-E | CE",
      "bloco": "Conhecimentos Básicos | Conhecimentos Jurídicos | Conhecimentos Específicos",
      "materia": "Língua Portuguesa", "assunto": "Compreensão textual",
      "item_edital": "1", "dificuldade": "fácil | média | difícil",
      "enunciado": "…", "alternativas": {"A":"…","B":"…","C":"…","D":"…","E":"…"},
      "gabarito": "C", "anulada": false,
      "comentario": "…", "fonte": "CF, art. 5º, XI",
      "concursos": ["pcac-2026"]
    }]
  }]
}
```
- Para provas anteriores, `semana`, `dia` e `distribuicao_gabarito` podem ficar em branco. Usar `ano`, `banca` e `orgao_prova_original`.
- Respostas do usuário: `{ uid: [letra_marcada, acertou(0/1), timestamp, segundos_gastos] }`.
- Sessões do cronômetro: `{ id, concurso_id, materia, inicio, duracao_seg, tipo: "livre|pomodoro|questoes" }`.
- Eventos do calendário: `{ id, tipo: "concurso|estudo|revisao", titulo, data, hora, duracao_min, materia, cumprido }`.

## 13. Regras de qualidade do conteúdo (obrigatórias)
- **Questões inéditas** no estilo da banca do concurso: para A–E, 5 alternativas, uma única correta, distratores plausíveis (erros típicos) e casos práticos ligados ao cargo. Para C/E, itens com uma única leitura possível.
- Cada questão tem um comentário explicando por que a correta está certa e por que as outras erram, e a fundamentação (artigo/inciso, item do edital ou conceito).
- **Questões de prova anterior** mantêm o texto e o gabarito oficiais. O comentário e a fundamentação são acrescentados. Se a lei mudou depois da prova, marcar "⚠ desatualizada" e explicar o que mudou.
- Questões de cálculo (Contabilidade, Estatística, Lógica, Matemática) têm o gabarito **calculado por programa**, nunca digitado à mão.
- Gabarito equilibrado nas inéditas: 4 de cada letra por bloco de 20.
- Toda questão e todo mapa passam por **revisão independente** (alguém que resolve sem ver o gabarito). Corrigir ambiguidades, conteúdo desatualizado e redação antes de publicar.
- A composição de cada bloco de 20 segue o peso da prova do concurso ativo, e os assuntos seguem o cronograma semanal de estudos.
- Legislação: usar só o texto vigente e citar a lei alteradora quando houver (ex.: Lei 14.230/2021 na improbidade; Lei 14.534/2023 – CPF como número único de identidade).

## 14. Concurso pré-cadastrado: Polícia Civil do Acre (PC/AC)
- **Edital nº 001 SEAD/PCAC/2026**, banca **IDECAN**, formato A–E, meta de 75%.
- **Oficial Investigador de Polícia**: 74 vagas por **município** (67 AC + 7 PcD), R$ 6.342,07, nível superior em qualquer área + CNH AB. Prova das 7h às 12h (portões das 6h às 7h).
- **Papiloscopista Policial**: 35 vagas por **regional** (Baixo Acre 14, Juruá 6, Alto Acre 5, Envira 5, Purus 5), mesmo salário e requisitos. Prova das 13h às 18h (portões das 12h às 13h).
- Objetiva: 100 questões, 160 pontos. Básicos 24 (peso 1), Jurídicos 16 (peso 1), Específicos 60 (peso 2). Aprovação: ≥ 50% dos pontos, ≥ 1 ponto em cada disciplina de Básicos e Jurídicos e ≥ 2 pontos nos Específicos. Discursiva: 40 pontos, mínimo de 20.
- Composição do bloco de 20 nas provas diárias: ~12 Específicos (60%), ~5 Básicos e ~3 Jurídicos.
- Datas (vão para o calendário automaticamente): inscrições de 11/11 a 14/12/2026; isenção de 11 a 12/11; locais de prova em 15/01/2027; **prova em 24/01/2027**; resultado definitivo da objetiva em 24/02/2027; discursiva preliminar em 10/03 e definitiva em 22/03/2027.
- Provas diárias começando em 09/11/2026.
- Mapas mentais (20), agrupados em: Conhecimentos Básicos; Conhecimentos Jurídicos; Específicos – Oficial Investigador; Específicos – Papiloscopista.
  - Português, Raciocínio Lógico, Informática, Realidade do Acre, Constitucional, Administrativo, Penal e Processual Penal, Legislação Institucional (LC 129/2004, LC 496/2025, Lei 14.735/2023, Lei 2.250/2009, LC 39/1993), Contabilidade e Análise Financeira, Estatística, Arquivologia, TI e Segurança da Informação, Análise de Dados, Noções de Administração;
  - para Papiloscopista: Biologia, Física, Química, Noções de Identificação e Papiloscopia, Medicina e Odontologia Legal, Ciências Forenses.
- Ao escolher a PC/AC, o usuário indica o cargo (Oficial Investigador, Papiloscopista ou ambos), e os Específicos exibidos seguem essa escolha.

## 15. Requisitos técnicos
- Página leve, carregamento rápido no celular, sem dependências pesadas.
- Acessível: textos com contraste adequado, alvos de toque grandes, informação nunca transmitida só por cor (usar ✓/✗ e texto).
- Novos concursos, novas semanas de questões, provas importadas e novos mapas são acrescentados **sem mudar o link e sem apagar o histórico** do usuário.
- Exportar e importar o histórico pessoal (JSON) como cópia de segurança.

## 16. Ordem de entrega
1. **Versão 1**: login, concursos (com a PC/AC pré-cadastrada), formato de estudo, tela da questão, rendimento, painel, ícone 📊 e mapas mentais.
2. **Versão 2**: cronômetro e calendário.
3. **Versão 3**: importação de provas anteriores com a tela de revisão, geração de questões semelhantes e cadastro de novos concursos pelo administrador.
Em cada versão, explicar o que foi feito, como testar e como publicar a atualização mantendo o mesmo link.
