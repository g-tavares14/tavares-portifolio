---
number: 01
title: Três modelos e uma régua boba: dá para prever uma falha de rede 12 minutos antes?
tag: dados
publishedAt: 2026-10-22
excerpt: Queríamos avisar 12 minutos antes que uma conexão vai falhar. Antes do modelo, o difícil foi conseguir os dados.
tldr: Tentamos prever, com 12 minutos de antecedência, quando uma conexão de internet vai falhar. O mais difícil foi conseguir e limpar os dados: a coleta própria esbarrou em limites, e acabamos usando medições públicas que já existiam. O modelo escolhido, uma Random Forest, acertou 84% das previsões no teste e 85% ao vivo, em conexões que nunca tinha visto, contra uns 80% de quem simplesmente aposta que nada vai mudar.
---

## A pergunta dos 12 minutos

Toda conexão de internet tem dias ruins. O ping sobe, pacotes se perdem, e quem cuida da rede costuma descobrir quando o problema já está acontecendo. A pergunta do nosso projeto era: dá para avisar 12 minutos antes que um caminho de rede vai sair do normal e entrar em risco ou em falha?

Foi um projeto acadêmico em grupo, na disciplina de Estrutura de Dados II [confirmar se cita a disciplina, o grupo e a orientadora]. A gente imaginava que a parte difícil seria o modelo, mas o trabalho maior foi conseguir dados bons o bastante para fazer a pergunta.

## Primeira tentativa: medir por conta própria

Os dados vinham do RIPE Atlas, uma rede de pequenos medidores espalhados pelo mundo, as sondas, que fazem pings e guardam os resultados. Pela API do Atlas dá para escolher sondas e destinos e criar a sua própria medição. Era o que a gente queria: controle total sobre o que medir, de onde e com que frequência.

A primeira ideia era medir alguns destinos bem conhecidos, como o 8.8.8.8 e o 1.1.1.1, dois servidores de DNS que todo mundo usa. A série foi recusada pelo limite de medições simultâneas que o Atlas permite. Refizemos o desenho com quatro destinos de perfis diferentes: dois servidores de DNS que deviam ser estáveis, um caminho bem longo e um intermediário.

Aí veio o segundo problema. Medições pontuais servem para testar, mas não formam histórico, e criar medições custa créditos, que eram limitados. Mesmo com uma série periódica, a amostra ficou pequena. No primeiro treino, a parte separada para teste não tinha nenhum caso de falha, apesar de haver falhas nos dados. Sem falha no teste, não tinha como saber se o modelo prevê falhas.

## A saída: medições que já existiam

Chegamos a olhar o PingER, um projeto que guarda medições de ping desde 1998, mas misturar duas fontes diferentes daria outro trabalho inteiro. A saída veio do próprio Atlas: as medições públicas dele ficam disponíveis no BigQuery, o banco de dados do Google, e consultar o que já foi medido não gasta créditos.

A lista de sondas públicas no Brasil tinha 433 nomes, mas isso não queria dizer 433 sondas funcionando. Ficamos com 13 sondas brasileiras que apareciam medindo de verdade e escolhemos seis destinos para comparar distâncias: Brasil, Miami, Portugal, Alemanha, Singapura e Japão. Puxamos 7 dias de medições, de 18 a 25 de setembro de 2026. Isso deu 82 caminhos (uma sonda medindo um destino), e 79 deles tinham medições suficientes para entrar no estudo.

## O normal de cada caminho

Com os dados na mão, veio a primeira decisão importante. Um ping de 340 ms pode ser normal entre o Brasil e a África do Sul e ser um defeito sério entre São Paulo e o Rio. Então não dava para usar um limite fixo para todo mundo. Cada caminho passou a ser comparado com o próprio normal, calculado nos primeiros 4,5 dias de medições dele.

Pensa num termômetro que conhece a temperatura de cada cômodo da casa. Em vez de dizer "está 30 °C", que é quente para um quarto e normal para uma cozinha com o forno ligado, ele diz "está 8 graus acima do normal deste cômodo, e já faz 20 minutos".

Para esse normal usamos a mediana, e não a média, porque os picos que queremos pegar puxam a média para cima até o "normal" engolir o problema. No fim, cada medição virou um punhado de números desse tipo, como o quanto ela está acima do normal e quantas das últimas 5 medições já estavam alteradas. O modelo só vê esses números. Não sabe o país, o endereço nem o ping bruto.

O que ele tenta prever é se, daqui a três medições (uns 12 minutos), o caminho vai estar OK, em RISCO ou em FALHA. Separamos os dados pela ordem do tempo, sem embaralhar: o começo para treinar, um pedaço do meio para comparar os modelos (a validação) e o final, guardado e fechado, para o teste.

## Quando 88% das nossas falhas eram oscilação

As classes OK, RISCO e FALHA vêm de regras que o projeto definia. Uma delas chamava de FALHA qualquer medição muito longe do normal do caminho. Parece razoável, até você olhar os caminhos muito estáveis. Neles, o normal varia tão pouco que uma oscilação de décimos de milissegundo já parecia enorme.

Quando fomos conferir, 88% das "falhas" dessa regra tinham um aumento de ping menor que 30%. Ninguém chamaria isso de falha. A professora liberou colocar um piso, e passamos a exigir também um aumento de pelo menos 30%, o mesmo limite que as regras já usavam para chamar algo de RISCO.

```grafico
efeito-do-piso
```

Com o piso, FALHA passou de quase um quarto dos exemplos para 5,4%. Ficou mais honesta, e também mais rara e mais difícil de prever. Tudo o que vem daqui para frente usa essa definição.

## Três modelos contra uma régua

Um erro comum em machine learning é não comparar o modelo com a alternativa mais boba possível. A nossa régua foi "daqui a 12 minutos vai estar igual a agora". Ela não aprende nada e acerta muito, porque quase sempre a rede está OK e continua OK. Se um modelo não ganha dela, ele não serve para prever.

Contra a régua colocamos três modelos. A árvore de decisão é uma sequência de perguntas de sim ou não, do tipo "o ping subiu mais de 30%?", que dá para ler como regra. Testamos duas versões: uma primeira e uma ajustada. A Random Forest é um grupo de 100 árvores, cada uma treinada num sorteio diferente dos dados, que votam. O XGBoost empilha árvores pequenas, cada uma corrigindo o erro das anteriores. Os modelos candidatos receberam os mesmos dados e as mesmas regras de treino.

## O placar

Para comparar, usamos uma nota de 0 a 1 (o F1 macro) que dá o mesmo peso às três classes. Isso importa porque a régua acerta 81,7% das medições só repetindo o agora. Acertar muito no geral é fácil quando quase tudo é OK; o difícil é acertar a FALHA, que é rara.

```grafico
f1-macro
```

Na validação, todos os modelos ganharam da régua e ficaram muito perto uns dos outros.

```grafico
f1-por-classe
```

Em OK, todo mundo vai bem. A diferença aparece em RISCO e FALHA. A Random Forest achou 299 das 592 falhas e acertou 299 das 407 vezes em que avisou FALHA. Quando avisa, costuma estar certa, mas deixa passar quase metade das falhas.

## O que nenhum modelo conseguiu

O caso mais valioso seria prever o começo de uma falha: o caminho está OK e, 12 minutos depois, está em FALHA. Houve 201 casos assim na validação, e os modelos acertaram entre 16% e 20% deles.

```grafico
inicio-da-falha
```

Onde os modelos vão bem é em acompanhar o que já começou a piorar. Faz sentido: as colunas que a floresta mais usou foram as de histórico, como quantas das últimas medições já estavam alteradas. O que mais avisa o futuro é a tendência dos últimos minutos, mais do que o susto de agora. Uma falha que aparece do nada e some logo não deixa pista antes.

## Por que não escolhemos o modelo com a maior nota

Antes de treinar a floresta e o XGBoost, combinamos como o modelo seria escolhido: entre os que ficassem a até 0,005 da melhor nota, ganharia o mais simples. A ideia era não escolher um modelo mais complicado por uma diferença que pode ser só sorte.

XGBoost (0,701) e floresta (0,698) ficaram dentro dessa faixa; a árvore ajustada ficou de fora. Entre os dois, a floresta é a mais simples, então ela ganhou pela regra, mesmo sem ter a maior nota. Para conferir se a diferença era real, refizemos a conta 2.000 vezes sorteando os caminhos.

```grafico
diferencas-com-intervalo
```

A floresta ganha da régua com folga. Já entre floresta e XGBoost, a faixa cruza o zero: com esses dados, ninguém prova que um é melhor que o outro. Ela também é mais lenta e é uma caixa-preta, enquanto a árvore dá para ler como regra em português. Por isso entregamos a árvore junto.

## A prova que só se faz uma vez

O teste era o trecho mais recente das medições, e ficou fechado o tempo todo. Abrimos uma única vez, em 10 de outubro, com tudo já decidido, e não mexemos em nada depois. Só a floresta e a régua foram medidas.

```grafico
validacao-vs-teste
```

O ganho sobre a régua se manteve: 0,670 contra 0,613. Pela regra que tínhamos combinado, isso faz do modelo um previsor de 12 minutos. A prova é real, mas por pouco.

```grafico
ganho-validacao-vs-teste
```

A surpresa veio nas falhas. Das 1.250 falhas do teste, a floresta achou 477 (38%) e a régua, 539 (43%). Em compensação, a floresta errou muito menos quando avisou: disse FALHA 679 vezes e acertou 477, enquanto a régua disse 1.243 vezes e acertou 539. São uns 200 alarmes falsos contra uns 700. A floresta é mais cautelosa: deixa passar algumas falhas, mas quase não grita à toa. Muitas das falhas que ela perdeu foram classificadas como RISCO, então ela percebeu que algo estava errado e subestimou.

Não investigamos por que o modelo achou menos falhas no teste. O trecho do teste tinha um pouco mais de falhas que a validação, mas não sabemos se é isso.

## No ar por um tempo: caminhos que o modelo nunca viu

Depois do teste, o modelo saiu do notebook. Publicamos um site, hospedado na AWS, com um mapa dos caminhos e uma página para testar o modelo à mão. Por trás, uma API escrita em Go recebia os números de uma medição, devolvia a previsão e guardava o histórico do que já tinha sido perguntado, com documentação aberta para qualquer pessoa chamar o modelo. O site ficou no ar por um período e depois foi desligado [completar: até quando ficou no ar], mas o código inteiro, da coleta à API, está no [repositório do projeto no GitHub](https://github.com/g-tavares14/preditor-de-falhas-ml).

O site também tinha um modo ao vivo, que finalmente respondeu a pergunta que o teste deixou em aberto. Sorteamos 10 sondas em países da América Latina que nunca entraram no treino, medindo os mesmos seis destinos. Para cada caminho novo, o serviço calculava o normal com as 108 horas anteriores, como fizemos no começo, e a partir daí consultava a API pública do Atlas a cada minuto. Cada medição nova ganhava uma previsão na hora, e 12 minutos depois dava para conferir se o modelo tinha acertado. Ele começou a rodar assim em 16 de outubro.

![Tela do modo ao vivo do preditor: um mapa-múndi com linhas das sondas na América Latina até os seis destinos, quadradinhos com a previsão de cada conexão e, ao lado, o placar do modelo contra o palpite simples.](images/ao-vivo.png "preditor · ao vivo · 22/10/2026 | O modo ao vivo em 22/10/2026, por volta das 16h30 (horário de Brasília). O placar da tela cobre outra janela de 24 horas que a do gráfico abaixo, por isso os números diferem um pouco.")

```grafico
ao-vivo
```

Nas 24 horas até 22 de outubro, foram 20.255 medições conferidas em 57 caminhos de sondas no México, Peru, Chile, Venezuela, Costa Rica, Argentina e Colômbia. A nota do modelo foi 0,591, contra 0,556 da régua. E o padrão do teste se repetiu: das 191 falhas, o modelo achou 67 e a régua, 75, mas quando o modelo avisou FALHA ele acertou 67 de 106 vezes, contra 75 de 199 da régua. O começo de falha continua sendo o ponto fraco: houve 65 casos de OK virando FALHA, e o modelo não acertou nenhum.

As notas ao vivo são mais baixas que as da validação, mas a comparação não é direta: é outra região, e lá a falha foi ainda mais rara (menos de 1% das medições). Também é uma janela só, de 24 horas, e não fizemos a conta de margem que fizemos no teste.

## O que fica

Se a gente tivesse que apontar a parte mais difícil do projeto, não seria o modelo. Foi chegar até os dados e deixá-los prontos para uso: a coleta que esbarrou em créditos e limites, a troca de fonte no meio do caminho e a limpeza. Tiramos medições repetidas da tabela de origem, separamos os pings sem resposta (que o Atlas registra como 0 ms) e consertamos uma definição de falha que confundia oscilação com problema. Foram essas as partes que mais desafiaram o grupo.

O modelo cumpriu o que se pedia. No teste final, acertou 84% das previsões, e ao vivo, em sondas que nunca tinha visto, 85%. Só repetir o agora acerta uns 80%, então esses pontos a mais são o ganho real do modelo. E quando ele avisa uma falha, acerta 7 em cada 10 vezes, contra 4 em cada 10 da régua. Para um projeto acadêmico, com 7 dias de dados públicos, é um resultado de que a gente se orgulha.
