# ISA by Korluz V10.5 — Painel Administrativo

Base: V10.4.

## Painel administrativo
Aparece apenas para usuários com `role = admin`.

Mostra:
- contas cadastradas;
- vendedores ativos;
- vendas registradas;
- carteira registrada;
- comissão prevista;
- passeios de amanhã;
- contratos pendentes;
- horários pendentes;
- última sincronização de cada usuário;
- vendas, passeios, valores, saldos e comissões de cada vendedor, em modo somente leitura.

O administrador também pode:
- bloquear/desbloquear outra conta;
- promover vendedor para administrador;
- rebaixar outro administrador para vendedor.

Por segurança, o próprio administrador logado não pode bloquear ou rebaixar a própria conta.

## Conta da sua esposa
Como já existe uma conta `admin`, o gatilho instalado no Supabase cria novas contas como `seller`.
Depois do primeiro login/sincronização dela, a conta aparece em `👑 Administração`.

## Supabase
Nenhum SQL novo é necessário se o setup V10 já foi executado.
As políticas existentes de `profiles` e `app_state` já permitem leitura administrativa.

## GitHub
Se subir um por um:
1. contrato.html
2. README.md
3. VERSION.json
4. ATACAMA_PRECOS_APLICADOS.json
5. index.html por último
