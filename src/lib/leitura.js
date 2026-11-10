// Leitura automática (sem IA) de provas, gabaritos e editais a partir do texto extraído do PDF.
// O resultado é sempre uma sugestão: o usuário confere e corrige na tela de revisão antes de salvar.

const MAIUSC = /^[A-ZÀ-ÖØ-Ý0-9ºª\s,;.\-–—/()&]+$/;
const temLetra = (s) => /[A-ZÀ-Ý]/.test(s);

export const BANCAS = [
  'Cebraspe', 'Cespe', 'FGV', 'IDECAN', 'IBFC', 'FCC', 'Vunesp', 'Cesgranrio', 'IDIB', 'Quadrix', 'Consulplan',
  'Instituto AOCP', 'AOCP', 'IADES', 'Fundatec', 'Instituto Consulplan', 'Selecon', 'IBADE', 'Instituto Access',
  'Fafipa', 'Legalle', 'FUNDEP', 'Cetro', 'Esaf', 'Fumarc', 'IESES', 'Ibam', 'Instituto Mais', 'Avança SP',
];

const MESES = { janeiro: 1, fevereiro: 2, março: 3, marco: 3, abril: 4, maio: 5, junho: 6, julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12 };

// ---------------- datas ----------------
export function datasNoTexto(t) {
  const out = [];
  const re1 = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g;
  let m;
  while ((m = re1.exec(t))) out.push({ iso: iso(+m[3], +m[2], +m[1]), pos: m.index });
  const re2 = /\b(\d{1,2})º?\s+de\s+(janeiro|fevereiro|março|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de\s+(\d{4})/gi;
  while ((m = re2.exec(t))) out.push({ iso: iso(+m[3], MESES[m[2].toLowerCase()], +m[1]), pos: m.index });
  return out.filter((d) => d.iso).sort((a, b) => a.pos - b.pos);
}
function iso(a, m, d) {
  if (!(a > 1990 && a < 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return null;
  return `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// ---------------- edital ----------------
export function lerEdital(linhas) {
  const texto = linhas.join('\n');
  const plano = linhas.join(' ');
  const r = { sigla: '', nome: '', orgao: '', banca: '', edital: '', dataProva: '', cronograma: [], disciplinas: [] };

  // banca: a mais citada
  let melhor = 0;
  for (const b of BANCAS) {
    const n = (plano.match(new RegExp(`\\b${b.replace(/\s/g, '\\s')}\\b`, 'gi')) || []).length;
    if (n > melhor) {
      melhor = n;
      r.banca = b === 'Cespe' ? 'Cebraspe' : b;
    }
  }

  // número do edital
  const ed = linhas.find((l) => /EDITAL\s+(N[º°o.]|DE ABERTURA)/i.test(l));
  if (ed) r.edital = ed.replace(/\s+/g, ' ').trim().slice(0, 120);

  // órgão: linha em maiúsculas com palavras típicas; prefere o órgão específico ao "Governo do Estado"
  // (editais publicados no Diário Oficial trazem outros órgãos no começo: vence o órgão mais citado no documento)
  const ESPEC = /(POL[IÍ]CIA|TRIBUNAL|ORDEM DOS ADVOGADOS|MINIST[EÉ]RIO P|DEFENSORIA|PROCURADORIA|C[AÂ]MARA|ASSEMBLEIA|SENADO|CORPO DE BOMBEIROS|DETRAN|RECEITA|BANCO|AG[EÊ]NCIA|CONSELHO|EX[EÉ]RCITO|MARINHA|AERON[AÁ]UTICA|UNIVERSIDADE|INSTITUTO FEDERAL)/;
  const GERAL = /(PREFEITURA|SECRETARIA|MINIST[EÉ]RIO|DEPARTAMENTO|GOVERNO)/;
  const cand = linhas.filter((l) => l.length < 90 && MAIUSC.test(l) && temLetra(l) && (ESPEC.test(l) || GERAL.test(l)) && !/^(EDITAL|CONCURSO|ANEXO)/.test(l.trim()));
  const freq = new Map();
  for (const l of cand) {
    const k = l.replace(/\s+/g, ' ').replace(/\s*[–-]\s*[A-Z]{2}\s*$|\/[A-Z]{2}\s*$/, '').trim();
    freq.set(k, (freq.get(k) || 0) + (ESPEC.test(l) ? 2 : 1));
  }
  const orgao = [...freq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (orgao) {
    r.orgao = titulo(orgao);
    r.nome = r.orgao;
    r.sigla = siglaDe(r.orgao);
  }
  // só é edital da OAB quando o próprio Exame de Ordem aparece no começo e se repete (outros editais citam a OAB como requisito)
  const nExame = (plano.match(/EXAME DE ORDEM/gi) || []).length;
  if (/EXAME DE ORDEM/i.test(linhas.slice(0, 60).join(' ')) && nExame >= 3) {
    const n = plano.match(/(\d{1,3})\s*[ºo°]\s*EXAME DE ORDEM/i);
    r.nome = n ? `${n[1]}º Exame de Ordem Unificado – OAB` : 'Exame de Ordem Unificado – OAB';
    r.sigla = n ? `OAB ${n[1]}` : 'OAB';
  }

  // datas importantes: só eventos do concurso (inscrição, prova, resultado...) e datas próximas de hoje
  const EVENTO = /(publica[çc][ãa]o do edital|inscri[çc]|isen[çc]|prova|gabarito|resultado|recurso|convoca|local|homologa|matr[íi]cula|curso de forma|teste|exame|avalia[çc][ãa]o|per[íi]cia|investiga[çc][ãa]o social|t[íi]tulos|aplica[çc][ãa]o|divulga[çc][ãa]o|entrega|pagamento|boleto)/i;
  const LEGAL = /(provimento|publicad[oa] no di[áa]rio|lei\b|lei n|decreto|resolu[çc][ãa]o|portaria|instru[çc][ãa]o normativa|s[úu]mula|emenda|regido|publicad[oa] no d)/i;
  const anoAtual = new Date().getFullYear();
  const vistos = new Set();
  for (let i = 0; i < linhas.length && r.cronograma.length < 25; i++) {
    const l = linhas[i];
    if (l.length > 220 || LEGAL.test(l) || !EVENTO.test(l)) continue;
    const ds = datasNoTexto(l).filter((d) => +d.iso.slice(0, 4) >= anoAtual - 1 && +d.iso.slice(0, 4) <= anoAtual + 2);
    if (!ds.length) continue;
    let ev = l
      .replace(/\b\d{1,2}\/\d{1,2}\/\d{4}\b/g, '')
      .replace(/\b\d{1,2}º?\s+de\s+\p{L}+\s+de\s+\d{4}/giu, '')
      .replace(/(?:^|\s)(?:das|às|as)\s+\d{1,2}\s*(?:horas?|h)(?:\d{2})?(?:\s+(?:do|de)\s+dia)?/gi, ' ')
      .replace(/\b(do|no|ao)\s+dia\b/gi, '')
      .replace(/\bno per[íi]odo\b/gi, 'de')
      .replace(/[\s.:–—-]+$/, '')
      .replace(/\s+(a|e|até|em|no dia|dia|de|do|da)\s*$/i, '')
      .replace(/^\s*\d+(\.\d+)*\.?\s*/, '')
      .replace(/[\s:–—-]+$/, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
    if (ev.length < 4 || vistos.has(ds[0].iso + ev)) continue;
    vistos.add(ds[0].iso + ev);
    r.cronograma.push({ data: ds[0].iso, fim: ds[1]?.iso || '', evento: ev.slice(0, 140) });
  }
  r.cronograma.sort((a, b) => a.data.localeCompare(b.data));

  // data da prova
  // 1º) linha do cronograma "Realização/Aplicação da(s) prova(s) ... dd/mm/aaaa" (a forma mais confiável)
  // 2º) data mais próxima de expressões típicas, ignorando datas de leis, decretos, cabeçalhos e assinaturas
  const naJanela = (d) => +d.iso.slice(0, 4) >= anoAtual - 1 && +d.iso.slice(0, 4) <= anoAtual + 2;
  const NAO_E_DATA_DE_PROVA = /(divulga|loca(is|l) de|gabarito|padr[ãa]o de resposta|resultado|recurso|convoca|envio|inscri[çc]|isen[çc]|impugna|pagamento|t[íi]tulos|biopsicossocial|per[íi]cia|heteroidentifica)/i;
  const candidatas = [];
  for (let i = 0; i < linhas.length; i++) {
    const l = linhas[i];
    if (!/(realiza[çc][ãa]o|aplica[çc][ãa]o|data)\s+d[ao]s?\s+provas?|provas?\s+(objetiva|escrita|discursiva)s?.*(aplicad|realizad)/i.test(l) || NAO_E_DATA_DE_PROVA.test(l) || LEGAL.test(l)) continue;
    // data na própria linha ou, em tabelas quebradas, numa linha seguinte que só tem datas
    const prox = linhas[i + 1] || '';
    const d = datasNoTexto(/^[\s\d/–-]+$/.test(prox) ? `${l} ${prox}` : l).filter(naJanela);
    if (!d.length) continue;
    const peso = /objetiva|escrita|discursiva|1[ªa] fase|primeira/i.test(l) ? 0 : /pr[áa]tica|f[íi]sic|oral/i.test(l) ? 2 : 1;
    candidatas.push({ iso: d[0].iso, peso, i });
  }
  candidatas.sort((a, b) => a.peso - b.peso || a.iso.localeCompare(b.iso) || a.i - b.i);
  if (candidatas.length) r.dataProva = candidatas[0].iso;
  else {
    const reProva = /(aplica[çc][ãa]o d[ao]s? provas?|data d[ao]s? provas?|provas? objetivas?(?: e discursivas?)?(?: ser[ãa]o)? (?:aplicadas|realizadas)|realiza[çc][ãa]o d[ao]s? provas?|provas? objetivas?)/gi;
    let m;
    // datas válidas: dentro da janela de anos e fora de linhas de leis, cabeçalhos do Diário Oficial e assinaturas
    const ignorar = new Set();
    let pos = 0;
    for (const l of linhas) {
      if (LEGAL.test(l) || /(segunda|ter[çc]a|quarta|quinta|sexta)-feira|s[áa]bado|domingo|^\s*[A-ZÀ-ú][\p{L} ]+[–-]?\s*\p{L}*,\s*\d{1,2}\s+de\s/iu.test(l)) ignorar.add(pos);
      pos += l.length + 1;
    }
    const inicioLinha = [];
    pos = 0;
    for (const l of linhas) {
      inicioLinha.push(pos);
      pos += l.length + 1;
    }
    const linhaDe = (p) => {
      let a = 0;
      let b = inicioLinha.length - 1;
      while (a < b) {
        const c = (a + b + 1) >> 1;
        if (inicioLinha[c] <= p) a = c;
        else b = c - 1;
      }
      return inicioLinha[a];
    };
    const ds = datasNoTexto(texto).filter((d) => naJanela(d) && !ignorar.has(linhaDe(d.pos)));
    let melhorDist = Infinity;
    while ((m = reProva.exec(texto))) {
      for (const d of ds) {
        const dist = d.pos - m.index;
        const custo = dist >= 0 ? dist : 1000 - dist; // prefere a data que vem depois da expressão
        if (dist >= -40 && dist < 400 && custo < melhorDist) {
          melhorDist = custo;
          r.dataProva = d.iso;
        }
      }
    }
  }

  // concursos em fases (ex.: OAB): data de REALIZAÇÃO de cada fase, procurada linha a linha no cronograma.
  // Ignora linhas de divulgação de locais, gabarito, padrão de resposta, resultado e recursos.
  const NAO_E_PROVA = /(divulga|loca(is|l)|gabarito|padr[ãa]o de resposta|resultado|recurso|vista|reaproveitamento|inscri[çc]|isen[çc]|edital complementar|cart[ãa]o)/i;
  const APLICA = /(realiza[çc][ãa]o|aplica[çc][ãa]o|ser[áa] aplicada|ser[áa] realizada|data prov[áa]vel)/i;
  const dataDaFase = (reFase) => {
    // 1º: linha com "realização/aplicação" + fase + data (ou data na linha seguinte, em tabelas quebradas)
    for (let i = 0; i < linhas.length; i++) {
      const l = linhas[i];
      if (!reFase.test(l) || NAO_E_PROVA.test(l)) continue;
      if (!APLICA.test(l) && !/^\s*(prova|[12][ªa] fase)/i.test(l)) continue;
      const CABECALHO = /(segunda|ter[çc]a|quarta|quinta|sexta)-feira|s[áa]bado|domingo|di[áa]rio oficial/i;
      const juntas = [l, linhas[i + 1] || '', linhas[i + 2] || ''].filter((x) => !CABECALHO.test(x) && !LEGAL.test(x)).join(' ');
      const d = datasNoTexto(juntas).filter((x) => +x.iso.slice(0, 4) >= anoAtual - 1);
      if (d.length) return d[0].iso;
    }
    return null;
  };
  const ehDaTabela = (iso) => candidatas.some((c) => c.iso === iso);
  r.datasFases = {
    primeira: dataDaFase(/(1[ªa] fase|primeira fase|provas? objetivas?)/i) || r.dataProva || null,
    segunda: dataDaFase(/(2[ªa] fase|segunda fase|pr[áa]tico[- ]?profissional|provas? discursivas?)/i),
  };
  // a linha "Realização das provas" do cronograma tem prioridade; senão, usa a data da 1ª fase
  if (candidatas.length) r.datasFases.primeira = r.datasFases.primeira && ehDaTabela(r.datasFases.primeira) ? r.datasFases.primeira : r.dataProva;
  else if (r.datasFases.primeira) r.dataProva = r.datasFases.primeira;

  const porCargo = lerCargosEConteudo(linhas);
  r.cargos = porCargo.cargos;
  r.disciplinas = porCargo.disciplinas.length >= 3 ? porCargo.disciplinas : lerConteudoProgramatico(linhas);
  return r;
}

const PALAVRAS_MINUSC = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'a', 'o', 'em', 'para', 'por', 'com']);
export function titulo(s) {
  return s
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .map((p, i) => (i > 0 && PALAVRAS_MINUSC.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(' ');
}
function siglaDe(nome) {
  return nome
    .split(' ')
    .filter((p) => p.length > 2 && !PALAVRAS_MINUSC.has(p.toLowerCase()))
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 8);
}

// Conteúdo programático: "DISCIPLINA: 1 Tópico. 2 Tópico. ..." ou a disciplina numa linha e os tópicos abaixo.
export function lerConteudoProgramatico(linhas) {
  let ini = linhas.findIndex((l) => /CONTE[ÚU]DOS? PROGRAM[ÁA]TICOS?|OBJETOS? DE AVALIA[ÇC][ÃA]O|CONHECIMENTOS? EXIGIDOS|PROGRAMA DAS? PROVAS?/i.test(l));
  if (ini < 0) return [];
  const resto = linhas.slice(ini + 1);
  const disciplinas = [];
  let bloco = '';
  let atual = null;
  const NAO_MATERIA = /^(di[áa]rio oficial|r e s o l v e|resolve|decreta|observa[çc]|edital|conselho|exame|anexo|ordem dos|funda[çc][ãa]o|minist[ée]rio|cronograma|tabela|quadro|cargo|vagas|governo|secretaria|prefeitura|tribunal|pol[íi]cia|universidade|instituto|coordena|comiss[ãa]o|presid|disposi[çc]|das? |do |dos |item|cap[íi]tulo|se[çc][ãa]o|t[íi]tulo|requisito|atribui|remunera|evento|data|local|hor[áa]rio)/i;
  const fechar = () => {
    if (atual) {
      atual.topicos = dividirTopicos(atual._txt);
      delete atual._txt;
      const nomeOk = !NAO_MATERIA.test(atual.nome) && !/\d{2,}/.test(atual.nome) && atual.nome.split(' ').length <= 9;
      if (atual.topicos.length && nomeOk) disciplinas.push(atual);
    }
    atual = null;
  };
  for (const l0 of resto) {
    const l = l0.trim();
    if (!l) continue;
    if (/^ANEXO\s+[IVX]+\b/i.test(l) && disciplinas.length > 2 && !/CONTE[ÚU]DO/i.test(l)) break;
    const doisPontos = l.match(/^([A-ZÀ-ÖØ-Ý][A-ZÀ-ÖØ-Ý\s,\-–()/ºª]{3,90}?):\s*(.*)$/);
    if (doisPontos && temLetra(doisPontos[1])) {
      const nome = doisPontos[1].trim();
      if (/^CONHECIMENTOS?\b/i.test(nome) && !doisPontos[2]) {
        fechar();
        bloco = titulo(nome);
        continue;
      }
      fechar();
      atual = { nome: titulo(nome), bloco, _txt: doisPontos[2] || '' };
      continue;
    }
    if (MAIUSC.test(l) && temLetra(l) && l.length >= 4 && l.length <= 90 && !/^\d/.test(l)) {
      if (/^CONHECIMENTOS?\b|^BLOCO\b|^PARTE\b|^M[ÓO]DULO\b/i.test(l)) {
        fechar();
        bloco = titulo(l);
        continue;
      }
      fechar();
      atual = { nome: titulo(l.replace(/[:.]$/, '')), bloco, _txt: '' };
      continue;
    }
    if (atual) atual._txt += ' ' + l;
  }
  fechar();
  return disciplinas.slice(0, 60);
}

// ---------------- cargos e conteúdo por cargo ----------------
const semAcento = (x) => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const slug = (x) => semAcento(x).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

export function lerCargos(linhas) {
  const plano = linhas.join(' ').replace(/\s+/g, ' ');
  const nomes = [];
  const add = (n) => {
    const nome = n.replace(/\s+/g, ' ').replace(/[\s,;:.–-]+$/, '').trim();
    if (nome.length < 4 || nome.length > 70 || /^(o|a|os|as|de|do|da)\b/i.test(nome)) return;
    const t = titulo(nome);
    if (!nomes.some((x) => semAcento(x) === semAcento(t))) nomes.push(t);
  };
  // "74 (setenta e quatro) vagas para o cargo de Oficial Investigador de Polícia;"
  for (const m of plano.matchAll(/vagas?\s+para\s+o\s+cargo\s+de\s+([A-ZÀ-Ý][\p{L}\-–/ ]{3,70}?)(?=\s*[;,.(]|\s+e\s+\d|\s+conforme|\s+do\s+quadro)/gu)) add(m[1]);
  // "SUBTOTAIS - OFICIAL INVESTIGADOR DE POLÍCIA" (quadro de vagas), só se o texto não listou os cargos
  if (!nomes.length) {
    for (const l of linhas) {
      const m = l.match(/^\s*SUBTOTA(?:L|IS)\s*[-–:]\s*([^\d]+?)\s*[\d-]*\s*$/i);
      if (m && !/^CONHECIMENTOS?\b/i.test(m[1])) add(m[1]);
    }
  }
  return nomes.slice(0, 30).map((nome) => ({ id: slug(nome), nome }));
}

// Conteúdo programático organizado por cargo:
// "CONHECIMENTOS BÁSICOS PARA TODOS OS CARGOS", "... PARA OS CARGOS DE X, Y E Z", e cabeçalhos "CARGO X:" com as matérias específicas.
export function lerCargosEConteudo(linhas) {
  const cargos = lerCargos(linhas);
  if (!cargos.length) return { cargos: [], disciplinas: [] };
  const ini = linhas.map((l, i) => (/CONTE[ÚU]DOS? PROGRAM[ÁA]TICOS?/i.test(l) ? i : -1)).filter((i) => i >= 0);
  if (!ini.length) return { cargos, disciplinas: [] };
  // o último título "conteúdos programáticos" (o do anexo), não o sumário
  const comeco = ini.find((i) => (linhas.slice(i + 1, i + 6).join(' ').match(/[A-ZÀ-Ý ]{4,}:/) || []).length) ?? ini[ini.length - 1];
  // cabeçalhos e rodapés repetidos (aparecem em todas as páginas)
  const freq = new Map();
  for (const l of linhas) freq.set(l.trim(), (freq.get(l.trim()) || 0) + 1);
  const repetida = (l) => (freq.get(l) || 0) >= 4 && l.length < 120;
  const todos = cargos.map((c) => c.id);
  const cargosNoTexto = (t) => {
    const n = semAcento(t);
    return cargos.filter((c) => n.includes(semAcento(c.nome)) || n.includes(semAcento(c.nome).replace(/ de policia( civil)?$/, ''))).map((c) => c.id);
  };
  const palavrasCargo = [...new Set(cargos.flatMap((c) => semAcento(c.nome).split(/[\s-]+/).filter((w) => w.length >= 6)))];
  const disciplinas = [];
  let escopo = todos;
  let bloco = '';
  let atual = null;
  let cabecalho = null; // título de seção que pode continuar na linha de baixo
  let partes = ''; // nome de matéria quebrado em duas linhas ("REALIDADE ... DO" / "ESTADO DO ACRE:")
  let cauda = ''; // palavras em maiúsculas no fim da linha anterior ("... TI E SEGURANÇA DA" / "INFORMAÇÃO: 1 ...")
  const fechar = () => {
    if (atual) {
      atual.topicos = dividirTopicos(atual._txt);
      delete atual._txt;
      if (atual.topicos.length && !/^(anexo|observa|nota)/i.test(atual.nome)) {
        const igual = disciplinas.find((d) => semAcento(d.nome) === semAcento(atual.nome) && d.bloco === atual.bloco);
        if (igual) igual.cargos = [...new Set([...igual.cargos, ...atual.cargos])];
        else disciplinas.push(atual);
      }
    }
    atual = null;
  };
  const abrirMateria = (nome, resto) => {
    fechar();
    let cs = escopo;
    const exceto = nome.match(/\(EXCETO[^)]*\)/i);
    if (exceto) cs = cs.filter((c) => !cargosNoTexto(exceto[0]).includes(c));
    const so = nome.match(/\((?:APENAS|SOMENTE)[^)]*\)/i);
    if (so && cargosNoTexto(so[0]).length) cs = cargosNoTexto(so[0]);
    const limpo = titulo(nome.replace(/\([^)]*\)/g, '').replace(/^NO[ÇC][ÕO]ES DE\s+/i, 'Noções de ').trim());
    atual = { nome: limpo.replace(/^Noções De /, 'Noções de '), bloco, cargos: cs, _txt: resto || '' };
  };
  for (let i = comeco + 1; i < linhas.length; i++) {
    const l = linhas[i].trim();
    if (!l || repetida(l) || /^(Edital|P[áa]gina)\b.*\d+\s*de\s*\d+/i.test(l)) continue;
    if (/^ANEXO\s+[IVX]+\b/i.test(l) && disciplinas.length > 2) break;
    // título de seção: "2. CONHECIMENTOS ... PARA OS CARGOS DE ..." (pode quebrar em várias linhas)
    const continua =
      cabecalho && MAIUSC.test(l) && !/:\s*$/.test(l) && l.length < 110 &&
      (/(\bDE|\bDO|\bDA|\bDOS|\bDAS|\bE|,|–|-)\s*$/.test(cabecalho) || palavrasCargo.some((w) => semAcento(l).includes(w)));
    if (/^\d+(\.\d+)*\.?\s+(CONHECIMENTOS|CONTE[ÚU]DOS?|PROVA|M[ÓO]DULO|BLOCO|DISCIPLINAS)/i.test(l) || continua) {
      fechar();
      cabecalho = (cabecalho && !/^\d/.test(l) ? cabecalho + ' ' : '') + l;
      const cs = /TODOS OS CARGOS/i.test(cabecalho) ? todos : cargosNoTexto(cabecalho);
      if (/^\d+\.\s/.test(cabecalho) || /CARGOS?/i.test(cabecalho)) escopo = cs.length ? cs : escopo;
      bloco = titulo(cabecalho.replace(/^\d+(\.\d+)*\.?\s+/, '').replace(/\s+PARA\s+(O|OS)\s+CARGOS?.*$/i, '').replace(/\s+PARA TODOS OS CARGOS/i, ''));
      continue;
    }
    cabecalho = null;
    if (MAIUSC.test(l) && temLetra(l) && !/:/.test(l) && l.length < 110 && !/^\d/.test(l)) {
      partes = (partes ? partes + ' ' : '') + l;
      continue;
    }
    const lc = partes && /^[A-ZÀ-ÖØ-Ý][A-ZÀ-ÖØ-Ý\s,\-–()/ºª]{1,110}:/.test(l) ? `${partes} ${l}` : l;
    if (partes && lc === l && atual) atual._txt += ' ' + partes;
    partes = '';
    // cabeçalho de cargo: "OFICIAL INVESTIGADOR DE POLÍCIA:" ou "PERITO CRIMINAL – CONTEÚDO COMUM...:"
    const cab = lc.match(/^([A-ZÀ-ÖØ-Ý][A-ZÀ-ÖØ-Ý\s,\-–()/ºª]{3,140}?):\s*(.*)$/);
    if (cab && temLetra(cab[1])) {
      const nomeCab = cab[1].trim();
      const cs = cargosNoTexto(nomeCab);
      const ehCargo = cs.length === 1 && semAcento(nomeCab).startsWith(semAcento(cargos.find((c) => c.id === cs[0]).nome).split(' ')[0]);
      if (ehCargo) {
        fechar();
        escopo = cs;
        const depois = nomeCab.split(/\s+[–-]\s+/).slice(1).join(' – ');
        bloco = 'Específicos – ' + cargos.find((c) => c.id === cs[0]).nome + (depois && !/CONTE[ÚU]DO/i.test(depois) ? ` – ${titulo(depois)}` : '');
        if (cab[2]) lerInline(cab[2]);
        continue;
      }
      if (/^ESPECIALIDADE\b/i.test(nomeCab)) {
        abrirMateria(nomeCab.replace(/^ESPECIALIDADE\s*[–-]\s*/i, ''), '');
        if (cab[2]) lerInline(cab[2]);
        continue;
      }
      // nome que começou no fim da linha anterior ("... TI E SEGURANÇA DA" / "INFORMAÇÃO: 1 ...")
      let nomeFinal = nomeCab;
      if (cauda && atual && atual._txt.trimEnd().endsWith(cauda)) {
        atual._txt = atual._txt.trimEnd().slice(0, -cauda.length);
        nomeFinal = `${cauda} ${nomeCab}`;
      }
      cauda = '';
      abrirMateria(nomeFinal, '');
      if (cab[2]) lerInline(cab[2]);
      continue;
    }
    lerInline(l);
  }
  fechar();
  return { cargos, disciplinas: disciplinas.slice(0, 80) };

  // dentro do texto: "... ESTATÍSTICA: 1 Conceitos ..." abre uma nova matéria no meio da linha
  function lerInline(t) {
    // nome de matéria começado no fim da linha anterior
    const mIni = t.match(/^([A-ZÀ-ÖØ-Ý][A-ZÀ-ÖØ-Ý ,\-–()/]{2,70}):\s+(?=\d|[A-ZÀ-Ý])/);
    if (mIni && cauda && atual && atual._txt.trimEnd().endsWith(cauda)) {
      atual._txt = atual._txt.trimEnd().slice(0, -cauda.length);
      abrirMateria(`${cauda} ${mIni[1]}`.trim(), '');
      t = t.slice(mIni[0].length);
    }
    const mFim = t.match(/(?:^|[.;]\s+)((?:[A-ZÀ-ÖØ-Ý]{1,}[ ,\-–]*){1,8})$/);
    cauda = mFim && temLetra(mFim[1]) && mFim[1].trim().length > 1 ? mFim[1].trim() : '';
    const re = /(?:^|[.;]\s+|\s)([A-ZÀ-ÖØ-Ý][A-ZÀ-ÖØ-Ý ,\-–()/]{4,70}):\s+(?=\d|[A-ZÀ-Ý])/g;
    let ult = 0;
    let m;
    while ((m = re.exec(t))) {
      if (!temLetra(m[1]) || m[1].trim().split(' ').length > 10) continue;
      const antes = t.slice(ult, m.index);
      if (atual) atual._txt += ' ' + antes;
      abrirMateria(m[1].trim(), '');
      ult = m.index + m[0].length;
    }
    if (atual) atual._txt += ' ' + t.slice(ult);
  }
}

export function dividirTopicos(txt) {
  const t = txt.replace(/\s+/g, ' ').trim();
  if (!t) return [];
  // divide em "1 ", "2 ", "2.1 " ... seguidos de letra maiúscula
  const partes = t.split(/(?:^|\s)(?=\d{1,2}(?:\.\d{1,2})*\.?\s+[A-ZÀ-Ý])/);
  const out = partes
    .map((p) => p.replace(/^\d{1,2}(?:\.\d{1,2})*\.?\s+/, '').replace(/[.;]\s*$/, '').trim())
    .filter((p) => p.length > 2);
  if (out.length > 1) return out;
  return t
    .split(/;\s+|\.\s+(?=[A-ZÀ-Ý])/)
    .map((p) => p.replace(/[.;]\s*$/, '').trim())
    .filter((p) => p.length > 2);
}

// ---------------- prova ----------------
const RE_INICIO = /^(?:QUEST[ÃA]O|Quest[ãa]o)?\s*0*(\d{1,3})\s*(?:[.)\-–:]|\s+-|$)\s*(.*)$/;
const RUIDO = /^(P[ÁA]GINA|CADERNO|RASCUNHO|BOA PROVA|LEIA|INSTRU[ÇC]|ATEN[ÇC][ÃA]O|PROVA OBJETIVA|TIPO\s+\d|CARGO|\d+\s*\/\s*\d+$)/i;

// formato: 'A-E' | 'A-D' | 'CE' | 'discursiva'
export function lerProva(linhas, formato = 'A-E') {
  const questoes = [];
  let materia = '';
  let bloco = '';
  let esperado = null;
  let atual = null;

  // número inicial: o primeiro marcador "1" que aparece; se não houver, o primeiro número encontrado
  const candidatos = linhas.map((l) => l.match(RE_INICIO)).filter(Boolean);
  if (!candidatos.length) return [];
  esperado = candidatos.some((m) => +m[1] === 1) ? 1 : +candidatos[0][1];

  for (const l0 of linhas) {
    const l = l0.trim();
    if (!l || RUIDO.test(l)) continue;
    const m = l.match(RE_INICIO);
    if (m && +m[1] === esperado) {
      if (atual) questoes.push(atual);
      atual = { numero: esperado, materia, bloco, linhas: m[2] ? [m[2]] : [] };
      esperado++;
      continue;
    }
    // cabeçalho de disciplina (linha toda em maiúsculas)
    if (MAIUSC.test(l) && temLetra(l) && l.length >= 4 && l.length <= 80 && !/^\(?[A-E]\)/.test(l) && !/^[A-E][.)\-–]\s/.test(l)) {
      if (/^CONHECIMENTOS?\b/i.test(l)) bloco = titulo(l);
      else materia = titulo(l.replace(/[:.]$/, ''));
      continue;
    }
    if (atual) atual.linhas.push(l);
  }
  if (atual) questoes.push(atual);

  const letras = formato === 'A-D' ? ['A', 'B', 'C', 'D'] : ['A', 'B', 'C', 'D', 'E'];
  return questoes.map((q) => {
    const corpo = q.linhas.join('\n');
    const base = { numero: q.numero, materia: q.materia, bloco: q.bloco, formato, gabarito: '', anulada: false, espelho: '' };
    if (formato === 'CE' || formato === 'discursiva') return { ...base, enunciado: limpar(corpo), alternativas: null };
    const alt = separarAlternativas(corpo, letras);
    return { ...base, enunciado: limpar(alt ? alt.enunciado : corpo), alternativas: alt ? alt.alternativas : Object.fromEntries(letras.map((L) => [L, ''])) };
  });
}

function separarAlternativas(corpo, letras) {
  const pos = [];
  let desde = 0;
  for (const L of letras) {
    const l = L.toLowerCase();
    const re = new RegExp(`(?:^|\\n|\\s)(?:\\([${L}${l}]\\)|[${L}${l}]\\)|${L}\\s*[.\\-–]\\s)\\s*`, 'g');
    re.lastIndex = desde;
    const m = re.exec(corpo);
    if (!m) break;
    pos.push({ L, ini: m.index, fim: m.index + m[0].length });
    desde = m.index + m[0].length;
  }
  if (pos.length < Math.min(4, letras.length)) return null;
  const alternativas = {};
  pos.forEach((p, i) => {
    alternativas[p.L] = limpar(corpo.slice(p.fim, i + 1 < pos.length ? pos[i + 1].ini : undefined));
  });
  for (const L of letras) if (!(L in alternativas)) alternativas[L] = '';
  return { enunciado: corpo.slice(0, pos[0].ini), alternativas };
}

const limpar = (s) =>
  (s || '')
    .replace(/-\n(?=[a-zà-ý])/g, '') // palavra hifenizada na quebra de linha
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

// ---------------- gabarito ----------------
// Aceita "1-A 2-C ...", "01 A 02 C", tabelas com uma linha de números e outra de letras, e "X"/"*"/"ANULADA".
export function lerGabarito(texto, formato = 'A-E') {
  const valido = formato === 'CE' ? 'CE' : formato === 'A-D' ? 'ABCD' : 'ABCDE';
  const res = {};
  const norm = texto.replace(/\r/g, '').toUpperCase();
  const re = new RegExp(`(?:^|[^\\d])0*(\\d{1,3})\\s*[-–.:)]?\\s*([${valido}]|\\*|X|ANULADA|NULA|ANULAD[AO])(?![A-Z])`, 'g');
  let m;
  while ((m = re.exec(norm))) {
    const n = +m[1];
    if (!(n in res)) res[n] = /^[A-E]$/.test(m[2]) ? m[2] : 'ANULADA';
  }
  // formato de tabela: linha de números seguida de linha de letras
  const linhas = norm.split('\n').map((l) => l.trim()).filter(Boolean);
  for (let i = 0; i + 1 < linhas.length; i++) {
    const nums = linhas[i].split(/\s+/);
    const lets = linhas[i + 1].split(/\s+/);
    if (nums.length >= 3 && nums.every((x) => /^\d{1,3}$/.test(x)) && lets.length === nums.length && lets.every((x) => new RegExp(`^([${valido}]|\\*|X)$`).test(x))) {
      nums.forEach((n, k) => {
        res[+n] = /^[A-E]$/.test(lets[k]) ? lets[k] : 'ANULADA';
      });
    }
  }
  return res;
}

// ---------------- edital verticalizado pronto (de outra plataforma ou feito pelo usuário) ----------------
// Aceita listas com disciplinas como títulos e tópicos numerados ou com marcadores (1., 1.1, -, •, ☐, [ ], ( )).
const RE_ITEM = /^\s*(?:\d{1,2}(?:\.\d{1,2})*\s*[.)\-–]?|[-•●▪◦*✓✔]|☐|□|■|\[\s?[xX]?\s?\]|\(\s?[xX]?\s?\))\s+/;
export function lerVerticalizado(linhas) {
  const discs = [];
  let atual = null;
  let ultimo = null;
  const novaDisc = (nome) => {
    atual = { nome: titulo(nome.replace(/[:.]$/, '').trim()), topicos: [] };
    discs.push(atual);
    ultimo = null;
  };
  for (const l0 of linhas) {
    const l = l0.replace(/\s+/g, ' ').trim();
    if (!l || /^(p[áa]gina|edital verticalizado|conte[úu]do program[áa]tico|t[óo]pico|estudado|revis)/i.test(l)) continue;
    const inline = l.match(/^([A-ZÀ-ÖØ-Ý][^:]{3,80}):\s*(\d.*)$/);
    if (inline) {
      novaDisc(inline[1]);
      atual.topicos.push(...dividirTopicos(inline[2]));
      continue;
    }
    if (RE_ITEM.test(l)) {
      if (!atual) novaDisc('Geral');
      ultimo = l.replace(RE_ITEM, '').replace(/[;.]$/, '').trim();
      if (ultimo) atual.topicos.push(ultimo);
      continue;
    }
    const pareceTitulo = (MAIUSC.test(l) && temLetra(l) && l.length <= 90) || (/:$/.test(l) && l.length <= 90) || (l.length <= 60 && /^(direito|l[íi]ngua|portugu|racioc|matem|inform|legisla|no[çc][õo]es|conhecimentos|[ée]tica|contab|estat|administra|arquiv|f[íi]sica|qu[íi]mica|biolog|hist[óo]ria|geograf|atualidades|realidade|economia|filosofia|sociolog|medicina|criminolog|estatuto)/i.test(l));
    if (pareceTitulo) {
      novaDisc(l);
      continue;
    }
    // continuação do tópico anterior (texto quebrado em duas linhas)
    if (atual && ultimo && atual.topicos.length) atual.topicos[atual.topicos.length - 1] += ' ' + l;
  }
  return discs.filter((d) => d.topicos.length);
}
