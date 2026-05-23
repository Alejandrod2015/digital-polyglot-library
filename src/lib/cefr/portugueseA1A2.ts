// Portuguese A1 + A2 lemma frequency list (Brazilian + European).
//
// Source: CAPLE A1/A2 + Routledge frequency dictionary Portuguese
// top-1500. Curated for the practical beginner experience.

export const PORTUGUESE_A1_A2_LEMMAS: ReadonlySet<string> = new Set([
  // Function words
  "o","a","os","as","um","uma","uns","umas","do","da","dos","das","no","na","nos","nas",
  "eu","tu","você","ele","ela","nós","vocês","eles","elas","meu","teu","seu","nosso",
  "este","esta","esse","essa","aquele","aquela","isto","isso","aquilo","outro","mesmo","todo","cada",
  "e","ou","mas","porém","porque","quando","enquanto","se","embora","como","que","qual","quem",
  "em","de","a","com","para","por","sem","sob","sobre","entre","contra","desde","até","após","antes",
  "não","sim","talvez","claro","certo","nunca","sempre","já","ainda","também","só","apenas",
  "aqui","ali","lá","cá","perto","longe","dentro","fora","acima","abaixo","cima","baixo",
  "muito","pouco","mais","menos","bem","mal","quase","tanto","tão",

  // Time
  "dia","noite","manhã","tarde","hora","minuto","segundo","semana","mês","ano","tempo","momento",
  "segunda","terça","quarta","quinta","sexta","sábado","domingo","fim de semana","feriado","férias",
  "janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro",
  "novembro","dezembro","primavera","verão","outono","inverno",
  "hoje","amanhã","ontem","agora","logo","cedo","tarde","depois","antes","já",

  // Family / people
  "família","pai","papai","mãe","mamãe","filho","filha","irmão","irmã","avô","avó",
  "tio","tia","primo","prima","marido","esposa","mulher","homem","criança","menino","menina","bebê",
  "amigo","amiga","namorado","namorada","vizinho","colega","senhor","senhora","pessoa","gente",

  // Body
  "corpo","cabeça","rosto","cara","olho","orelha","nariz","boca","dente","língua","lábio",
  "pescoço","ombro","braço","mão","dedo","unha","peito","costas","barriga","perna","joelho","pé",
  "cabelo","pele","sangue","osso","coração","estômago",

  // Clothes
  "roupa","camisa","camiseta","calça","saia","vestido","casaco","jaqueta","blusa","suéter",
  "sapato","bota","sandália","chinelo","tênis","meia","chapéu","boné","cachecol","luva",
  "cinto","gravata","óculos","anel","relógio","bolsa","mochila","carteira","pijama",

  // Home
  "casa","apartamento","quarto","sala","cozinha","banheiro","corredor","escada","porta","janela",
  "parede","piso","chão","teto","jardim","quintal","sacada","varanda","garagem","sótão","porão",
  "mesa","cadeira","sofá","poltrona","cama","colchão","armário","prateleira","gaveta","cômoda",
  "lâmpada","luz","espelho","quadro","tapete","cortina","almofada","cobertor","lençol","fronha",
  "vela","fósforo","vassoura","aspirador","balde","pano","esponja","sabão","toalha","escova",
  "panela","frigideira","prato","copo","xícara","colher","garfo","faca","guardanapo","bandeja",
  "vidro","jarra","garrafa","frasco","caixa","saco","sacola","caixinha","embalagem",

  // Food / drink
  "comida","café da manhã","almoço","jantar","lanche","refeição","prato",
  "pão","manteiga","geleia","queijo","presunto","ovo","ovos","leite","iogurte","creme",
  "café","chá","água","suco","limonada","cerveja","vinho","refrigerante",
  "maçã","pera","laranja","banana","uva","morango","limão","melancia","melão","abacaxi","manga",
  "tomate","batata","cebola","alho","cenoura","alface","pepino","abóbora","milho","cogumelo",
  "carne","frango","porco","peixe","atum","camarão","arroz","feijão","macarrão","massa",
  "sopa","caldo","salada","sanduíche","pizza","hambúrguer","sorvete","chocolate","biscoito","bolo",
  "açúcar","sal","pimenta","óleo","azeite","vinagre","mel",

  // City / places
  "cidade","vila","rua","avenida","praça","parque","mercado","loja","supermercado","padaria",
  "açougue","farmácia","livraria","barbearia","banco","correio","biblioteca","museu","teatro",
  "cinema","restaurante","café","bar","hotel","hospital","escola","faculdade","universidade",
  "escritório","fábrica","estação","aeroporto","porto","praia","montanha","rio","lago","mar",
  "floresta","mato","campo","fazenda","igreja","catedral","castelo","torre","ponte","prédio",
  "casa","bairro","região",

  // Transport
  "carro","automóvel","bicicleta","bike","moto","motocicleta","ônibus","trem","metrô","táxi",
  "caminhão","barco","navio","avião","viagem","passagem","bilhete","mala","mochila","passaporte",
  "mapa","parada","ponto","estação","estrada","rodovia","semáforo","cruzamento",

  // Nature / weather
  "sol","lua","estrela","céu","nuvem","chuva","neve","vento","gelo","tempestade","trovão",
  "calor","frio","temperatura","tempo","clima","árvore","flor","planta","folha","galho",
  "grama","areia","pedra","rocha","terra","animal","cachorro","cão","gato","pássaro","cavalo",
  "vaca","porco","ovelha","galinha","peixe","rato","mosca","borboleta","abelha","aranha",

  // School / work
  "escola","aula","sala de aula","professor","professora","aluno","aluna","estudante",
  "livro","caderno","caneta","lápis","borracha","régua","mochila","lousa","quadro",
  "tarefa","prova","exame","nota","pergunta","resposta","palavra","frase","letra","número",
  "trabalho","emprego","escritório","empresa","chefe","colega","salário","reunião","relatório",
  "computador","notebook","celular","telefone","tela","teclado","impressora","cabo","bateria",

  // Verbs (top frequency)
  "ser","estar","ter","haver","fazer","ir","vir","ver","ouvir","dizer","falar","saber",
  "poder","querer","dever","conhecer","entender","pensar","acreditar","achar","decidir",
  "viver","morar","nascer","crescer","chegar","sair","entrar","voltar","ficar","permanecer",
  "comer","beber","tomar","cozinhar","preparar","servir","comprar","vender","pagar","custar",
  "abrir","fechar","começar","terminar","acabar","trabalhar","estudar","aprender","ensinar",
  "ler","escrever","escutar","perguntar","responder","contar","explicar","ajudar","procurar",
  "encontrar","achar","perder","ganhar","levar","trazer","colocar","tirar","mover","empurrar",
  "puxar","pegar","segurar","soltar","deixar","dar","mostrar","esconder","receber","mandar",
  "enviar","ligar","desligar","acender","apagar","conectar","carregar","descarregar",
  "lavar","limpar","arrumar","organizar","secar","molhar","cortar","misturar","esquentar","esfriar",
  "andar","caminhar","correr","pular","saltar","nadar","dançar","cantar","jogar","brincar",
  "viajar","visitar","passear","conhecer","cumprimentar","despedir","esperar","chamar",
  "convidar","aceitar","recusar","oferecer","tentar","conseguir","conseguir","escolher","preferir",
  "lembrar","esquecer","gostar","amar","detestar","odiar","precisar","desejar","sentir",
  "respirar","dormir","acordar","levantar","sentar","deitar","vestir","despir","tomar banho",

  // Adjectives
  "bom","mau","ruim","grande","pequeno","alto","baixo","longo","curto","largo","estreito",
  "novo","velho","jovem","caro","barato","fácil","difícil","rápido","lento","forte","fraco",
  "duro","macio","limpo","sujo","cheio","vazio","aberto","fechado","quente","frio","morno",
  "seco","molhado","claro","escuro","brilhante","feliz","triste","cansado","contente","bravo",
  "calmo","tranquilo","nervoso","amigável","gentil","educado","tímido","corajoso","esperto","burro",
  "bonito","feio","atraente","famoso","rico","pobre","magro","gordo",
  "vermelho","azul","verde","amarelo","branco","preto","cinza","marrom","rosa","laranja","roxo",
  "primeiro","segundo","terceiro","último","próximo","seguinte",

  // Numbers
  "zero","um","dois","três","quatro","cinco","seis","sete","oito","nove","dez",
  "onze","doze","treze","quatorze","quinze","dezesseis","dezessete","dezoito","dezenove",
  "vinte","trinta","quarenta","cinquenta","sessenta","setenta","oitenta","noventa","cem",
  "mil","milhão",

  // Abstract common
  "vida","morte","amor","amizade","felicidade","tristeza","medo","alegria","problema","solução",
  "ideia","pergunta","resposta","história","conto","verdade","mentira","sonho","plano","viagem",
  "festa","aniversário","casamento","reunião","encontro","ligação","saúde","doença","dor",
  "remédio","esporte","música","arte","filme","livro","jornal","notícia","cor","forma","tamanho",
]);

export function isPortugueseA1A2(word: string): boolean {
  const lemma = word.toLowerCase().trim();
  if (PORTUGUESE_A1_A2_LEMMAS.has(lemma)) return true;
  const stripped = lemma.replace(/^(o|a|os|as|um|uma|uns|umas)\s+/, "");
  if (PORTUGUESE_A1_A2_LEMMAS.has(stripped)) return true;
  if (lemma.endsWith("s") && PORTUGUESE_A1_A2_LEMMAS.has(lemma.slice(0, -1))) return true;
  return false;
}
