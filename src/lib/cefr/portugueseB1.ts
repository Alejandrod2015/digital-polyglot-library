// Lemas de portugues de BRASIL que se abren en B1: los que no son A1/A2 pero
// si son legitimos para un lector intermedio. Se combinan con A1+A2 para formar
// el universo B1 en `isPortugueseUpToLevel(word, "b1")`.
//
// POR QUE EXISTE (2026-09-06). Hasta hoy `vocab-level-frequency` no corria en
// portugues B1: el juez de nivel solo se enganchaba para ES (todos los niveles)
// y para DE/IT/PT/FR unicamente en A1/A2. Medido y no recordado: se corrio
// `validateGeneratedStory` sobre una historia YA publicada del Traveler PT-BR
// A1 declarandola `a1` y luego `b1`, y salieron 32 checks contra 31, con
// `vocab-level-frequency` como unica diferencia y nada que lo sustituyera. O
// sea que un texto escrito en A1 se validaba como B1 con 31 de 31.
//
// CRITERIO DE LA LISTA. Se admite el lema que un temario B1 brasileno da y que
// no cabe en A1/A2: trabajo, tramites, opinion y discurso, emociones con
// matiz, conectores de subordinacion, tecnologia de uso diario. Se deja fuera
// lo abstracto y lo academico, que es B2 (analise, hipotese, paradigma), y
// tambien el lexico anclado a una escena, que entra por la regla del ancla
// cultural y no por la lista. Portugues de Brasil en todo: "onibus" y no
// "autocarro", "celular" y no "telemovel", "geladeira" y no "frigorifico".
//
// PROVISIONAL. La lista se ha escrito ANTES de que exista un B1 de portugues
// publicado, asi que su cobertura no esta medida contra ningun journey B1 real
// de este idioma; lo unico medido es que deja fuera al A1 (ver
// `journey-vocab-level-floor` en validateJourneyStories.ts). La fila del
// inventario lo lleva marcado para remedir contra el primer B1 PT publicado.
// Las listas A1A2 de los demas idiomas no se han tocado.

export const PORTUGUESE_B1_LEMMAS: ReadonlySet<string> = new Set([
  // Trabalho e profissoes
  "engenheiro","engenheira","advogado","advogada","enfermeiro","enfermeira",
  "contador","contadora","arquiteto","arquiteta","jornalista","fotografo","fotografa",
  "designer","programador","programadora","empresario","empresaria","comerciante",
  "vendedor","vendedora","caixa","mecanico","mecanica","eletricista","encanador",
  "carpinteiro","pedreiro","jardineiro","cozinheiro","cozinheira","garcom","garconete",
  "recepcionista","secretario","secretaria","gerente","diretor","diretora","chefe",
  "supervisor","supervisora","assistente","ajudante","estagiario","estagiaria",
  "aprendiz","trabalhador","trabalhadora","funcionario","funcionaria","colega",
  "profissao","carreira","cargo","emprego","vaga","contrato","salario","sueldo",
  "turno","horario","expediente","folga","ferias","aposentadoria","curriculo",
  "entrevista","reuniao","prazo","meta","tarefa","projeto","equipe","sindicato",

  // Tramites, dinheiro e servicos
  "documento","comprovante","cadastro","protocolo","formulario","assinatura",
  "carimbo","taxa","multa","imposto","desconto","parcela","prestacao","boleto",
  "fatura","extrato","poupanca","emprestimo","divida","juros","orcamento",
  "seguro","garantia","reembolso","deposito","saque","transferencia","pagamento",
  "agendar","marcar","cancelar","adiar","remarcar","confirmar","autorizar",
  "solicitar","requerer","preencher","assinar","registrar","renovar","vencer",
  "aluguel","inquilino","proprietario","condominio","fiador","mudanca","reforma",

  // Emocoes e atitudes com matiz
  "frustracao","decepcao","saudade","vergonha","culpa","ciume","inveja","orgulho",
  "esperanca","entusiasmo","alivio","angustia","ansiedade","preocupacao","carinho",
  "ternura","respeito","admiracao","desprezo","desconfianca","confianca",
  "irritado","decepcionado","emocionado","frustrado","ofendido","magoado",
  "agradecido","arrependido","envergonhado","ciumento","aliviado","aflito",
  "chateado","incomodado","farto","desesperado","conformado","inseguro","seguro",
  "orgulhoso","teimoso","exigente","desconfiado","distraido","atento","grato",

  // Opiniao e discurso
  "opiniao","ponto de vista","argumento","conclusao","debate","discussao",
  "acordo","desacordo","vantagem","desvantagem","risco","oportunidade",
  "motivo","causa","consequencia","resultado","efeito","exemplo","caso",
  "situacao","detalhe","diferenca","semelhanca","comparacao","escolha","decisao",
  "opinar","argumentar","defender","afirmar","negar","reconhecer","admitir",
  "criticar","questionar","duvidar","desconfiar","convencer","esclarecer",
  "resumir","concluir","supor","imaginar","comentar","discordar","concordar",
  "sugerir","recomendar","aconselhar","advertir","informar","comunicar","avaliar",

  // Verbos de acao, esforco e mudanca
  "conseguir","alcancar","cumprir","realizar","desenvolver","fracassar","falhar",
  "errar","enganar","arrepender","desculpar","perdoar","aceitar","recusar",
  "negar","opor","apoiar","colaborar","competir","tentar","esforcar","melhorar",
  "piorar","crescer","progredir","avancar","retroceder","parar","continuar",
  "persistir","desistir","abandonar","ceder","resistir","aguentar","suportar",
  "enfrentar","evitar","ignorar","identificar","distinguir","comparar","relacionar",
  "unir","separar","dividir","organizar","planejar","programar","administrar",
  "controlar","dirigir","liderar","obedecer","mandar","ordenar","permitir","proibir",
  "conquistar","perder","recuperar","substituir","trocar","adaptar","acostumar",
  "acontecer","surgir","provocar","causar","gerar","resolver","enfrentar","arriscar",
  "aproveitar","desperdicar","economizar","gastar","investir","poupar","dever",
  "merecer","valer","depender","pertencer","envolver","incluir","excluir",

  // Tecnologia de uso diario
  "tecnologia","internet","rede","conexao","sinal","dados","arquivo","pasta",
  "programa","aplicativo","sistema","plataforma","site","pagina","link","senha",
  "usuario","conta","perfil","mensagem","correio","chamada","videochamada",
  "atualizacao","download","instalar","baixar","compartilhar","publicar","enviar",
  "responder","navegar","procurar","verificar","cadastrar","entrar","sair",
  "carregador","bateria","celular","computador","teclado","impressora","camera",

  // Cidade, transporte e servicos
  "transporte","passagem","bilhete","embarque","desembarque","conexao","atraso",
  "cancelamento","itinerario","trajeto","rodovia","pedagio","estacionamento",
  "motorista","passageiro","cobrador","bagageiro","terminal","plataforma",
  "prefeitura","bairro","periferia","centro","obra","calcamento","semaforo",
  "coleta","lixeira","encanamento","vazamento","conserto","manutencao","reparo",
  "vizinhanca","morador","sindico","porteiro","zelador","assembleia",

  // Saude e corpo
  "consulta","exame","receita","tratamento","sintoma","febre","gripe","alergia",
  "pressao","curativo","vacina","plano de saude","posto","emergencia","internacao",
  "torcer","machucar","desmaiar","tossir","espirrar","melhorar","piorar","cicatriz",
  "cansaco","insonia","enjoo","tontura","dieta","descanso","repouso",

  // Natureza, clima e ambiente
  "clima","previsao","temporada","enchente","seca","tempestade","trovao","relampago",
  "mare","correnteza","nascente","cachoeira","trilha","encosta","penhasco","caverna",
  "reserva","preservacao","poluicao","lixo","reciclagem","especie","ninho","cardume",
  "guia","permissao","licenca","autorizacao","limite","regra","norma","fiscal",

  // Tempo, frequencia e cantidad
  "prazo","antecedencia","atraso","frequencia","costume","habito","rotina",
  "temporada","periodo","etapa","fase","inicio","fim","meio","maioria","minoria",
  "media","metade","dobro","triplo","excesso","falta","sobra","quantidade",
  "raramente","frequentemente","dificilmente","provavelmente","certamente",
  "praticamente","exatamente","justamente","atualmente","antigamente","ultimamente",

  // Conectores e expressoes de discurso
  "no entanto","porem","apesar de","embora","ainda que","mesmo que","caso",
  "enquanto que","por outro lado","por um lado","alem disso","inclusive",
  "ou seja","por exemplo","em geral","de modo geral","normalmente","geralmente",
  "portanto","por isso","de modo que","assim que","logo que","desde que",
  "ja que","uma vez que","devido a","gracas a","por causa de","em vez de",
  "a fim de","para que","de repente","aos poucos","cada vez mais","pelo menos",
  "de vez em quando","na verdade","a princípio","no fundo","por enquanto",
  "de qualquer jeito","por acaso","sem duvida","com certeza","de propósito",


  // Segunda tanda, 2026-09-06, escribiendo el tema 1 del B1 (Sao Paulo, la
  // vuelta y el cuarto alquilado). La lista se escribio a ciegas, antes de que
  // existiera una sola linea de B1 en portugues, y al medirla contra prosa de
  // verdad le faltaba justo el vocabulario que hace que un B1 sea B1: el
  // alquiler, el trafico y el trabajo de oficina. Ninguna de estas es rara ni
  // literaria; todas son de temario B1 y salen en la escena. Las de realia
  // brasilena (marginal, motoboy) NO entran aqui: van con register cultural,
  // que es su via, porque son raras en cualquier corpus por definicion.
  "caucao","caução","inquilino","inquilina","engarrafamento","acostamento","interior","diaria","diária","estrada",
  "mochila","arrumar","corredor","tinta","fresco","quebrar","gastar","metro","metrô",
  "transito","trânsito","retrovisor","encharcado","bainha","pauta","rota","pasta",
  "guarda-chuva","piscina","mapa","apertar","baixinho","adiante",
  "caminhao","caminhão","tombar","buzinar","buzina","polegar","despedida","emprestado",
  "graca","graça","caber","sumir","escada","janela","fila","turno",


  // Tercera tanda, 2026-09-06, tema 2 (Curitiba). Mismo criterio que la
  // segunda: lo que salio en prosa de verdad y un temario B1 da por sabido.
  // Algunas (moeda, cartao, troco, nota, maquina) son de temario A2 y estan
  // aqui solo porque la lista A1/A2 de portugues no las trae; eso hace que el
  // suelo de nivel las cuente como "por encima de A1/A2" y por tanto que mida
  // un poco de mas. Se corrige cuando se remida la lista A1/A2, no antes.
  "encharcar","ficha","cobradora","cobrador","aparelho","anotar","devagar",
  "saldo","recarregar","cartao","cartão","moeda","troco","lotado","maquina","máquina",
  "nota","trocar","quentinho","geada","vapor","assado","endurecer","queimar","soprar",
  "ligacao","ligação","desligar","praca","praça","esquina","peito","dente","dedo","lago",
  "parque","portao","portão","ensinar","aprender","viajar","escrever",
  "agencia","agência","nome","ouvido","degrau","passar","casaco","chave",


  // Cuarta tanda, 2026-09-06, tema 3 (Serra Gaucha, la mesa larga). El dominio
  // de la comida en familia y del trato que se cierra comiendo. Igual que las
  // anteriores: son de temario B1 y salieron de la escena, no del diccionario.
  // La realia (galeto, cuca, salame, queijo colonial) va por register cultural.
  "patio","pátio","serra","comprido","comprida","genro","nora","sogra","sogro",
  "piada","dialeto","comissao","comissão","travessa","acordo","perceber","atrasado",
  "assinar","girar","vazio","molho","afrouxar","cinto","jarra","rotulo","rótulo",
  "aconselhar","ofender","elogiar","colherada","otimo","ótimo","tia","tio","vinho",
  "geleia","protestar","fixo","fixa","espeto","frase","obrigada","cozinha","familia","família",
  "toalha","convite","convidar","insistir","recusar","aceitar","agradecer","gesto",
  "tabela","balanca","balança","excesso","despachar","alca","alça","barbante","etiqueta",
  "peso","sacola","esteira","fome","escrito","talher","lacre","volume","franquia","poltrona","tabuleiro","fatia","informar","despacho","importar","ligar","baixar","prateleira","fumaca","fumaça","brasa","tampinha","palavra",


  // Quinta tanda, 2026-09-06, tema 4 (Paraty). Mar, marea y el favor que no se
  // paga con dinero. Mismo criterio: salieron de la escena y son de temario B1.
  "cais","pier","píer","travessia","enrolar","ranger","calcular","encostado",
  "ilha","devolver","retribuir","dobrado","assistir","derrotado","presente",
  "favor","venda","sublinhar","movimento","fraco","embarque","mensagem",
  "carona","corda","remo","ancora","âncora","boia","leme","casco","maresia","atracar","zarpar","cabo",
  "incomodado","aliviado","recado","gentileza","planilha","acougueiro","açougueiro","robalo","marmita","caderno",
  "secar","derrotado","correnteza","queixo","ombro","beira","troca","cobranca","cobrança","pescador","apelido","canal","limo","torrado","esquecer","atravessar","falhar","compromisso",


  // Sexta tanda, 2026-09-06, tema 5 (Chapada Diamantina). Trilla, guia y las
  // reglas que protegen la ruta. Mismo criterio que las anteriores.
  "gruta","bota","cantil","atalho","cume","raiz","lama","formiga","folego","fôlego",
  "tontura","curativo","maca","resgate","radio","rádio","autorizacao","autorização",
  "folheto","limite","guiar","musgo","aventura","torcao","torção","ajoelhar","chiar","quebra",
  "animado","pisar","pronto","ditar","riscar","viva","botar","duplo","lista","atras","atrás",
  "descascar","vendido","posto","tinta","firme","responsabilidade","capacidade","lotacao","lotação",
  "advertencia","advertência","declive","encosta","vale","prejuizo","prejuízo","seguro","cadastro",
  "fiscal","multa","autorizacao","estornar","tabuleta","furado","calado","advertir","adverter",
  "enganchar","repartido","repartir","dupla","caneta","reclamacao","reclamação","apalpar",
  "entorse","assinado","impresso","vista","inchar","escrita","dobrar","adverte","promete",
  "descem","desce","engancha","empresta","dita","risca","socorro","maca","resgate","muleta",
  "compressa","tala","enfermaria","inchaco","inchaço","alivio","alívio","atestado","cobertura","apolice","apólice",
  "vistoria","comprovante","protocolo","penalidade","advertencia","advertência","infracao","infração",
  "norma","criterio","critério","exigencia","exigência","requisito","clausula","cláusula","rodape","rodapé",
  "verso","rascunho","emenda","revisao","revisão","tiragem","grafica","gráfica","legenda","destaque",


  // Septima tanda, 2026-09-06, temas 6 y 7 (Noronha y Brasilia). Buceo con sus
  // reglas, y la ventanilla con las suyas. Comprobadas libres una a una contra
  // las 879 que ya ensenan el A0 y el A1.
  "mergulho","mergulhar","mergulhador","cilindro","nadadeira","mascara","máscara",
  "recife","coral","cardume","tartaruga","golfinho","cota","credenciamento","briefing",
  "profundidade","visibilidade","apneia","descompressao","descompressão","superficie","superfície",
  "preservacao","preservação","desova","ninho","embarcacao","embarcação","instrutor","instrutora",
  "reparticao","repartição","senha","formulario","formulário","despachante","procuracao","procuração",
  "certidao","certidão","autenticacao","autenticação","agendamento","atendimento","servidor","ramal",
  "elevador","cracha","crachá","pendencia","pendência","indeferido","deferido","triagem","firma",
  "sorteio","garantido","percevejo","pregado","riscado","alternativo","estado","data","antigo",
  "prancheta","bolha","proibido","desenhar","testa","corrigir","mencionar","util","útil","apoiado","marcado",
  "bancada","atendente","pulseira","credencial","mural","aviso","comunicado","edital","convocacao","convocação",
  "inscricao","inscrição","lote","parapeito","galpao","galpão","mofo","credenciado","cardume","desova",


  // Octava tanda, 2026-09-06, tema 7 (Brasilia, la ventanilla). El lexico del
  // tramite, que es de temario B1 y que el A0 y el A1 no tocan.
  "painel","processo","renovacao","renovação","registro","baixa","rasgar","vinco","alisar",
  "publicado","carta","trecho","imprimir","calendario","calendário","contrario","contrário",
  "apagado","despesa","acertar","risada","fotografar","soar","cartorio","cartório","terreo","térreo",
  "alvara","alvará","anexo","analise","análise","boleto","chefia","departamento","expediente","feriado",
  "laudo","negativa","peticao","petição","quitacao","quitação","recolhimento","regularidade","requerimento",
  "setor","situacao","situação","tramite","trâmite","validade","vencimento","quinta-feira","diario","diário",
  "recomecar","recomeçar","indeferimento","escritorio","escritório","fichario","fichário",
  "grampo","clipe","armario","armário","bloco","arquivo","estante","bebedouro","cracha","crachá",
  "visitante","recepcionista","seguranca","segurança","portaria","saguao","saguão","pilha","guardado","copia","cópia","requentado","mormaco","mormaço","zumbido","reflexo","papelada","relacao","relação",

  // Expressoes coloquiais correntes no Brasil
  "dar certo","dar errado","dar um jeito","valer a pena","fazer questao",
  "ter razao","tomar cuidado","prestar atencao","ficar de olho","perder a hora",
  "estar por dentro","de cara","sem querer","na hora","a toa","de graca",
  "puxar assunto","bater papo","tirar duvida","pegar leve","dar conta",
]);

/** Universo B1 de portugues: A1+A2 mas los lemas que se abren en B1. */
export function isPortugueseB1Lemma(word: string): boolean {
  const lemma = word.toLowerCase().trim();
  if (PORTUGUESE_B1_LEMMAS.has(lemma)) return true;
  const stripped = lemma.replace(/^(o|a|os|as|um|uma|uns|umas)\s+/, "");
  if (PORTUGUESE_B1_LEMMAS.has(stripped)) return true;
  // La lista va sin diacriticos en la mayoria de sus entradas a proposito (se
  // escribio asi para no depender de como venga acentuada la palabra del
  // cuerpo), asi que la busqueda es insensible al acento en los dos sentidos.
  const sinAcento = lemma.normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (sinAcento !== lemma && indiceSinAcento().has(sinAcento)) return true;
  if (lemma.endsWith("s") && lemma.length > 3) {
    const sing = lemma.slice(0, -1);
    if (PORTUGUESE_B1_LEMMAS.has(sing)) return true;
    const singSinAcento = sing.normalize("NFD").replace(/[̀-ͯ]/g, "");
    if (indiceSinAcento().has(singSinAcento)) return true;
  }
  return false;
}

let _indice: Set<string> | null = null;
function indiceSinAcento(): Set<string> {
  if (_indice) return _indice;
  _indice = new Set<string>();
  for (const w of PORTUGUESE_B1_LEMMAS) {
    _indice.add(w.normalize("NFD").replace(/[̀-ͯ]/g, ""));
  }
  return _indice;
}
