# Cofre — T-012

Modo **Operate**, maquete de fluxo autorizada por doc 13 T-012. D-030/DS 2.1 orienta a composição; doc 09 descreve implementação futura, sem atestar proteção nesta tela.

- **OBSERVADO:** composição central com ícone de cadeado, título, campos e ação, seguida de informação sobre proteção/recuperação.
- **RECOMENDADO:** estados criar → bloqueado → prévia → bloqueado. Senha ilustrativa é preenchida por botão em campos readOnly; não aceita senha pessoal. Os valores são descartados em cada transição e nunca chegam ao reader, evento, armazenamento ou clipboard.
- **INFERIDO:** cartão de formulário de até 520px, conteúdo de até 820px, padding pelos tokens existentes; campos de 16px e alvos 44px. A prévia mostra somente dois nomes sintéticos retornados pelo provider, ou vazio real.

O aviso de demonstração permanece visível. Não há promessa de criptografia, geração de kit, irrecuperabilidade, bloqueio automático ou limpeza de clipboard. Checkbox de entendimento usa Button com papel checkbox, Space/Enter nativos e foco compartilhado. Mudanças de etapa levam foco ao título. Skeleton próprio e erro de reader com retry.

E2E prepara validação de etapas, descarte de campo, ausência de valor ilustrativo em storage e 320/390/1280px. Verificação visual integrada fica com o root.
