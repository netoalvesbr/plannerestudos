"""Gera o JSON do Dia 1 (Semana 1) da PC/AC – Prova 1 (Manhã) – Papiloscopista.

Mesmas regras do gerador de Oficial Investigador:
- gabarito das questões de cálculo CALCULADO aqui;
- alternativa correta posicionada na letra-alvo (4 de cada letra);
- uid = hash do enunciado normalizado.
"""
import hashlib, json, math, sys, unicodedata

LETRAS = "ABCDE"


def uid_de(texto):
    t = unicodedata.normalize("NFKD", texto.lower())
    t = "".join(ch for ch in t if ch.isalnum())
    return hashlib.sha1(t.encode()).hexdigest()[:16]


def br(x, casas=None):
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
    Q.append(dict(materia=materia, assunto=assunto, bloco=bloco, item_edital=item, dificuldade=dif,
                  enunciado=enunciado, alternativas=monta(alvo, correta, distratores), gabarito=alvo,
                  comentario=comentario, fonte=fonte))


BAS, JUR, ESP = "Conhecimentos Básicos", "Conhecimentos Jurídicos", "Conhecimentos Específicos"

# ---------------- Conhecimentos Básicos (5) ----------------
q("Língua Portuguesa", "Pontuação", BAS, "1", "fácil",
  "Assinale a alternativa em que o emprego da vírgula está de acordo com a norma-padrão.",
  "B", "Após a coleta, as amostras foram enviadas ao laboratório.",
  ["Os papiloscopistas da delegacia, coletaram as impressões digitais.",
   "O perito, entregou o laudo ao delegado no fim da tarde.",
   "Precisamos de, luvas, máscaras e pinças para a coleta.",
   "O suspeito afirmou que, não estava no local do crime."],
  "Correta a B: a vírgula isola o adjunto adverbial deslocado para o início da oração (\"Após a coleta\"). "
  "Nas demais há erro: não se separa o sujeito do verbo (A e C), não se separa a preposição do seu complemento (D) "
  "e não se separa o verbo da oração que funciona como seu objeto (E).",
  "Norma-padrão – emprego da vírgula (adjunto adverbial deslocado; vedação entre sujeito e verbo)")

q("Língua Portuguesa", "Regência verbal", BAS, "1", "média",
  "De acordo com a norma-padrão, a regência verbal está correta em:",
  "C", "Os peritos obedeceram ao protocolo de coleta de vestígios.",
  ["O investigador assistiu o depoimento do suspeito pela câmera.",
   "Os agentes preferem mais trabalhar à noite do que de dia.",
   "Esqueci do nome da testemunha durante a audiência.",
   "O escrivão namora com uma colega da delegacia."],
  "\"Obedecer\" é transitivo indireto (obedecer a algo): correta a C. \"Assistir\", no sentido de ver, exige a "
  "preposição \"a\" (assistiu ao depoimento); \"preferir\" rejeita \"mais\" e \"do que\" (preferem trabalhar à noite a "
  "trabalhar de dia); \"esquecer\" sem pronome é transitivo direto (esqueci o nome) – com pronome, \"esqueci-me do "
  "nome\"; \"namorar\" é transitivo direto na norma-padrão (namora uma colega).",
  "Norma-padrão – regência dos verbos obedecer, assistir, preferir, esquecer e namorar")

total, pct_ident, pct_desc = 80, 25, 20
restantes = total * (100 - pct_ident) // 100
descartados = restantes * pct_desc // 100
sobra = restantes - descartados
assert total * (100 - pct_ident) % 100 == 0 and restantes * pct_desc % 100 == 0
q("Raciocínio Lógico", "Porcentagem", BAS, "2", "fácil",
  f"Um laboratório recebeu {total} fragmentos de impressões papilares. {pct_ident}% deles foram identificados no "
  f"primeiro dia. Dos fragmentos não identificados, {pct_desc}% foram descartados por falta de qualidade. "
  "Quantos fragmentos permaneceram sem identificação e aptos para nova análise?",
  "D", br(sobra),
  [br(total - total * pct_ident // 100 - total * pct_desc // 100), br(restantes), br(descartados),
   br(total * pct_ident // 100)],
  f"Identificados: {pct_ident}% de {total} = {total * pct_ident // 100}; restam {restantes}. Descartados: {pct_desc}% de "
  f"{restantes} = {descartados}. Aptos: {restantes} − {descartados} = {sobra}. O erro comum é aplicar os {pct_desc}% "
  f"sobre o total ({total}), obtendo {total - total * pct_ident // 100 - total * pct_desc // 100}.",
  "Porcentagens sucessivas: a segunda porcentagem incide sobre o que restou")

q("Raciocínio Lógico", "Argumentação lógica", BAS, "2", "média",
  "Considere verdadeiras as afirmações:\n"
  "I. Todos os papiloscopistas nomeados possuem nível superior.\n"
  "II. Algum candidato aprovado não possui nível superior.\n"
  "Com base nelas, é necessariamente verdadeiro que:",
  "E", "algum candidato aprovado não é papiloscopista nomeado.",
  ["nenhum papiloscopista nomeado é candidato aprovado.",
   "todo candidato aprovado é papiloscopista nomeado.",
   "algum papiloscopista nomeado não possui nível superior.",
   "nenhum candidato aprovado possui nível superior."],
  "Se todo papiloscopista nomeado tem nível superior, quem não tem nível superior não pode ser papiloscopista "
  "nomeado. Como há candidato aprovado sem nível superior, esse candidato não é papiloscopista nomeado (E). "
  "As demais falham: A e D não decorrem das premissas; B e C são incompatíveis com elas (B obrigaria o aprovado sem "
  "nível superior a ser papiloscopista nomeado, contrariando I; C contraria I diretamente).",
  "Silogismo categórico – diagramas de conjuntos (Todo A é B; Algum C não é B ⇒ Algum C não é A)")

q("Informática", "Atalhos do Windows", BAS, "3", "fácil",
  "No Windows 10 e no Windows 11, ao pressionar a combinação de teclas Windows + L, o usuário:",
  "A", "bloqueia a sessão do computador, exigindo nova autenticação para voltar.",
  ["abre o Explorador de Arquivos.", "minimiza todas as janelas e exibe a área de trabalho.",
   "abre as Configurações do sistema.", "captura a tela e salva a imagem na pasta Capturas de Tela."],
  "Windows + L bloqueia a sessão (L de \"lock\") – boa prática de segurança ao se afastar do computador. "
  "Windows + E abre o Explorador; Windows + D mostra a área de trabalho; Windows + I abre as Configurações; "
  "Windows + PrtScn salva a captura de tela.",
  "Atalhos de teclado do Windows (Microsoft)")

# ---------------- Conhecimentos Jurídicos (3) ----------------
q("Direito Constitucional", "Identificação criminal", JUR, "1", "média",
  "Sobre a identificação criminal, a Constituição Federal estabelece que:",
  "A", "o civilmente identificado não será submetido a identificação criminal, salvo nas hipóteses previstas em lei.",
  ["todo preso em flagrante será submetido a identificação criminal, mesmo que civilmente identificado.",
   "o civilmente identificado nunca será submetido a identificação criminal, sem exceção.",
   "a identificação criminal do civilmente identificado depende apenas de decisão do delegado, sem previsão legal.",
   "a identificação criminal só é possível com o consentimento expresso do investigado."],
  "Art. 5º, LVIII, da CF: \"o civilmente identificado não será submetido a identificação criminal, salvo nas "
  "hipóteses previstas em lei\". As hipóteses estão no art. 3º da Lei 12.037/2009 (ex.: documento rasurado, "
  "documentos conflitantes, identificação essencial às investigações por decisão judicial). A regra não é "
  "absoluta (C errada) nem automática (B errada); depende de lei, não do delegado (D) nem de consentimento (E).",
  "CF, art. 5º, LVIII; Lei 12.037/2009, art. 3º")

q("Direito Administrativo", "Princípios da Administração Pública", JUR, "1", "fácil",
  "O princípio que impõe à Administração atuar sem favorecimentos ou perseguições, tendo sempre como finalidade "
  "o interesse público, e que veda a promoção pessoal de agentes em publicidade oficial, é o princípio da:",
  "B", "impessoalidade.",
  ["legalidade.", "moralidade.", "publicidade.", "eficiência."],
  "Impessoalidade (art. 37, caput, CF): a atuação deve ser objetiva, voltada ao interesse público, sem privilégios "
  "nem perseguições; o § 1º do art. 37 proíbe nomes, símbolos ou imagens que caracterizem promoção pessoal na "
  "publicidade oficial. Legalidade = agir conforme a lei; moralidade = ética e probidade; publicidade = "
  "transparência; eficiência = resultados com qualidade e economicidade.",
  "CF, art. 37, caput e § 1º")

q("Direito Penal e Processual Penal", "Exame de corpo de delito", JUR, "3", "média",
  "De acordo com o Código de Processo Penal, quando a infração deixar vestígios:",
  "C", "será indispensável o exame de corpo de delito, direto ou indireto, não podendo supri-lo a confissão do acusado.",
  ["a confissão do acusado dispensa o exame de corpo de delito.",
   "o exame de corpo de delito é facultativo, a critério da autoridade policial.",
   "o exame só pode ser direto; o indireto não é admitido em nenhuma hipótese.",
   "a prova testemunhal nunca poderá suprir a falta do exame, mesmo que os vestígios tenham desaparecido."],
  "Art. 158 do CPP: o exame é indispensável e a confissão não o supre. O exame pode ser direto ou indireto. "
  "Se os vestígios tiverem desaparecido, a prova testemunhal pode suprir-lhe a falta (art. 167), por isso a E está errada.",
  "CPP, arts. 158 e 167")

# ---------------- Conhecimentos Específicos – Papiloscopista (12) ----------------
q("Noções de Identificação e Papiloscopia", "Sistema datiloscópico de Vucetich", ESP, "1", "média",
  "No sistema datiloscópico de Vucetich, o datilograma que apresenta um único delta, situado à direita do "
  "observador, com as linhas do núcleo voltadas para a esquerda, é classificado como:",
  "D", "presilha interna.",
  ["arco.", "presilha externa.", "verticilo.", "arco tendendo a presilha (sem delta)."],
  "Vucetich define quatro tipos fundamentais: arco (sem delta), presilha interna (delta à direita do observador e "
  "núcleo voltado para a esquerda), presilha externa (delta à esquerda do observador e núcleo voltado para a "
  "direita) e verticilo (dois deltas). Nos polegares, representam-se por A, I, E e V; nos demais dedos, por 1, 2, 3 e 4.",
  "Sistema datiloscópico de Vucetich – tipos fundamentais")

q("Noções de Identificação e Papiloscopia", "Sistema datiloscópico de Vucetich", ESP, "1", "fácil",
  "No sistema de Vucetich, o tipo fundamental verticilo caracteriza-se por apresentar:",
  "E", "dois deltas, um à direita e outro à esquerda do observador.",
  ["nenhum delta.", "um delta à direita do observador.", "um delta à esquerda do observador.",
   "três ou mais deltas, sempre na região basilar."],
  "Arco: nenhum delta (adelto); presilhas: um delta (interna, à direita; externa, à esquerda do observador); "
  "verticilo: dois deltas, um de cada lado, com núcleo de linhas circulares, espirais ou ovoides.",
  "Sistema datiloscópico de Vucetich – contagem de deltas")

q("Noções de Identificação e Papiloscopia", "Postulados da papiloscopia", ESP, "1", "média",
  "A propriedade segundo a qual os desenhos papilares não mudam de forma ao longo da vida, salvo por lesões que "
  "atinjam a camada dérmica, denomina-se:",
  "B", "imutabilidade.",
  ["perenidade.", "variabilidade.", "classificabilidade.", "praticabilidade."],
  "Os postulados que fundamentam a identificação papiloscópica são: perenidade (os desenhos existem desde a vida "
  "intrauterina até a decomposição cadavérica), imutabilidade (não mudam de forma), variabilidade (são únicos, "
  "diferentes de pessoa para pessoa e de dedo para dedo) e classificabilidade/praticabilidade (podem ser "
  "classificados e coletados de forma simples e barata).",
  "Papiloscopia – postulados (perenidade, imutabilidade, variabilidade, classificabilidade)")

q("Medicina e Odontologia Legal", "Fenômenos cadavéricos", ESP, "2", "média",
  "Segundo a Lei de Nysten, a rigidez cadavérica instala-se inicialmente:",
  "A", "na musculatura da mandíbula e da face, progredindo em sentido crânio-caudal.",
  ["nos membros inferiores, progredindo em direção à cabeça.",
   "nas mãos e nos pés ao mesmo tempo.",
   "no tronco, progredindo para as extremidades.",
   "simultaneamente em todos os músculos do corpo."],
  "A Lei de Nysten descreve a instalação da rigidez em sentido crânio-caudal: começa pela mandíbula e pela face, "
  "segue para a nuca, os membros superiores e o tronco e termina nos membros inferiores. A rigidez desaparece na mesma ordem.",
  "Medicina legal – tanatologia: rigidez cadavérica (Lei de Nysten)")

q("Medicina e Odontologia Legal", "Identificação de vítimas", ESP, "3", "média",
  "De acordo com o Guia de Identificação de Vítimas de Desastres (DVI) da Interpol, são considerados métodos "
  "primários de identificação:",
  "C", "a papiloscopia, a odontologia legal e a análise de DNA.",
  ["as tatuagens, as cicatrizes e as vestimentas.",
   "os documentos pessoais encontrados com a vítima e o reconhecimento por familiares.",
   "a fotografia do rosto e a altura estimada.",
   "as joias, os objetos pessoais e a descrição física."],
  "O Guia DVI da Interpol considera primários a comparação de impressões papilares, a odontologia legal e o perfil "
  "de DNA, pela confiabilidade científica. Tatuagens, cicatrizes, objetos pessoais, vestimentas e características "
  "físicas são métodos secundários, que apenas corroboram a identificação. O reconhecimento visual por familiares "
  "é falho em desastres.",
  "Interpol – Disaster Victim Identification Guide")

q("Ciências Forenses", "Revelação de impressões latentes", ESP, "4", "média",
  "Para revelar impressões papilares latentes em superfícies porosas, como papel, utiliza-se um reagente que reage "
  "com os aminoácidos do suor e produz coloração púrpura (púrpura de Ruhemann). Esse reagente é:",
  "E", "a ninidrina.",
  ["o pó magnético.", "o cianoacrilato.", "o vapor de iodo.", "o negro de fumo."],
  "A ninidrina reage com os aminoácidos presentes no suor e forma a púrpura de Ruhemann; é o método clássico para "
  "papel. O pó magnético e o negro de fumo aderem a superfícies lisas e não porosas; o cianoacrilato polimeriza "
  "sobre os resíduos em superfícies não porosas; o vapor de iodo reage com lipídios e gera revelação temporária.",
  "Papiloscopia forense – métodos químicos de revelação de latentes")

q("Ciências Forenses", "Cadeia de custódia", ESP, "4", "média",
  "Nos termos do Código de Processo Penal, a primeira etapa do rastreamento do vestígio na cadeia de custódia, "
  "que consiste em distinguir um elemento como de potencial interesse para a produção da prova pericial, é o(a):",
  "A", "reconhecimento.",
  ["isolamento.", "fixação.", "coleta.", "acondicionamento."],
  "O art. 158-B do CPP (incluído pela Lei 13.964/2019) lista as etapas: reconhecimento, isolamento, fixação, "
  "coleta, acondicionamento, transporte, recebimento, processamento, armazenamento e descarte. O reconhecimento "
  "(inciso I) é o ato de distinguir o elemento como de potencial interesse pericial.",
  "CPP, arts. 158-A e 158-B (Lei 13.964/2019)")

pct_A = 30
pct_C = (100 - 2 * pct_A) / 2
q("Biologia", "Ácidos nucleicos", ESP, "5", "média",
  f"Em uma molécula de DNA de fita dupla, {pct_A}% das bases nitrogenadas são adenina. A porcentagem de citosina nessa molécula é:",
  "D", f"{br(pct_C)}%",
  [f"{br(pct_A)}%", f"{br(100 - pct_A)}%", f"{br(100 - 2 * pct_A)}%", f"{br(pct_C / 2)}%"],
  f"Pela complementaridade de bases (regra de Chargaff), A = T e C = G. Se A = {pct_A}%, então T = {pct_A}% e A + T = "
  f"{2 * pct_A}%. Restam {100 - 2 * pct_A}% para C + G, logo C = {br(pct_C)}%.",
  "Regra de Chargaff – pareamento A–T e C–G no DNA")

q("Biologia", "Células do sangue", ESP, "5", "fácil",
  "Em amostras de sangue humano coletadas em local de crime, o DNA nuclear utilizado nos exames periciais é "
  "obtido principalmente:",
  "C", "dos leucócitos (glóbulos brancos).",
  ["das hemácias (glóbulos vermelhos).", "das plaquetas.", "do plasma sanguíneo, livre de células.",
   "do soro, após a coagulação."],
  "As hemácias maduras dos mamíferos são anucleadas e as plaquetas são fragmentos celulares sem núcleo; por isso o "
  "DNA nuclear do sangue vem dos leucócitos. Plasma e soro são a parte líquida do sangue.",
  "Biologia celular – composição do sangue; genética forense")

dist_km, tempo_h = 180, 2.5
vm = dist_km / tempo_h
q("Física", "Cinemática", ESP, "6", "fácil",
  f"Uma viatura percorreu {dist_km} km entre duas cidades em 2 horas e 30 minutos. Sua velocidade média nesse percurso foi de:",
  "E", f"{br(vm)} km/h",
  [f"{br(dist_km / 2.3)} km/h", f"{br(dist_km / 2)} km/h", f"{br(dist_km / 3)} km/h", f"{br(vm / 3.6)} km/h"],
  f"2 h 30 min = 2,5 h (e não 2,3 h). Vm = distância ÷ tempo = {dist_km} ÷ 2,5 = {br(vm)} km/h.",
  "Cinemática – velocidade média: Vm = Δs / Δt")

m_kg, v = 0.010, 400
ec = m_kg * v ** 2 / 2
q("Física", "Energia mecânica", ESP, "6", "média",
  f"Um projétil de 10 g é disparado com velocidade de {v} m/s. Sua energia cinética no momento do disparo é de:",
  "B", f"{br(ec)} J",
  [f"{br(m_kg * v)} J", f"{br(m_kg * v ** 2)} J", f"{br(10 * v ** 2 / 2)} J", f"{br(m_kg * v / 2)} J"],
  f"Ec = m·v²/2, com a massa em quilogramas: 10 g = 0,010 kg. Ec = 0,010 × {v}² / 2 = {br(ec)} J. Usar a massa em "
  f"gramas leva a {br(10 * v ** 2 / 2)} J; esquecer a divisão por 2 leva a {br(m_kg * v ** 2)} J.",
  "Dinâmica – energia cinética: Ec = m·v²/2 (SI)")

h = 1e-3
ph = round(-math.log10(h))
q("Química", "pH", ESP, "7", "fácil",
  "Uma solução aquosa a 25 °C apresenta concentração de íons H⁺ igual a 1 × 10⁻³ mol/L. O pH dessa solução e sua "
  "classificação são, respectivamente:",
  "D", f"{ph}; ácida.",
  [f"{ph}; básica.", f"{14 - ph}; básica.", f"{14 - ph}; ácida.", "7; neutra."],
  f"pH = −log[H⁺] = −log(10⁻³) = {ph}. A 25 °C, pH < 7 indica solução ácida; pH > 7, básica. O valor {14 - ph} "
  "corresponde ao pOH dessa solução.",
  "Química – pH = −log[H⁺]; pH + pOH = 14 a 25 °C")

# ---------------- Conferências e saída ----------------
assert len(Q) == 20
dist = {L: sum(1 for x in Q if x["gabarito"] == L) for L in LETRAS}
assert all(v == 4 for v in dist.values()), dist
for x in Q:
    assert len(set(x["alternativas"].values())) == 5, x["enunciado"]
esp = sum(1 for x in Q if x["bloco"] == ESP)
assert esp == 12, esp

pid = "PCAC-S01-D1-P1-PAP"
for i, x in enumerate(Q, 1):
    x.update(id=f"{pid}-Q{i:02d}", uid=uid_de(x["enunciado"]), numero=i, origem="inédita", banca="IDECAN",
             ano=None, orgao_prova_original=None, formato="A-E", anulada=False, concursos=["pcac-2026"], cargos=["pap"])
assert len({x["uid"] for x in Q}) == 20

saida = {
    "versao_esquema": "2.0", "concurso_id": "pcac-2026", "semana": 1, "dia": 1, "data": "2026-11-09",
    "provas": [{"id": pid, "titulo": "Prova 1 – Manhã (Papiloscopista)", "turno": "Manhã", "cargos": ["pap"],
                "distribuicao_gabarito": dist, "questoes": Q}],
}
json.dump(saida, open(sys.argv[1], "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print("ok", dist)
