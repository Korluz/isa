# Guia Mestre do ISA

> **Documento de continuidade e fonte de verdade do projeto**  
> Atualizado em **05/09/2026**
> Versão em produção no momento desta edição: **ISA V11.1.1**

---

## 1. Como usar este guia

Este arquivo existe para permitir que o desenvolvimento do ISA continue em qualquer conversa futura sem depender do histórico completo do chat.

Antes de alterar o sistema em uma nova conversa:

1. Ler este `GUIA_MESTRE_ISA.md`.
2. Ler `VERSION.json` para confirmar a versão atualmente publicada.
3. Inspecionar os arquivos envolvidos na mudança antes de editar.
4. Preservar tudo que já funciona e evitar reescrever fluxos aprovados sem necessidade.
5. Validar JavaScript antes de publicar.
6. Confirmar o deploy final do GitHub Pages antes de anunciar uma versão como online.

**Regra principal:** o ISA já está em uso real. Novas mudanças devem ser incrementais, compatíveis e de baixo risco.

---

## 2. Identidade do produto

**Nome:** ISA — Indômito Seller Assistant  
**Repositório:** `Korluz/isa`  
**Produção:** `https://korluz.github.io/isa/`

O ISA nasceu como um assistente pessoal para vendedor de turismo e evoluiu para uma pequena plataforma operacional que conecta:

**venda → operação → contrato → assinatura → horários → cliente → financeiro**

O sistema deve continuar com linguagem simples, visual elegante, uso rápido e foco em situações reais da rotina de vendas de turismo.

### Princípios de produto

- Mobile-first, mas confortável no desktop.
- Não duplicar cadastros ou fluxos quando uma fonte de dados já existe.
- Automatizar o que é repetitivo sem esconder do vendedor o que aconteceu.
- Manter rastreabilidade: cancelamentos, comissões e assinaturas não devem simplesmente “sumir”.
- Preferir ações reversíveis quando possível.
- Evitar alertas genéricos do navegador quando uma interface orgânica do ISA puder ser usada.
- Recursos novos devem economizar tempo, reduzir erro ou melhorar a experiência do vendedor/cliente.

---

## 3. Arquitetura atual

### Frontend

- GitHub Pages.
- Aplicação principal em `index.html`, historicamente monolítica.
- Funcionalidades recentes entram por scripts externos pequenos e específicos, reduzindo risco de regressão no núcleo.
- Há páginas públicas auxiliares como `contrato.html` e `viagem.html`.
- `VERSION.json` informa a versão e as notas resumidas da release.

### Backend

- Supabase para autenticação, perfis, sincronização do estado, assinaturas e recursos públicos controlados.
- O frontend usa apenas credencial pública/publishable.
- **Nunca expor ou solicitar service-role/secret no frontend ou no repositório.**

### Persistência principal

O estado operacional do vendedor é salvo em `app_state`, associado ao usuário. O objeto contém vendas e os demais dados da aplicação.

Arquivos/anexos podem usar Storage privado.

### Segurança

- RLS e funções controladas no Supabase.
- Links públicos usam tokens próprios e não devem expor `app_state` inteiro.
- Portal do cliente e assinatura remota devolvem apenas dados autorizados daquele token/solicitação.

---

## 4. Autenticação, contas e papéis

Papéis existentes:

- **seller** — vendedor.
- **admin** — administrador.

Identificação especial:

- **is_owner** — marca exclusiva do administrador proprietário. Não substitui o papel `admin`; acrescenta proteção à conta principal e permite manter vários administradores simultâneos.

### Administração

O painel de Administração permite:

- abrir diretamente uma visão gerencial no acesso do administrador;
- filtrar indicadores por período, vendedor, passeio e situação;
- acompanhar faturamento, recebimentos, saldo, volume, cancelamentos, ticket médio e comissão;
- comparar automaticamente o período selecionado com o período anterior equivalente;
- consultar rankings de passeios e desempenho da equipe;
- gerar relatórios gerenciais em PDF e Excel;
- visualizar contas e atividade operacional;
- selecionar vendedor e consultar seu estado de forma administrativa;
- bloquear/desbloquear conta;
- promover vendedor a administrador;
- rebaixar outro administrador para vendedor;
- definir uma nova senha para outro usuário;
- resetar uma conta operacionalmente;
- excluir uma conta completamente.

Proteções:

- administrador não deve conseguir bloquear a própria conta;
- administrador não deve conseguir se rebaixar acidentalmente;
- administrador nunca visualiza a senha atual de qualquer usuário;
- troca administrativa de senha deve ocorrer somente no servidor, sem chave administrativa no frontend;
- administrador não deve conseguir resetar/excluir a própria conta pelos botões comuns;
- somente uma conta pode possuir `is_owner = true`;
- outros administradores não podem rebaixar, bloquear, resetar, excluir nem redefinir a senha do administrador proprietário;
- a propriedade não pode ser atribuída, removida ou transferida pelo frontend;
- exclusão exige confirmação forte.

### Comportamento de autenticação — V11.0.12–V11.1.1

- login e cadastro bloqueiam novos cliques enquanto a requisição está em andamento;
- erros conhecidos do Supabase são traduzidos para orientações claras em português;
- ao atingir o limite de e-mails do provedor, o cadastro entra em espera local por uma hora para evitar novas tentativas inúteis;
- “Esqueci minha senha” aceita somente uma requisição por vez, impõe intervalo mínimo após falhas e, após o envio, mantém espera local de uma hora mesmo se a página for recarregada;
- campos de senha permitem mostrar ou ocultar o conteúdo digitado;
- a troca administrativa define somente uma senha nova e não confirma automaticamente um e-mail ainda pendente;
- a Edge Function consulta os perfis no contexto do administrador autenticado e reserva a chave de serviço somente para a atualização no Auth;
- um vendedor não pode alterar os próprios campos de papel ou acesso para se promover, desbloquear ou mudar de status.

### Resetar x excluir

**Resetar conta:** mantém o login, mas substitui o estado operacional por um estado vazio e remove dados vinculados que devam ser reiniciados.

**Excluir conta:** remove o usuário de Auth e os dados relacionados por cascata quando configurado.

---

## 5. Estrutura funcional do ISA

Menu principal consolidado:

- Importar Voucher
- Meu dia
- Minhas vendas
- Amanhã
- Cancelados
- Central de horários
- Validador
- Financeiro
- Contratos
- Auditoria de comissões
- Configurações
- Administração (somente admin)

---

## 6. Importação de voucher

### Objetivo

Transformar o PDF de voucher em uma venda pronta para conferência, reduzindo digitação manual.

### Compatibilidade obrigatória

O ISA deve manter compatibilidade com:

- modelo antigo de voucher;
- modelo novo de voucher;
- variações do modelo novo em que a tabela do PDF quebra textos em múltiplas linhas.

### V11.0.7 — parser robusto

O parser novo passou a montar serviços por blocos em vez de depender de uma única linha/regex rígida. Isso é importante porque PDFs reais podem separar:

- data;
- aeroporto/voo;
- nome do serviço;
- quantidade de passageiros;
- valores;
- status.

Ele deve reconhecer nomes de passeios mesmo quando quebrados em linhas diferentes.

Também deve reconhecer:

- `TRANSFER IN`;
- `TRANSFER OUT`;
- variantes como `Transfer in` / `Transfer out` e textos com aeroporto/voo ao redor.

O parser anterior deve permanecer como **fallback**.

### Dados que o importador tenta preencher

- número da reserva/file;
- comprador/cliente;
- telefone;
- vendedor;
- passageiros;
- documentos/CPF quando presentes;
- ADT/CHD/INF;
- serviços/passeios;
- datas;
- valores individuais;
- ponto de encontro/hotel/endereço;
- total da venda;
- valor pago;
- forma/data do pagamento quando disponível.

Nunca inventar dado que o voucher não contém. E-mail, por exemplo, pode permanecer vazio.

### CPF e máscaras

Quando houver CPF válido de passageiro compatível com o titular/cliente, o sistema pode inferi-lo para o contrato.

Campos numéricos relevantes devem ser apresentados com máscara adequada, incluindo CPF, telefone, data e CEP.

---

## 7. Passeios e transfers

Passeios e transfers usam a mesma estrutura operacional básica.

Cada serviço pode conter:

- nome;
- data;
- horário;
- local/coleta;
- quantidade de passageiros;
- mensagem logística;
- status ativo/cancelado;
- confirmação/envio;
- valor;
- comissão.

### Transfers

Desde V11.0.5 existem serviços de primeira classe:

- 🚐 `TRANSFER IN`
- 🚐 `TRANSFER OUT`

Eles participam de:

- Amanhã;
- Central de horários;
- Validador;
- cancelamento/reativação;
- contratos;
- Minha Viagem;
- Auditoria de comissões.

### Comissão dos transfers — V11.0.8

Regra oficial atual:

**TRANSFER IN / TRANSFER OUT = 5% do valor do próprio serviço.**

Exemplo: transfer de R$ 259,00 → comissão de R$ 12,95.

A regra vale para:

- serviço importado de voucher;
- serviço lançado manualmente.

Na Auditoria, como a regra não é por passageiro, as colunas de comissão ADT/CHD podem aparecer com `—` e a coluna de comissão do serviço recebe o valor percentual calculado.

---

## 8. Cancelamento e reativação

Um passeio pode ser marcado como cancelado nos alertas/ficha.

Desde a V11.1.0, todo **novo cancelamento** deve registrar um motivo estruturado. As opções iniciais são:

- desistência do cliente;
- falta de pagamento;
- condições climáticas;
- cancelado pelo operador;
- erro de cadastro;
- mudança de data;
- duplicidade;
- outro, com descrição obrigatória.

Cancelamentos históricos sem motivo continuam preservados e aparecem nos relatórios como **“Não informado (registro anterior)”**. A atualização não deve inventar motivos retroativamente.

Se marcado por engano, pode ser reativado na ficha da venda alterando a situação para **Ativo** e salvando.

A reativação deve devolver o serviço aos fluxos operacionais aplicáveis.

### Auditoria de cancelados — V11.0.6

Cancelamento não apaga o histórico financeiro.

Na Auditoria:

- ativos e cancelados aparecem por padrão;
- cancelado recebe status **Cancelado**;
- a comissão que existiria permanece visível, mas **riscada**;
- comissão cancelada **não entra no total**;
- filtro “Somente cancelados” deve resultar em total de comissão efetiva igual a R$ 0,00.

PDF e Excel devem refletir a mesma lógica.

---

## 9. Meu dia e Alertas Inteligentes

O Meu dia funciona como painel de prioridades comerciais e operacionais.

Alertas podem apontar situações como:

- confirmação/cancelamento de passeio;
- pagamentos;
- contratos;
- horários pendentes;
- tarefas operacionais próximas.

A filosofia é mostrar **o que precisa de ação**, não apenas métricas decorativas.

Mudanças em status feitas pelos alertas devem refletir na venda e nos demais módulos.

---

## 10. Amanhã, Central de Horários e Validador

### Central de Horários

A equipe/vendedor pode colar a mensagem recebida da logística. O ISA tenta relacionar com o passeio e salva informações como:

- `hour`;
- `location`;
- mensagem logística completa;
- data/origem da informação.

Essa é a **fonte única de horário** usada também pelo portal do cliente. Não criar um segundo cadastro paralelo.

### Validador

Compara a mensagem da logística com os dados esperados da venda.

Deve validar, quando disponível:

- passeio;
- data;
- passageiros;
- hotel/coleta;
- demais dados essenciais.

Para passeios com **ticket obrigatório**, a V11.0.11 acrescenta a conferência do arquivo anexado:

- lê PDFs com camada de texto;
- usa OCR no navegador como apoio para imagens ou PDFs digitalizados;
- compara a data de uso do ticket com a data do passeio;
- compara o horário do ticket com o horário da mensagem quando houver horário identificável;
- diferencia data de uso de datas administrativas, como emissão ou compra;
- mostra **NÃO ENVIAR** quando houver divergência ou quando o ticket obrigatório não puder ser conferido;
- mantém os arquivos no bucket privado, acessíveis pela sessão autenticada já existente.

Passeios sem ticket mantêm o fluxo anterior. A atualização não cria uma segunda fonte de horário nem exige migração de banco.

Regras importantes já corrigidas:

- se a venda espera **0 CHD** e a mensagem não menciona criança, interpretar como 0, não como erro;
- aceitar formatos como `A partir de 12 anos (ADT): 2`;
- comparação de coleta deve aceitar correspondência por **hotel ou endereço**, evitando falso positivo de divergência por formatação.

Quando há divergência essencial, o sistema pode sinalizar **NÃO ENVIAR**.

---

## 11. Contratos e assinatura eletrônica remota

### Fluxo recomendado atual

1. Abrir contrato preenchido a partir da venda.
2. Conferir os dados.
3. Se necessário, gerar o **PDF para conferência** antes da assinatura.
4. Criar o link exclusivo de assinatura remota.
5. Enviar o link ao cliente pelo WhatsApp.
6. Voltar ao ISA.
7. Cliente abre o link e assina no próprio celular.
8. Em Contratos, acompanhar o status.
9. Abrir o contrato assinado.
10. Gerar o **PDF assinado final** para arquivar ou enviar.

O PDF pré-assinatura é opcional e recebe, em todas as páginas, a marca **“CÓPIA PARA CONFERÊNCIA — NÃO ASSINADA”**. Ele permite ao cliente revisar o conteúdo, mas não substitui o link de aceite e assinatura.

O PDF final assinado só é liberado quando o ISA valida, em conjunto, a assinatura eletrônica, a data do aceite e o protocolo da solicitação. Os arquivos também usam nomes diferentes para reduzir o risco de envio da versão errada.

### Evidências

O fluxo registra elementos como:

- data/hora;
- protocolo;
- hash/integridade do conteúdo;
- aceite;
- assinatura desenhada;
- status da solicitação.

### Precisão jurídica de nomenclatura

O recurso é uma **assinatura eletrônica com trilha de evidências**.

Não chamar automaticamente de “certificado digital ICP-Brasil do cliente”. Integração ICP-Brasil seria uma evolução futura específica.

### Exclusão de testes

Em Acompanhamento de assinaturas existe opção de excluir registro de teste, com confirmação forte. A exclusão não deve ocorrer por toque único.

---

## 12. Portal do Cliente — Indômito • Minha Viagem

Criado na V11.0.0.

Objetivo: permitir que o cliente acompanhe sua própria viagem por link, sem criar conta no ISA.

Formato conceitual:

`viagem.html?token=...`

### O cliente pode ver

- serviços da própria reserva;
- datas;
- status;
- horário quando publicado;
- ponto de encontro/coleta;
- mensagem/instruções logísticas;
- botão de mapa quando aplicável.

### Ciência do horário

O cliente pode confirmar:

**“Estou ciente do horário e informações”**

O ISA registra visualização e ciência para a equipe acompanhar.

### Atualização automática

O mesmo link deve refletir novos horários salvos na Central de Horários. Não é necessário gerar outro link a cada atualização.

### Segurança

- token longo e aleatório;
- banco guarda hash quando aplicável;
- acesso somente à reserva vinculada;
- não expor `app_state` diretamente;
- nova geração pode revogar o link anterior;
- validade inicial definida em 180 dias.

---

## 13. Financeiro

O Financeiro consolida valores e comissões do vendedor.

Deve permanecer separado da Auditoria quando os objetivos forem diferentes:

- **Financeiro:** visão gerencial do vendedor.
- **Auditoria:** detalhe por serviço e regra aplicada.

### Indicadores de impacto — implementados na V11.0.9

A V11.0.9 adicionou indicadores motivacionais e históricos:

- clientes atendidos;
- passageiros atendidos;
- serviços/passeios vendidos;
- comissão do mês;
- **comissão acumulada desde o início**;
- eventualmente vendas acumuladas.

Diferença conceitual:

- clientes atendidos = titulares/compradores únicos conforme regra definida;
- passageiros atendidos = pessoas/pax beneficiados pelas vendas.

Mensagem motivacional sugerida:

**“Você já ajudou X pessoas a viver experiências incríveis ✨”**

Esse bloco deve ser inspirador sem perder precisão dos números.

---

## 14. Auditoria de comissões

Mostra, por serviço:

- data;
- voucher;
- cliente;
- passeio/serviço;
- ADT/CHD;
- valor da venda/serviço conforme estrutura atual;
- regra aplicada;
- comissão calculada;
- status.

Regras específicas existentes incluem comissões fixas por passageiro para passeios do catálogo, casos especiais e comissão percentual para transfers.

### Exportação

#### PDF

- A4 paisagem;
- identificação discreta ISA;
- vendedor;
- período/filtros;
- data e hora da emissão;
- total de comissões efetivas;
- cancelados preservados visualmente e fora do total.

#### Excel

Exportação real `.xlsx`, não CSV disfarçado.

Deve conter:

- cabeçalho ISA;
- data/hora de geração;
- vendedor;
- período/filtros;
- colunas dimensionadas;
- datas formatadas;
- valores monetários;
- filtro no cabeçalho;
- total correto;
- identificação de cancelados.

### Central de Inteligência e Relatórios Gerenciais — V11.1.0

A área Administração possui uma camada gerencial somente de leitura sobre os estados já autorizados pelo Supabase. Ela não altera a separação dos dados por vendedor e não usa chave administrativa no frontend.

Filtros disponíveis:

- data inicial e final;
- vendedor;
- passeio;
- situação ativa/cancelada.

KPIs iniciais:

- faturamento efetivo;
- valor recebido;
- saldo a receber;
- vendas;
- passeios ocorridos, definidos como serviços cuja data já chegou e que não estão cancelados;
- passeios futuros;
- cancelamentos e taxa de cancelamento;
- faturamento perdido em cancelamentos;
- ticket médio por venda ativa;
- comissão prevista.

Regras de leitura:

- o período considera a data de cada passeio;
- o faturamento por produto usa o preço individual do serviço, evitando duplicar o total de pacotes com vários passeios;
- passeios cancelados ficam fora do faturamento efetivo e permanecem no histórico como faturamento perdido;
- “mais cancelado” deve sempre mostrar quantidade e taxa proporcional;
- “menor faturamento” deve ser lido junto com o volume vendido;
- quando uma venda possui vários passeios, o valor recebido é distribuído proporcionalmente ao preço de cada serviço para fins gerenciais.

Relatórios iniciais:

- desempenho dos passeios;
- cancelamentos e motivos;
- vendas e recebimentos;
- desempenho dos vendedores.

Todos respeitam os filtros da Central de Inteligência e podem ser gerados em PDF ou Excel real `.xlsx`.

---

## 15. Atualizações automáticas e “O que mudou”

O ISA consulta `VERSION.json` para detectar versão mais recente.

Quando existe atualização, mostra um aviso orgânico como:

**🚀 Nova versão disponível — Atualizar agora**

Após atualizar, o usuário recebe um modal integrado ao visual do ISA:

**✨ ISA atualizado — O que mudou**

O modal:

- usa as notas de versão;
- resume 4–5 mudanças;
- aparece uma vez por versão;
- não deve reaparecer toda vez que abrir o sistema.

Esse fluxo foi validado em uso real.

---

## 16. Tela inicial e experiência visual

A home possui carrossel/hero com imagens de turismo.

### Carrossel expandido — implementado na V11.0.9

O carrossel foi ampliado de 3 para **10 imagens**, mantendo qualidade e coerência visual.

Misturar cenários como:

- Santiago;
- Valle Nevado/Farellones;
- Viña del Mar/Valparaíso;
- vinícolas;
- transfers;
- Atacama;
- deserto/lagoas/astronômico;
- experiências de viagem.

Objetivo: tornar o ambiente mais inspirador para quem vende turismo e aumentar repertório visual sem distrair do trabalho.

---

## 17. Pílula instrutiva / Insight do dia

### Recurso implementado na V11.0.9

A V11.0.9 adicionou um card/modal orgânico, visualmente compatível com “O que mudou”, exibido **uma vez por dia** no primeiro acesso relevante.

Nome possível:

- **💡 Insight do dia**
- **✨ Pílula de venda**

### Objetivo

Ensinar algo curto, útil e aplicável no trabalho do vendedor no mesmo dia.

Não deve virar frase motivacional genérica.

### Temas sugeridos

- abordagem;
- descoberta de necessidade;
- venda consultiva;
- objeções;
- fechamento;
- follow-up;
- WhatsApp;
- prova social;
- urgência legítima;
- ancoragem;
- reciprocidade;
- SPIN;
- upsell/cross-sell;
- pós-venda;
- indicação;
- NPS;
- organização comercial;
- experiência do cliente.

### Formato recomendado

Título curto + 2 ou 3 linhas + ação prática opcional.

Exemplo conceitual:

**💡 Venda o resultado, não o passeio**  
Descubra primeiro o que o cliente quer sentir: neve, descanso, aventura, vinho ou família. Depois conecte o passeio a esse desejo.  
**Hoje:** faça uma pergunta antes de recomendar.

### Evolução inteligente

Sempre que possível, algumas pílulas podem considerar o contexto do ISA:

- pagamento pendente → dica de follow-up;
- passeio amanhã → dica de pós-venda;
- muitos contratos pendentes → dica de redução de atrito;
- cliente ainda não abriu horário → dica operacional/comunicação.

Biblioteca futura sugerida: **100–150 pílulas**, próprias e adaptadas a vendas de turismo.

Evitar depender excessivamente de citações famosas e atribuições duvidosas.

---

## 18. Configurações e catálogo

O catálogo permite manter regras e serviços usados pelo sistema.

Mudanças de catálogo devem respeitar vendas antigas e nomes já persistidos.

Normalizações de nome são importantes para reconhecer variações sem destruir o texto original quando ele for útil ao usuário.

Transfers aparecem visualmente com 🚐.

---

## 19. Deploy e disciplina de atualização

### Produção

Branch principal: `main`.

O deploy passa por GitHub Actions e GitHub Pages.

### Procedimento recomendado para toda versão

1. Inspecionar versão atual e arquivos afetados.
2. Fazer mudança mínima.
3. Criar script/patch separado quando isso reduzir risco.
4. Rodar `node --check` nos scripts relevantes.
5. Validar scripts inline de `index.html`, `contrato.html` e `viagem.html` quando afetados.
6. Atualizar `VERSION.json` com:
   - versão;
   - nome da release;
   - `basedOn`;
   - necessidade ou não de migration;
   - lista curta de features.
7. Commitar.
8. Confirmar workflow de deploy com `success`.
9. Confirmar GitHub Pages com `success`.
10. Só então informar ao usuário que está online.

### Versionamento

Usar incrementos pequenos para hotfixes e melhorias incrementais.

Exemplo da sequência recente:

- 11.0.0 — Minha Viagem / Portal do Cliente
- 11.0.1 — hotfix PDF da Auditoria
- 11.0.2 — Excel real + correção de variável global
- 11.0.3 — contrato/validador/exclusão de teste
- 11.0.4 — relatórios profissionais + “O que mudou”
- 11.0.5 — TRANSFER IN/OUT
- 11.0.6 — comissão cancelada com histórico
- 11.0.7 — leitor robusto de voucher multilinha
- 11.0.8 — comissão de 5% nos transfers
- 11.0.9 — experiência visual, impacto e Insight do dia
- 11.0.10 — PDF para conferência e PDF final assinado
- 11.0.11 — conferência automática de data e horário dos tickets no Validador
- 11.0.12 — autenticação protegida e nova senha definida com segurança pelo administrador
- 11.0.13 — recuperação de senha protegida contra cliques repetidos e reenvios
- 11.0.14 — correção da sobreposição no menu lateral de desktops com pouca altura
- 11.0.15 — correção da autorização interna na troca administrativa de senha
- 11.1.0 — Central de Inteligência, KPIs, rankings, relatórios gerenciais e motivos de cancelamento
- 11.1.1 — múltiplos administradores com proteção integral da conta do administrador proprietário

---

## 20. Regras de manutenção importantes

- Não remover o parser antigo de voucher.
- Não criar uma segunda fonte de horário fora da Central de Horários.
- Não transformar cancelamento em apagamento silencioso do histórico.
- Não tratar assinatura eletrônica como ICP-Brasil sem integração específica.
- Não colocar secrets do Supabase no repositório/frontend.
- Não quebrar sessão/autenticação tentando acessar variáveis privadas como globais.
- Não assumir que PDF mantém texto em uma linha; parsers devem tolerar quebras.
- Não anunciar deploy antes do Pages concluir.
- Não alterar grandes trechos do `index.html` se um patch pequeno resolver.
- Em produção, preferir correções cirúrgicas.

---

## 21. Checklist rápido de regressão

Após mudança relevante, testar pelo menos:

### Login
- entrar;
- sessão persistir;
- bloqueio funcionar;
- cliques repetidos não criarem requisições duplicadas;
- cliques repetidos em “Esqueci minha senha” gerarem somente um pedido de recuperação;
- erros de credencial e confirmação aparecerem em português;
- administrador conseguir definir uma nova senha para outra conta de teste;
- vendedor não conseguir alterar o próprio papel ou status;
- seller não ver Administração.

### Voucher
- modelo antigo;
- modelo novo;
- voucher com serviço multilinha;
- passageiros;
- valores;
- hotel/coleta;
- transfer in/out.

### Venda
- abrir ficha;
- editar;
- cancelar;
- exigir motivo estruturado em todo novo cancelamento;
- reativar;
- salvar/sincronizar.

### Operação
- Amanhã;
- Central de Horários;
- Validador;
- mensagem com 0 CHD omitido;
- hotel/endereço.

### Financeiro
- comissão normal;
- transfer 5%;
- cancelado fora do total.

### Relatórios
- Auditoria na tela;
- PDF com linhas;
- Excel `.xlsx` formatado.
- Central de Inteligência restrita ao administrador;
- filtros por período, vendedor, passeio e situação;
- cancelados fora do faturamento efetivo e dentro do histórico;
- quantidade e taxa proporcional nos rankings de cancelamento;
- relatórios de passeios, cancelamentos, vendas e vendedores em PDF e Excel.

### Contrato
- abrir preenchido;
- gerar PDF para conferência com marca de documento não assinado;
- criar link;
- assinar remotamente;
- abrir assinado;
- gerar PDF final somente após validar assinatura, aceite e protocolo;
- excluir registro de teste.

### Minha Viagem
- gerar link;
- abrir sem login;
- atualizar horário;
- confirmar ciência;
- conferir que outro cliente não é acessível.

### Atualização
- detectar nova versão;
- atualizar;
- mostrar “O que mudou” uma vez.

---

## 22. Próximo marco estratégico

Com a **V11.1.1 publicada**, o próximo marco do ISA é validar a Central de Inteligência com o uso real e consolidar a qualidade dos dados que alimentarão decisões gerenciais.

Prioridades iniciais:

1. conferir, com dados reais, se os conceitos de faturamento, passeio ocorrido e taxa de cancelamento correspondem à leitura da gestão;
2. começar a registrar motivos de cancelamento de forma consistente;
3. avaliar metas, margem/custo e comparações adicionais somente depois da validação dos indicadores iniciais;
4. planejar a migração gradual dos relatórios para tabelas normalizadas quando volume e histórico justificarem;
5. manter compatibilidade com os fluxos atuais e registrar cada decisão relevante neste guia e no `VERSION.json`.

O ISA continua sendo a implementação operacional de vendas em produção. A evolução da plataforma-mãe Fariom permanece tratada separadamente, sem misturar mudanças estruturais neste fluxo de manutenção online.

---

## 23. Direção de produto

O ISA não deve virar um ERP genérico. A vantagem dele está em entender profundamente o trabalho do vendedor de turismo.

A evolução mais valiosa é aquela que aproxima três coisas:

1. **eficiência operacional** — menos copiar/colar, menos erro;
2. **clareza financeira** — comissão e histórico confiáveis;
3. **experiência humana** — vendedor motivado e cliente bem informado.

O Portal Minha Viagem mostrou que o ISA pode ultrapassar o uso interno sem exigir conta do cliente. A pílula diária e os indicadores de impacto podem fazer o mesmo pelo lado do vendedor: o sistema deixa de apenas registrar trabalho e passa a **ajudar a pessoa a trabalhar melhor**.

---

## 24. Prompt de retomada para uma nova conversa

Ao iniciar uma nova conversa, pode-se dizer:

> **“Vamos continuar o ISA. Leia primeiro o arquivo `GUIA_MESTRE_ISA.md` e o `VERSION.json` do repositório `Korluz/isa`. Eles são a fonte de verdade. Depois confirme a versão atual antes de propor ou publicar qualquer mudança.”**

Depois disso, a conversa pode seguir diretamente para a próxima demanda.

---

## 25. Estado final desta edição

**Produção confirmada:** V11.1.1

**Última melhoria publicada:** múltiplos administradores com Lucas identificado como administrador proprietário e protegido no banco e na interface.

**Próximo marco:** validar os indicadores com dados reais e evoluir a qualidade analítica sem interromper a operação atual.

**Estratégia:** evolução incremental, validação antes de deploy e manutenção orientada por uso real.
