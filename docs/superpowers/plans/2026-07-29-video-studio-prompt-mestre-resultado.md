# Resultado — Prompt Mestre do Video Studio

Data: 2026-07-29

Alvo do aceite: **Kavita Drones**, template **Institucional**, 30 segundos, formato 9:16.
As funções puras foram chamadas diretamente (mesmas que a tela `/videos` usa), e o
prompt foi respondido por uma sessão do Claude Code — que é onde a narração vai ser
produzida na prática.

## Critério de aceite da spec

| # | Critério | Status | Evidência |
| - | -------- | ------ | --------- |
| 1 | Prompt do Institucional gerado para a Kavita | ✅ | 7 cenas, 30s, 77 palavras de orçamento total |
| 2 | Narração voltou dentro do orçamento de palavras | ✅ | **0 de 7 cenas estouraram**; 68 palavras escritas contra 77 de teto |
| 3 | `videobrief.json` valida no zod sem ajuste manual | ✅ | `VideoBriefSchema.parse` passou no arquivo baixado, sem edição |
| 4 | `next build` do web passa com o `transpilePackages` | ✅ | rota `/videos` sai com 15 kB / 216 kB de First Load; middleware 34,3 kB |

### Orçamento cena a cena

| cena | tipo | duração | orçamento | escrito |
| ---- | ---- | ------- | --------- | ------- |
| sc1 | notebook | 3s | 8 | 7 |
| sc2 | google | 5s | 13 | 11 |
| sc3 | hero | 6s | 15 | 14 |
| sc4 | sobre | 5s | 13 | 13 |
| sc5 | servicos | 6s | 15 | 13 |
| sc6 | formulario | 3s | 8 | 5 |
| sc7 | whatsapp | 2s | 5 | 5 |
| **total** | | **30s** | **77** | **68** |

O orçamento de palavras funcionou como controle: o modelo ficou abaixo do teto em
todas as cenas, sem nenhuma instrução de tempo no prompt. Era exatamente a hipótese —
pedir "não ultrapasse 30 segundos" não funciona, pedir "13 palavras" funciona.

## O que o prompt ainda erra

**O template Institucional termina numa cena de 2 segundos, e isso briga com a regra
fixa do prompt.** A última cena é o WhatsApp (2s, 5 palavras), e a regra manda
"termine convidando a acessar o site". Não cabem as duas ideias — provar que a
mensagem chegou E convidar — em cinco palavras. O modelo teve que escolher, e jogou a
prova do WhatsApp para a legenda.

O bloco de crítica funcionou: sem ser induzido, o modelo apontou isso e mais duas
coisas, e propôs remanejamento de segundos.

> - A cena do WhatsApp tem 2 segundos, e é ela que fecha o vídeo. Não cabe provar que
>   a mensagem chegou e ainda convidar a acessar o site — são duas ideias em cinco palavras.
> - O formulário com 3 segundos é apertado para mostrar campos sendo preenchidos; ou
>   vira só um relance, ou o espectador não entende o que aconteceu.
> - Sugestão: tirar 2s do Sobre e 1s dos Serviços e devolver ao formulário e ao WhatsApp.

**Ação sugerida, não aplicada:** rebalancear o Institucional para
`notebook 3 · google 5 · hero 6 · sobre 3 · servicos 5 · formulario 5 · whatsapp 3`
(soma 30s) e considerar acrescentar uma cena `logo` no fim, que é quem deveria carregar
o convite. Fica para uma rodada de ajuste dos templates, com o custo de rever a tabela
e o teste que a trava.

## Narração produzida (referência)

```json
{
  "narracao": [
    { "sceneId": "sc1", "texto": "A Kavita Drones agora tem site novo." },
    { "sceneId": "sc2", "texto": "Pesquise Kavita Drones no Google ou digite kavita.com.br direto no navegador." },
    { "sceneId": "sc3", "texto": "Logo na entrada você vê o que a Kavita faz: drones para o agronegócio." },
    { "sceneId": "sc4", "texto": "Na seção Sobre, quem é a empresa e como ela trabalha no campo." },
    { "sceneId": "sc5", "texto": "Em Serviços estão os equipamentos e o suporte disponíveis, organizados para comparar rápido." },
    { "sceneId": "sc6", "texto": "Preencha o formulário e envie." },
    { "sceneId": "sc7", "texto": "Acesse kavita.com.br e fale conosco." }
  ]
}
```

Nenhum fato do negócio foi inventado — sem prêmio, sem número de clientes, sem
telefone e sem endereço. A trava do prompt segurou.

## O que este aceite NÃO prova

- Não existe vídeo. Isto é narração e timeline em texto; falta o crawler (para as
  imagens e as caixas de zoom), o compilador `VideoBrief + Snapshot → VideoProject`,
  as cenas de estúdio em React e o render no Remotion.
- Não foi medido tempo real de fala. 2,5 palavras/segundo é uma estimativa de ritmo
  comercial em PT-BR; só a primeira narração gerada em áudio vai dizer se o número
  está certo. Se estiver errado, é uma constante num lugar só (`PALAVRAS_POR_SEGUNDO`
  em `build-brief.ts`).
