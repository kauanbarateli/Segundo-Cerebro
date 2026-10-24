# Onboarding: interface e Núcleo — 23/10/2026

Implementação da autorização D-077, vinculada à #46 e aos contratos de onboarding #62–#65. Checkout, Asaas, cobrança e abertura comercial permanecem fora desta fatia. O [pacote visual](../planejamento/15-aplicacao-layout-codex/07-onboarding-simplificado.md) foi recuperado com [proveniência explícita](onboarding-source-reconciliation-20261023.md).

## Implementado nesta fatia

- `/onboarding` exige a identidade existente e a troca de senha obrigatória antes de abrir. Fica fora da sidebar. Não muda redirecionamentos de contas existentes nem captura links profundos.
- Nove telas: boas-vindas, nome, Google Calendar, hábito, projeto, tarefa, notas, outros espaços e resumo. Uma coluna de até560px, marca e Geist, temas compartilhados, campos16px, alvos44px, foco, teclado, disclosure nativo e movimento reduzido. Valores dimensionais são **OBSERVADOS** no protótipo PR47; adaptações de estado/contrato são **RECOMENDADAS** para a aplicação real.
- Núcleo puro com DTOs fechados, schema1, dono esperado, UUIDs de escolhas distintos de IDs reais, CAS decimal, limites introdutórios e referências discriminadas a Projetos/Cadernos existentes.
- Gateway HTTP do mesmo origin com sessão por cookie, dono esperado, sem redirects/retries automáticos e corpo limitado. Nenhum SDK de banco ou integração privada entra na interface.
- Rascunho vem exclusivamente do servidor. Leituras ausentes/indisponíveis não geram uma conta nova nem um rascunho fictício. Não há persistência de onboarding em `localStorage` ou importação do estado demo.
- Autosave de conteúdo; Voltar/Pular/Continuar guardam progresso. Fazer depois aguarda confirmação da gravação e pausa. Conflito mantém edição em memória até a escolha explícita de descartá-la/carregar a versão salva. Uma resposta de escrita incerta impede novo envio automático e exige conferência.
- Rascunhos aceitam escolhas incompletas: nomes/títulos vazios, uma nota escrita antes do Caderno e espaços em edição continuam persistíveis, com chaves estáveis. `validateOnboardingCompletion` exige conteúdo completo somente antes de congelar intenções; a validação estrutural, de dono, referências, limites e bytes continua em todo save. Não excluir escolhas parciais para contornar uma falha de validação.
- Respostas de todas as operações ficam vinculadas à geração e ao dono que as iniciaram. Troca de Usuário/service e unmount invalidam sucesso, erro, timeout, callbacks, desbloqueios e navegações antigos. Tema e busca/paginação também usam essa cerca de geração.
- Hoje usa dia civil fornecido pelo servidor, preservado ao retomar. Omitir nome/foco/contexto preserva os dados anteriores. Notas exigem Caderno, e Página→Projeto usa referência explícita.
- Confirmação congela as escolhas salvas; a UI avança as intenções uma por chamada, com limite de chamadas, sem assumir transação entre módulos. `partial/unknown` não são sucesso. Complete/expired não retornam texto do rascunho; o resumo histórico mostra recibos e não recria registros.
- OAuth reutiliza o canal Google, com continuação discriminada vinculada à rodada. Seleção de fontes usa o comando existente. Conexão/seleção têm efeito antes da conclusão, informado na tela. Não são armazenados eventos, tokens ou dados do Cofre no draft.
- Tema mantém provider, Field e apresentação compartilhados. Como o percurso não tem o contexto do WorkspaceShell, o controle salva pela API de Settings existente; falha de sincronização fica explícita. Tema e seleção Google são preferências/autorizações imediatas, sem renovar a retenção do rascunho.
- Arquivos tem apresentação contextual, sem upload genérico, rota/módulo Drive ou promessa de entrega da aba excluída.

## Contratos de integração

`GET /api/onboarding` e POST de comandos retornam `{ok:true,result:Snapshot}`. O envelope de escrita é `{command:'onboarding.<ação>',input:...}`. Erros usam códigos fechados; troca de sessão limpa a leitura pessoal da interface. A rota revalida identidade, Origin, permissões e retenção no servidor.

`choices` pagina Projetos/Cadernos existentes por IDs autorizados. Não localizar entidades por título nem pedir UUID ao usuário. OAuth usa `continuation:{kind:'onboarding',round_id}` sem `returnTo` livre. A UI aceita apenas o endereço de autorização Google permitido.

A frente backend é responsável pelos adapters/API, draft durável, intenções, recibos, retenção, contexto/foco versionados e continuação OAuth. A frente de consumidores adiciona foco editável em Configurações, contexto editável no Projeto e entrada manual no onboarding. Esta UI não substitui essas entregas.

Uma rodada parcial permite emendar somente um slot ainda não confirmado. `onboarding.amend` usa CAS, UUID próprio estável e união fechada por espécie; o servidor reconcilia o recibo real e revoga a versão antiga atomicamente antes de preparar a substituta. Confirmados são preservados. Omissão exige consentimento para a lista exata de dependentes enviada pelo servidor; `omitted` nunca conta como criação. A nota troca de Caderno sem alterar implicitamente seu vínculo com Projeto; esse vínculo tem intenção própria. Não são criados slots novos pela emenda.

`Snapshot.recovery` fornece somente versões ativas não confirmadas/não omitidas, com escolha fechada, permissões e IDs de dependentes. A interface não reinterpreta o draft congelado como destino atual depois de uma emenda. Perfil conserva a revisão original; usar uma versão atual como base exige leitura e aceite explícitos. Resultado desconhecido conserva corpo/UUID imutáveis inclusive após 403/400/409, bloqueia outra emenda e oferece consulta/reenvio manual da mesma tentativa. Uma leitura de snapshot não prova a ausência do commit e não libera outro UUID; sucesso válido da tentativa original ou encerramento do ator são os únicos caminhos de saída. Nenhuma emenda avança módulos automaticamente.

O prazo exato de expiração aparece nas etapas. Navegação, tema e consulta não renovam os30dias; a atualização efetiva do prazo é determinada pelo servidor. A validade de cercas de transação, expiração física e retenção é responsabilidade do backend e exige evidência SQL de homologação, não pode ser inferida dos testes de interface.

## Validação e evidência

**Conferido sem runtime local:** leitura de contratos/protótipo/Impeccable, comparação de blobs do planejamento,125 hashes do manifest sem divergência, links locais do pacote e `git diff --check`. Cálculo nativo de luminância dos tokens nos papéis usados mediu36 pares de claro/escuro, mínimo4,697:1 e nenhum abaixo de4,5:1; isso não substitui conferir os estilos computados no navegador. A revisão textual backend conferiu tipos/port e pediu endurecimentos já incorporados: conteúdo null em complete/expired, reason null em confirmed e unicidade de intentId e kind:itemKey.

**Testes escritos, ainda não executados nesta máquina de8GB:** `tests/core/onboarding.test.ts`, `tests/onboarding-http.test.ts`, `tests/onboarding-lifetime.test.ts` e `tests/onboarding-amendment-attempt.test.ts`, com dono alheio, versão/campos extras, getters, limites, referências, datas, CAS grande, conteúdo expirado, recibos inconsistentes, perda de resposta, ausência de retry automático, troca de sessão, destinos OAuth, paginação e emenda incerta seguida de conflito/veto/indisponibilidade. A execução deve ocorrer no GitHub, depois de revisão e publicação coordenada por Root.

Checks do candidato combinado:

```sh
npm run typecheck
npm run lint
npx vitest run tests/core/onboarding.test.ts tests/onboarding-http.test.ts tests/onboarding-lifetime.test.ts tests/onboarding-amendment-attempt.test.ts
npm run check:layers
npm run check:design-system
npm run check:secrets
node docs/planejamento/15-aplicacao-layout-codex/verificar-pacote.mjs
npm run build
```

**Pendentes:** CI do SHA combinado; contrato/API/SQL real em homologação; snapshot oficial e migrations coordenadas; navegação real de conta antiga e entrada explicitamente elegível; pular tudo, parcial/completo, duas abas, pausa/recarga e30dias; falhas em cada intenção/dupla confirmação; seleção existente por ID; retorno Google de sucesso/recusa/expiração e terceira conta; foco/contexto editáveis; comparação com capturas em320/390px e larguras intermediárias, zoom, teclado, temas, contraste medido e movimento reduzido. Evidência do protótipo não comprova esses aceites.

Merge/deploy de produção continuam bloqueados até revisão, CI e aceites autorizados. Nenhuma migration foi numerada ou aplicada nesta fatia.
