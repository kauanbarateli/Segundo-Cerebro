# Cofre — T-012

Modo **Operate**, maquete de fluxo autorizada por doc 13 T-012. D-030/DS 2.1 orienta a composição; doc 09 descreve implementação futura, sem atestar proteção nesta tela.

- **OBSERVADO:** composição central com ícone de cadeado, título, campos e ação, seguida de informação sobre proteção/recuperação.
- **RECOMENDADO:** estados criar → bloqueado → prévia → bloqueado. Senha ilustrativa é preenchida por botão em campos readOnly; não aceita senha pessoal. Os valores são descartados em cada transição e nunca chegam ao reader, evento, armazenamento ou clipboard.
- **INFERIDO:** cartão de formulário de até 520px, conteúdo de até 820px, padding pelos tokens existentes; campos de 16px e alvos 44px. A prévia mostra somente dois nomes sintéticos retornados pelo provider, ou vazio real.

O aviso de demonstração permanece visível. Não há promessa de criptografia, geração de kit, irrecuperabilidade, bloqueio automático ou limpeza de clipboard. Checkbox de entendimento usa Button com papel checkbox, Space/Enter nativos e foco compartilhado. Mudanças de etapa levam foco ao título. Skeleton próprio e erro de reader com retry.

E2E prepara validação de etapas, descarte de campo, ausência de valor ilustrativo em storage e 320/390/1280px. Verificação visual integrada fica com o root.

## T024 — proteção implementada

O recorte T012 acima é histórico. IMPLEMENTADO: criar com consentimento explícito de irrecuperabilidade, senha mestra, kit em dois arquivos e prova byte a byte antes de gravar; desbloquear, CRUD cifrado com Drawer, item ilegível preservado/diagnóstico, lixeira/restauração, recuperação e troca de senha mantendo o kit antigo. A demonstração usa a mesma cifra e avisa armazenamento somente na visita. Conteúdo, título e tipo nunca vão à API em claro; o reader entrega somente envelopes.

DS 2.1/Geist/tokens existentes foram mantidos. Os Drawers têm primeiro foco/retorno, pending impede repetir comandos e preserva o envelope/client_id do mesmo envio. Inputs de arquivo próprios usam classes do Field, 16px e alvos 44px; escolha nativa de kit acontece antes da sessão desbloqueada. Estado aberto some ao bloquear, inclusive editor e campos. A lista não esconde itens que falham ao decifrar.

VALIDADO: 24 testes focados e parser estático, sem executar SQL. Quatro jornadas browser estão preparadas; medições e inspeção visual pertencem à integração do root. [Relatório T024](../../docs/implementation/t024-cofre-cifrado.md) descreve parâmetros, trust boundary, browser/clipboard e aceite manual externo.
