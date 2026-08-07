# ISA by Korluz V10.2.4

Duas correções pontuais pedidas depois de usar o app no ar. Testadas
isoladamente (com dados simulados) antes de entrar no `index.html`.

## O que mudou nesta versão

**1. Comissão por passeio agora aparece sempre, sem digitar de novo.**

Achado: o motor de cálculo de comissão (o mesmo que já alimenta a
Auditoria desde a V10.2.3) só gravava o **total da venda**
(`s.commissionCents`). A comissão de cada passeio individual nunca era
atualizada automaticamente — por isso "Minhas vendas", a ficha da venda,
o Financeiro e o CSV sempre mostravam R$ 0,00 na comissão de cada
passeio, mesmo a Auditoria já calculando o valor certo pro mesmo passeio.
Agora o cálculo grava o valor em todos os lugares de uma vez.

*Importante: "Preço do passeio" continua sendo digitado manualmente.*
O app não tem como saber quanto foi cobrado do cliente em cada passeio
específico (só sabe calcular a comissão, que vem do Catálogo) — então
esse campo de preço não muda nesta versão, só o de comissão.

**2. Tocar em "Contrato pendente" já abre o contrato preenchido.**

Antes, gerar contrato com os dados do cliente exigia ir numa tela
separada e escolher o cliente num menu. Agora, tocar diretamente no selo
"Contrato pendente" no card da venda já abre o gerador de contrato com
nome, telefone, e-mail, endereço e valor preenchidos automaticamente.
O selo "Contrato enviado" continua sem ação (não faz sentido reabrir por
ali).

## Publicação

Suba só o `index.html` (substituindo o atual) na raiz do repositório
`Korluz/isa`. Nada mudou no `contrato.html` nem no `VERSION.json` além
do número da versão — não precisa reenviar o `contrato.html`.

## Supabase
Não execute SQL. Nenhum dado do banco será apagado ou modificado.

## Próximas etapas
- Consolidar as versões sobrepostas de `renderAll` (e das outras funções
  reescritas em cascata) em uma única versão linear por função.
- Assistente de IA nativo (consulta em linguagem natural sobre vendas e
  comissões, leitura de voucher por IA, rascunho de mensagens ao cliente).
