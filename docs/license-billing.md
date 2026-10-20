# Cobranças de licenças

- A licença controla acesso ao módulo; cada contrato guarda período, mensalidade integral e dia de vencimento.
- Novos contratos geram um lançamento por ciclo mensal iniciado, ancorado no dia original, com fim inclusivo. Ex.: 15/11–14/02 gera 3; incluir 15/02 inicia o quarto ciclo. Limite operacional: 120 ciclos.
- Competência é o mês de início do ciclo. Vencimento é a próxima ocorrência do dia escolhido a partir desse início; dias 29–31 são limitados ao último dia do mês. A prévia mostra todas as datas antes da confirmação.
- A renovação é contígua (início no dia seguinte ao fim anterior). O acesso vigente é mantido quando a renovação é antecipada; o histórico não é apagado.
- Contratos emitidos têm dados financeiros imutáveis. Edição da licença altera seu status. Ajustes individuais de cobrança sem recebimento e novas condições na renovação ficam auditados.
- Cancelar/suspender a licença não cancela dívidas automaticamente. Cancelamento de cobrança requer justificativa e ausência de recebimentos ativos.
- Recebimentos são lançamentos separados, com identificador único para repetição segura, valor, data, forma, referência documental e autor. Parcial mantém o saldo; estorno preserva o lançamento e exige motivo.
- A central /cobrancas distingue competência e recebimento efetivo no mês. O filtro de atrasadas anteriores exibe competências anteriores ao mês selecionado ainda vencidas na data atual de São Paulo.
- A migração preserva datas, valores e status das 24 parcelas existentes. Os contratos antigos ficam marcados como legado; não são recalculados. O campo valor_anual permanece apenas para compatibilidade (novos contratos: mensalidade × 12, não o total contratado).
- O total exibido do contrato corresponde à soma das cobranças não canceladas do último contrato. As parcelas anteriores permanecem na central.
- RPCs são SECURITY INVOKER, disponíveis apenas a service_role, chamadas após requireRole(bdl_admin), e verificam o perfil ativo novamente. As quatro tabelas financeiras têm RLS e nenhum acesso direto de anon/authenticated. Atualizações e recebimentos usam transação e bloqueio da linha para evitar concorrência.

Validação: node scripts/license-schedule.test.cjs; npx tsc --noEmit; ESLint dos arquivos alterados. Testes SQL transacionais exercitaram renovação de 3 ciclos, preservação de acesso/histórico, recebimento parcial, quitação, idempotência, estorno, valor excedente e autorização, com rollback integral. Migração remota: 20261016141217_license_contract_billing.
