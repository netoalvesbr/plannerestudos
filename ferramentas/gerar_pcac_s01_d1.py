"""Gera o JSON do Dia 1 (Semana 1) da PC/AC – Prova 1 (Manhã).

Regras aplicadas:
- questões de cálculo têm o gabarito CALCULADO aqui, nunca digitado à mão;
- a alternativa correta é posicionada na letra-alvo, para manter 4 de cada letra;
- uid = hash do enunciado normalizado (detecta duplicatas).
"""
import hashlib, json, sys, unicodedata
from fractions import Fraction
from math import comb
from statistics import mean, median, mode, pvariance

LETRAS = "ABCDE"


def uid_de(texto):
    t = unicodedata.normalize("NFKD", texto.lower())
    t = "".join(ch for ch in t if ch.isalnum())
    return hashlib.sha1(t.encode()).hexdigest()[:16]


def br(x, casas=None):
    """Formata número no padrão brasileiro."""
    if isinstance(x, Fraction):
        return f"{x.numerator}/{x.denominator}"
    if casas is None:
        casas = 0 if float(x).is_integer() else 2
    s = f"{x:,.{casas}f}"
    return s.replace(",", "X").replace(".", ",").replace("X", ".")


def monta(alvo, correta, distratores):
    assert len(distratores) == 4 and correta not in distratores, (correta, distratores)
    alts, d = {}, iter(distratores)
    for L in LETRAS:
        alts[L] = correta if L == alvo else next(d)
    return alts


Q = []


def q(materia, assunto, bloco, item, dif, enunciado, alvo, correta, distratores, comentario, fonte):
    Q.append(dict(materia=materia, assunto=assunto, bloco=bloco, item_edital=item,
                  dificuldade=dif, enunciado=enunciado,
                  alternativas=monta(alvo, correta, distratores), gabarito=alvo,
                  comentario=comentario, fonte=fonte))


BAS, JUR, ESP = "Conhecimentos Básicos", "Conhecimentos Jurídicos", "Conhecimentos Específicos"

# ---------------- Conhecimentos Básicos (5) ----------------
q("Língua Portuguesa", "Crase", BAS, "1", "fácil",
  "Assinale a alternativa em que o acento grave indicativo de crase está empregado corretamente.",
  "B", "A equipe chegou à delegacia às 7h para iniciar o plantão.",
  ["O investigador referiu-se à pessoas que estavam no local.",
   "O depoimento começou à partir das 8h.",
   "O escrivão entregou o termo à ele ainda pela manhã.",
   "O policial ficou frente à frente com o suspeito."],
  "Correta a B: \"chegar a\" + \"a delegacia\" = à; \"às 7h\" indica hora determinada, locução feminina. "
  "Nas demais: não há crase diante de palavra no plural quando o \"a\" está no singular (à pessoas), "
  "diante de verbo (a partir), diante de pronome pessoal (a ele) e entre palavras repetidas (frente a frente).",
  "Regras de emprego do acento grave (crase) – norma-padrão")

q("Língua Portuguesa", "Concordância verbal", BAS, "1", "média",
  "Considerando a norma-padrão da língua portuguesa, assinale a alternativa em que a concordância verbal está correta.",
  "E", "Devem existir outras evidências no local do crime.",
  ["Fazem três anos que o crime ocorreu.",
   "Houveram muitas denúncias anônimas sobre o caso.",
   "Existe várias provas juntadas ao inquérito.",
   "Haviam testemunhas no local quando a viatura chegou."],
  "Correta a E: \"existir\" é verbo pessoal e concorda com o sujeito \"outras evidências\"; na locução, "
  "o auxiliar \"devem\" vai para o plural. Erros: \"fazer\" indicando tempo é impessoal (Faz três anos); "
  "\"haver\" no sentido de existir é impessoal (Houve muitas denúncias; Havia testemunhas); "
  "\"existir\" deveria concordar com \"várias provas\" (Existem).",
  "Concordância verbal – verbos impessoais (haver, fazer) e verbo existir")

q("Raciocínio Lógico", "Negação de proposições", BAS, "2", "média",
  "Considere a proposição: \"Se o suspeito fugiu, então a viatura chegou atrasada.\"\n"
  "A negação lógica dessa proposição é:",
  "C", "O suspeito fugiu e a viatura não chegou atrasada.",
  ["Se o suspeito não fugiu, então a viatura não chegou atrasada.",
   "O suspeito não fugiu e a viatura chegou atrasada.",
   "O suspeito não fugiu ou a viatura chegou atrasada.",
   "Se a viatura não chegou atrasada, então o suspeito não fugiu."],
  "A negação de \"Se p, então q\" é \"p e não q\" (C). A alternativa D (¬p ∨ q) e a E (contrapositiva ¬q → ¬p) "
  "são EQUIVALENTES à proposição original, e não sua negação. A A é a inversa, que não é equivalente nem negação.",
  "¬(p → q) ≡ p ∧ ¬q")

inv, pap = 5, 3
equipes = comb(pap, 1) * comb(inv, 2)
q("Raciocínio Lógico", "Análise combinatória", BAS, "2", "média",
  f"Uma equipe de 3 policiais será formada a partir de um grupo com {inv} oficiais investigadores e {pap} papiloscopistas. "
  "A equipe deve ter exatamente 1 papiloscopista. O número de equipes distintas que podem ser formadas é:",
  "D", br(equipes),
  [br(comb(inv + pap, 3)), br(comb(inv, 2)), br(pap * inv * (inv - 1)), br(comb(inv, 3) + comb(pap, 1))],
  f"Escolhe-se 1 papiloscopista entre {pap}: C({pap},1) = {comb(pap,1)}; e 2 investigadores entre {inv}: "
  f"C({inv},2) = {comb(inv,2)}. Pelo princípio multiplicativo: {comb(pap,1)} × {comb(inv,2)} = {equipes}. "
  f"Usar arranjo ({pap * inv * (inv - 1)}) conta a ordem, que não importa numa equipe; C(8,3) = {comb(8,3)} ignora a restrição.",
  "Combinação simples: C(n,p) = n! / [p!(n−p)!]; princípio multiplicativo")

a1, a2, a3 = 10, 20, 30
res = mean([a1, a2, a3]) * 2
q("Informática", "Planilhas eletrônicas", BAS, "3", "fácil",
  f"Em uma planilha do Microsoft Excel (versão em português), as células A1, A2 e A3 contêm, respectivamente, "
  f"os valores {a1}, {a2} e {a3}. Ao digitar na célula B1 a fórmula =MÉDIA(A1:A3)*2, o resultado exibido será:",
  "A", br(res),
  [br(mean([a1, a2, a3])), br(sum([a1, a2, a3])), br(sum([a1, a2, a3]) * 2), br(a1 + a3 * 2 / 3)],
  f"MÉDIA(A1:A3) = ({a1} + {a2} + {a3}) / 3 = {br(mean([a1,a2,a3]))}. Multiplicado por 2: {br(res)}. "
  f"{br(sum([a1,a2,a3]))} seria o resultado de SOMA(A1:A3) e {br(sum([a1,a2,a3])*2)} o de SOMA(A1:A3)*2.",
  "Excel – funções MÉDIA e SOMA; intervalo A1:A3")

# ---------------- Conhecimentos Jurídicos (3) ----------------
q("Direito Constitucional", "Inviolabilidade do domicílio", JUR, "1", "média",
  "Durante a madrugada, policiais civis percebem, pela janela de uma residência, que um homem mantém uma pessoa "
  "amarrada e sob ameaça de faca. O morador não autoriza a entrada. À luz da Constituição Federal, os policiais:",
  "B", "podem ingressar imediatamente na casa, pois há flagrante delito, hipótese que autoriza a entrada a qualquer hora.",
  ["só podem ingressar com determinação judicial, que, no caso, pode ser cumprida a qualquer hora.",
   "devem aguardar o amanhecer, pois o ingresso noturno é vedado em qualquer hipótese.",
   "podem ingressar somente com autorização escrita do delegado de polícia.",
   "podem ingressar apenas se houver mandado de prisão contra o morador, ainda que à noite."],
  "Art. 5º, XI, da CF: a casa é asilo inviolável, salvo em caso de flagrante delito ou desastre, para prestar socorro, "
  "ou, durante o dia, por determinação judicial. Flagrante, desastre e socorro autorizam o ingresso a qualquer hora, "
  "mesmo sem consentimento. A ordem judicial só pode ser cumprida durante o dia; o delegado não expede ordem de ingresso.",
  "CF, art. 5º, XI")

q("Direito Administrativo", "Atributos do ato administrativo", JUR, "2", "fácil",
  "O atributo do ato administrativo que permite à Administração Pública executar diretamente suas decisões, "
  "sem necessidade de prévia autorização do Poder Judiciário, denomina-se:",
  "C", "autoexecutoriedade.",
  ["presunção de legitimidade.", "imperatividade.", "tipicidade.", "motivação."],
  "Autoexecutoriedade é a possibilidade de a Administração pôr em execução suas decisões por meios próprios "
  "(ex.: apreensão de mercadoria imprópria, interdição de estabelecimento). Imperatividade é impor obrigações "
  "a terceiros independentemente de concordância; presunção de legitimidade é a presunção de que o ato é "
  "conforme a lei; tipicidade é a correspondência a figuras previstas em lei; motivação não é atributo, e sim "
  "exposição dos motivos (elemento formal).",
  "Doutrina – atributos do ato administrativo (presunção de legitimidade, imperatividade, autoexecutoriedade, tipicidade)")

q("Direito Penal e Processual Penal", "Inquérito policial", JUR, "3", "média",
  "Sobre o inquérito policial, de acordo com o Código de Processo Penal e a jurisprudência do STF, é correto afirmar que:",
  "D", "a autoridade policial não poderá mandar arquivar autos de inquérito.",
  ["o inquérito é indispensável ao oferecimento da denúncia pelo Ministério Público.",
   "a autoridade policial pode arquivar o inquérito quando não houver indícios de autoria.",
   "o inquérito é procedimento contraditório, sendo obrigatória a ampla defesa do investigado.",
   "o defensor não tem acesso aos elementos de prova já documentados, em razão do sigilo."],
  "Art. 17 do CPP: a autoridade policial não poderá mandar arquivar autos de inquérito. O inquérito é dispensável "
  "quando o titular da ação já dispõe de elementos (art. 39, § 5º, e art. 46, § 1º, do CPP), é inquisitivo (sem "
  "contraditório obrigatório) e a Súmula Vinculante 14 garante ao defensor acesso aos elementos já documentados.",
  "CPP, art. 17; Súmula Vinculante 14 do STF")

# ---------------- Conhecimentos Específicos – Oficial Investigador (12) ----------------
ativo, passivo = 500_000, 320_000
pl = ativo - passivo
q("Contabilidade e Análise Financeira", "Equação patrimonial", ESP, "1", "fácil",
  f"Uma empresa investigada apresenta, em seu balanço, ativo total de R$ {br(ativo)} e passivo exigível de "
  f"R$ {br(passivo)}. O valor do seu patrimônio líquido é de:",
  "E", f"R$ {br(pl)}.",
  [f"R$ {br(ativo + passivo)}.", f"R$ {br(passivo)}.", f"R$ {br(ativo)}.", f"R$ {br(pl / 2)}."],
  f"Equação fundamental: Ativo = Passivo + Patrimônio Líquido, logo PL = A − P = {br(ativo)} − {br(passivo)} = {br(pl)}.",
  "Equação patrimonial: A = P + PL")

q("Contabilidade e Análise Financeira", "Classificação de contas", ESP, "1", "fácil",
  "Entre as contas abaixo, aquela que integra o passivo de uma empresa é:",
  "C", "Fornecedores.",
  ["Caixa.", "Estoques.", "Veículos.", "Duplicatas a receber."],
  "Fornecedores representa obrigação a pagar, logo é conta do passivo (circulante). Caixa, estoques e duplicatas "
  "a receber são do ativo circulante; veículos, do ativo não circulante (imobilizado).",
  "Lei 6.404/1976, arts. 178 a 180 – grupos do balanço patrimonial")

ac, pc = 240_000, 160_000
lc = ac / pc
q("Contabilidade e Análise Financeira", "Índices de liquidez", ESP, "2", "média",
  f"Na análise das demonstrações de uma empresa suspeita de fraude, verificou-se ativo circulante de R$ {br(ac)} "
  f"e passivo circulante de R$ {br(pc)}. O índice de liquidez corrente da empresa é:",
  "A", br(lc),
  [br(pc / ac), br((ac + pc) / pc), br((ac - pc) / ac), br(lc * 2)],
  f"Liquidez corrente = Ativo circulante ÷ Passivo circulante = {br(ac)} ÷ {br(pc)} = {br(lc)}. "
  f"Significa que a empresa tem R$ {br(lc)} de bens e direitos de curto prazo para cada R$ 1,00 de dívida de curto prazo.",
  "Análise de balanços – índice de liquidez corrente (AC/PC)")

dados = [2, 4, 4, 5, 7, 8, 12]
me, md, mo = mean(dados), median(dados), mode(dados)
q("Estatística", "Medidas de tendência central", ESP, "1", "fácil",
  f"O número de ocorrências registradas por dia em uma delegacia, durante uma semana, foi: {', '.join(map(str, dados))}. "
  "A média, a mediana e a moda desses dados são, respectivamente:",
  "B", f"{br(me)}, {br(md)} e {br(mo)}.",
  [f"{br(md)}, {br(me)} e {br(mo)}.", f"{br(me)}, {br(mo)} e {br(md)}.",
   f"{br(mo)}, {br(md)} e {br(me)}.", f"{br(me)}, {br(dados[3]+dados[4])} e {br(mo)}."],
  f"Média = soma ÷ n = {sum(dados)} ÷ {len(dados)} = {br(me)}. Com os dados em ordem, a mediana é o termo central "
  f"(4º de 7) = {br(md)}. Moda é o valor mais frequente = {br(mo)}.",
  "Estatística descritiva – média aritmética, mediana e moda")

pares, maiores4 = {2, 4, 6}, {5, 6}
p = Fraction(len(pares | maiores4), 6)
q("Estatística", "Probabilidade", ESP, "2", "média",
  "Um dado honesto de seis faces é lançado uma vez. A probabilidade de se obter um número par ou um número maior que 4 é:",
  "E", br(p),
  [br(Fraction(len(pares) + len(maiores4), 6)), br(Fraction(1, 2)), br(Fraction(1, 6)), br(Fraction(1, 3))],
  f"P(A ∪ B) = P(A) + P(B) − P(A ∩ B) = 3/6 + 2/6 − 1/6 = 4/6 = {br(p)}. Os resultados favoráveis são 2, 4, 5 e 6. "
  "Somar sem descontar a interseção (o 6) leva ao erro 5/6.",
  "Probabilidade da união de eventos: P(A∪B) = P(A) + P(B) − P(A∩B)")

xs = [2, 4, 6, 12]
var = pvariance(xs)
q("Estatística", "Medidas de dispersão", ESP, "2", "difícil",
  f"Os tempos de resposta (em minutos) de uma equipe a quatro chamados foram {', '.join(map(str, xs))}. "
  "A variância populacional desses tempos é:",
  "D", br(var),
  [br(var ** 0.5), br(sum(xs) / len(xs)), br(sum((x - mean(xs)) ** 2 for x in xs) / (len(xs) - 1)),
   br(sum((x - mean(xs)) ** 2 for x in xs))],
  f"Média = {br(mean(xs))}. Desvios ao quadrado: " + ", ".join(br((x - mean(xs)) ** 2) for x in xs) +
  f" (soma = {br(sum((x - mean(xs)) ** 2 for x in xs))}). Variância populacional = soma ÷ n = {br(var)}. "
  "Dividir por n − 1 dá a variância amostral; a raiz da variância é o desvio-padrão.",
  "Variância populacional: σ² = Σ(xi − μ)² / N")

q("Arquivologia", "Teoria das três idades", ESP, "1", "fácil",
  "Os documentos que perderam o valor administrativo, mas que, por seu valor histórico, probatório e informativo, "
  "devem ser definitivamente preservados, compõem o arquivo:",
  "A", "permanente.",
  ["corrente.", "intermediário.", "setorial.", "especial."],
  "Pela teoria das três idades: corrente (uso frequente pela administração), intermediário (uso eventual, aguardando "
  "destinação) e permanente (guarda definitiva por valor histórico, probatório e informativo). Arquivo setorial e "
  "especial dizem respeito à localização e ao suporte, não à idade.",
  "Lei 8.159/1991, art. 8º – arquivos correntes, intermediários e permanentes")

q("Arquivologia", "Princípios arquivísticos", ESP, "1", "média",
  "O princípio segundo o qual os documentos devem ser mantidos agrupados conforme a entidade que os produziu, "
  "sem mistura com documentos de outras entidades, é o princípio da:",
  "C", "proveniência.",
  ["pertinência.", "ordem original.", "indivisibilidade.", "cumulatividade."],
  "Proveniência (ou respeito aos fundos): o arquivo de uma entidade deve manter sua individualidade, sem mistura "
  "com documentos de outras origens. Ordem original trata da organização interna do fundo; indivisibilidade, de "
  "não dispersar o fundo; cumulatividade, da formação natural do arquivo. Pertinência (temática) é o critério "
  "oposto, rejeitado pela arquivologia.",
  "Princípios arquivísticos – proveniência, ordem original, organicidade, indivisibilidade, cumulatividade")

q("TI e Segurança da Informação", "Ameaças e golpes", ESP, "4", "fácil",
  "Um servidor recebe um e-mail que imita a identidade visual de um banco e pede que ele clique em um link e "
  "\"confirme\" seus dados de acesso. Esse tipo de golpe é denominado:",
  "E", "phishing.",
  ["ransomware.", "worm.", "keylogger.", "DDoS."],
  "Phishing é a fraude que usa mensagens falsas que imitam instituições confiáveis para induzir a vítima a "
  "fornecer dados. Ransomware sequestra dados e exige resgate; worm se propaga sozinho pela rede; keylogger "
  "captura o que é digitado; DDoS é ataque de negação de serviço distribuído.",
  "Segurança da informação – engenharia social e códigos maliciosos")

q("TI e Segurança da Informação", "Princípios da segurança da informação", ESP, "4", "fácil",
  "O princípio da segurança da informação que garante que a informação não foi alterada de forma indevida, "
  "mantendo-se exata e completa, é a:",
  "B", "integridade.",
  ["confidencialidade.", "disponibilidade.", "autenticidade.", "irretratabilidade."],
  "Integridade: a informação não sofre alteração não autorizada. Confidencialidade: acesso só por autorizados; "
  "disponibilidade: acesso quando necessário; autenticidade: garantia da origem; irretratabilidade (não repúdio): "
  "o autor não pode negar a autoria.",
  "ABNT NBR ISO/IEC 27001 e 27002 – tríade CID (confidencialidade, integridade, disponibilidade)")

q("Análise de Dados", "SQL", ESP, "5", "média",
  "Em uma consulta SQL sobre a tabela de ocorrências, um analista agrupou os registros por bairro e quer exibir "
  "apenas os bairros com mais de 50 ocorrências. A cláusula adequada para filtrar o resultado após o agrupamento é:",
  "A", "HAVING",
  ["WHERE", "ORDER BY", "DISTINCT", "JOIN"],
  "HAVING filtra grupos depois do GROUP BY, podendo usar funções de agregação (HAVING COUNT(*) > 50). "
  "WHERE filtra linhas antes do agrupamento e não aceita agregação; ORDER BY ordena; DISTINCT elimina repetições; "
  "JOIN combina tabelas.",
  "SQL – SELECT … GROUP BY … HAVING")

q("Noções de Administração", "Funções administrativas", ESP, "6", "fácil",
  "A função administrativa que consiste em acompanhar o desempenho, compará-lo com os padrões estabelecidos "
  "e adotar medidas para corrigir desvios é denominada:",
  "D", "controle.",
  ["planejamento.", "organização.", "direção.", "coordenação."],
  "No processo administrativo (PODC), o controle mede e corrige o desempenho em relação aos objetivos. "
  "Planejamento define objetivos e meios; organização distribui recursos e tarefas; direção conduz e "
  "motiva pessoas. Coordenação aparece em Fayol, mas não corresponde à descrição.",
  "Teoria da Administração – processo administrativo (planejar, organizar, dirigir, controlar)")

# ---------------- Conferências e saída ----------------
assert len(Q) == 20
dist = {L: sum(1 for x in Q if x["gabarito"] == L) for L in LETRAS}
assert all(v == 4 for v in dist.values()), dist
for x in Q:
    vals = list(x["alternativas"].values())
    assert len(set(vals)) == 5, x["enunciado"]

pid = "PCAC-S01-D1-P1"
for i, x in enumerate(Q, 1):
    x.update(id=f"{pid}-Q{i:02d}", uid=uid_de(x["enunciado"]), numero=i, origem="inédita",
             banca="IDECAN", ano=None, orgao_prova_original=None, formato="A-E", anulada=False,
             concursos=["pcac-2026"], cargos=["oi"])
assert len({x["uid"] for x in Q}) == 20

saida = {
    "versao_esquema": "2.0", "concurso_id": "pcac-2026", "semana": 1, "dia": 1, "data": "2026-11-09",
    "provas": [{"id": pid, "titulo": "Prova 1 – Manhã", "turno": "Manhã", "cargos": ["oi"],
                "distribuicao_gabarito": dist, "questoes": Q}],
}
json.dump(saida, open(sys.argv[1], "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print("ok", dist)
