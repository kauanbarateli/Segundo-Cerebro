# T-030 / #52 — primeira fatia de comprovação pré-Auth

Início autorizado em 19/10/2026 pelo envio humano do prompt de execução das issues paralelas. Essa instrução posterior autoriza construção local, preservando a origem documental D-064 e os limites D-075. Refs #52. Part of #50. **Contrato executável em rascunho, sem consumidor de produção; não conclui #52 nem desbloqueia #54.**

## Base, propriedade e publicação

Root confirmou base comum `3433c49b9e0e59546ed564222f3c3de814e71098`, HEAD aberto da PR #69, empilhada sobre `main` remoto `f3d18960a41076e99aa60dcc9f6b46967970ebb5`. PR aberta não equivale a incorporação. O checkout da Root e seus WIPs não foram copiados. Branch local: `codex/t030-preauth-contract-v1`, checkout próprio `work/Segundo-Cerebro-t030` da frente de engenharia.

Reservados nesta fatia: novo `src/core/checkout/email-proof.ts`, `tests/core/checkout-email-proof.test.ts` e este relatório. O outro codificador é dono de novo `core/access/commercial-access.ts`, seus testes e inventário #53. Root mantém landing, Settings, legais, Auth, middleware/layout, contratos legados, configurações, dependências/workflows e migrations. Nenhuma migration reservada ou criada; 001–019 permanecem intactas.

Identidade pessoal `kauanbarateli` e permissões do repositório foram conferidas em leitura na CLI por processo, sem alterar conta global; conector GitHub autenticado como `contasvoedigital` não foi usado para mutações. A leitura não certifica push SSH. Remoto de referência é `git@github.com:kauanbarateli/Segundo-Cerebro.git`; chave exclusiva já configurada na Root permanece preservada. O clone local tem origem local e não deve receber push por inferência.

Root determinou entrega por commits/patches locais: ainda não existe canal sem deploy comprovado para novas branches comerciais. PR draft pode gerar Preview. Nenhum push, PR, merge, deploy, configuração remota, envio de e-mail ou operação Auth/Asaas/SQL foi executado.

## Contrato v1 e fronteira transacional

| Elemento | Entrada / saída / autoridade |
|---|---|
| `EmailProofIntentV1` | Estado **privado**: intenção opaca, revisão, endereço, revisão do endereço, geração monotônica, digest e validade da prova; nenhum Usuário fictício. Não é DTO público nem autorização de cobrança. |
| `issue` | Capacidade de retomada verificada para controlar somente a intenção e origem da mutação. Política de cooldown vem do servidor; limites por origem/destinatário continuam obrigatórios no canal. TTL inicial aprovado de 30 minutos. |
| `confirm` | Capacidade de comprovação, digest comparado pela porta de forma segura, intenção/revisão do endereço/geração atuais. Consumo único antes de `expiresAt`, relógio explícito do servidor. Somente comprova endereço. |
| `change-email` | Capacidade de retomada, CAS e endereço válido. Invalida prova anterior; conserva fence de reenvio e contador de geração. Preserva pontos, caixa do local-part e `+alias`; normaliza só domínio/trim. Login e deduplicação Auth têm contrato próprio. |
| Recibo | Chave por intenção + `commandId`, compromisso **calculado no servidor** sobre todo comando decodificado. Mesmo conteúdo reapresenta recibo; divergência falha. Autoridade e vínculo atual são conferidos antes do replay. A capacidade de retomada controla a intenção e sobrevive à edição, permitindo recuperar resposta perdida de `change-email`; a prova de e-mail tem escopo distinto e continua vinculada à revisão do endereço. |
| Resultado | Lista fechada: versão, intenção, revisão, revisão do endereço e etapa. Não inclui e-mail, token, segredo, sessão, URL, pagamento ou existência de conta. É evidência histórica; consumidor financeiro deverá recarregar estado atual. |
| Evento privado v1 | `email-proof-issued`, `email-proof-confirmed`, `checkout-email-changed`; ator `checkout-capability`, intenção/revisões/geração/instante. Sem endereço, digest, UTMs ou conteúdo livre. Não altera `domain_events.user_id`. |
| Envio v1 | Modelo único `checkout-email-proof-v1`, intenção/revisão/geração, ID de entrega e referência opaca ao envelope privado. Sem token em claro na outbox. Sem envio externo nesta fatia. |
| Erros internos | `INVALID_INPUT`, `NOT_AUTHORIZED`, `REVISION_CONFLICT`, `COMMAND_CONFLICT`, `PROOF_INVALID`, `ISSUE_LIMITED`, `INVALID_STATE`. Canal futuro deve mapear respostas públicas sem enumeração/dados privados. |

`EmailProofPort.transaction` deve bloquear a intenção e confirmar estado CAS + evento + recibo + trabalho de envio + envelope cifrado na **mesma transação real**. `mint` pertence à transação, não faz rede e nunca devolve token ao resultado público. Qualquer falha deve reverter tudo. A porta é contrato; não há adapter SQL nem prova PostgreSQL/RLS/concorrência real nesta entrega. O fake serializado testa o caso de uso sob essa obrigação, sem certificá-la no banco.

Uma prova consumida continua comprovando a mesma revisão do endereço; expiração limita o consumo do link. Troca do endereço ou nova geração invalida a prova/capacidade anterior. Replay do mesmo comando confirmado não gera novo consumo; não permite reutilizar recibo como autoridade financeira. `isCurrentEmailProved` é condição necessária, nunca suficiente: não resolve login D-044, aceite contratual, identidade, preço, acesso ou reconhecimento financeiro.

## Proposta de envio e recuperação — pendente de revisão da Root

Digest sozinho não permite reconstruir um token. Proposta para a próxima fatia: token aleatório de alta entropia, digest separado e envelope AES-GCM cifrado em armazenamento privado, com chave externa e versão; AAD vincula intenção, revisão do endereço, geração, ID de mensagem e validade. Outbox guarda somente referência ao envelope. Nenhum codec, chave, cifra ou transportador foi implementado por esta fatia.

O worker futuro revalida geração/revisão/fence antes de decriptar/enviar o único modelo autorizado. Precisa distinguir preparação, chamada em voo, aceitação, rejeição, entrega e resultado incerto. Timeout/expiração de claim não comprovam término de chamada externa. Recuperação deverá conciliar o ID exato e impedir retry cego; rotação controlada invalida links anteriores, sem poder retirar uma mensagem já enviada. Retenção de envelopes/chaves e limpeza após geração inválida exigem contrato próprio; não aplicar 30 dias/12 meses/180 dias por conveniência.

GET/scanner/prefetch não são comandos do módulo. A rota futura deve apenas apresentar confirmação mínima e retirar o token da navegação por passagem segura homologada; só POST com origem/CSRF e limites entra no caso de uso. Não há rota nesta fatia, portanto nenhum ensaio de scanner, navegador, cabeçalho `no-store`/`no-referrer` ou envio conectado é declarado aprovado.

## Validação e limites

Revisão estática cruzada realizada pelos dois codificadores. Achado corrigido: estado/prova/material passaram a exigir formato fechado, ausência somente por `null` e geração positiva; dados corrompidos/extras falham fechados.

Suíte sintética adicionada para sucesso sem Auth/cobrança, replays iguais/divergentes, abas concorrentes no adapter serializado, limite antes/no/depois da expiração, reenvio/rotação, endereço alterado, origem/autoridade inválidas, falha de emissão/commit/rollback e estados persistidos corrompidos. Nenhum teste do transporte ou do SQL é fingido por esse fake.

**Validação dinâmica ainda pendente:** Node `v24.19.0` conferido. `npm ci --no-audit --no-fund` foi iniciado somente neste checkout, sessão própria 3133, e interrompido com exit 1 após medir cerca de 0,336 GB livres em 7,730 GB. Medição posterior: cerca de 0,133 GB. CIM estava indisponível; fallback `node:os`. Nenhuma causa foi atribuída a processos alheios e nenhum deles foi encerrado. Instalação parcial fica isolada e não é instalação válida; não foi compartilhada por symlink/junction. Slot liberado à Root; testes não iniciados enquanto RAM abaixo de 1 GB.

Próximo lote, **somente após reserva explícita e memória disponível**, em comandos separados: concluir `npm ci` no próprio checkout; `npx vitest run tests/core/checkout-email-proof.test.ts --maxWorkers=1`; ESLint dos dois arquivos; `npm run typecheck`; `npm run check:layers`; scanner e `git diff --check`. Não há delta UI/SQL/build para alegar aceite visual, banco ou bundle novo. Resultados deverão ser anexados ao SHA executado, sem transferir PASS da base ou da Root.

## Prova conectada que permanece com a Root

1. Revisar DTOs, emissão/cifra, limite por intenção/destinatário/origem, cookie de retomada e passagem GET→POST; reservar migration nova e adapter transacional com negativos RLS/grants/owner/rollback/duas conexões.
2. Preparar somente app/banco/remetente/destinatários sintéticos autorizados e isolados. Checkout comercial fechado, nenhuma geração de cobrança e nenhuma conta Auth nova.
3. Provar solicitação → GET/scanner sem consumo → POST explícito → projeção mínima; conferir zero Auth e zero Asaas. Repetir expirado, geração antiga, endereço trocado, duas abas, outro navegador e origem indevida.
4. Simular falha de banco, envio rejeitado e envio incerto/crash, conciliando a mensagem exata; não duplicar envio indiscriminadamente nem anunciar entrega por mera aceitação.
5. Após comprovação, identidade já existente exige login correto D-044. Conferir não enumeração, ausência de dados/links em logs, cache, analytics, serviço worker e bundles; complementar UI/DS/acessibilidade quando seu delta for autorizado.

#51 e #53, integração/aceite integral #52 e a publicação sem deploy permanecem gates. Nenhuma dependente foi iniciada e nenhuma issue foi fechada. Reservas serão liberadas após entregar os patches; não há servidor/browser próprio iniciado nesta fatia.
