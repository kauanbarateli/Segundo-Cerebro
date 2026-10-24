# Metas no Financeiro — host H0

Autoria posterior ao candidato `0d933d9`, ainda sem aceite próprio de CI ou aplicação conectada. Merge e deploy de produção continuam bloqueados. Esta fatia liga o cliente existente ao Workspace; não instala schema, habilita flags nem oferece fotos no host.

O Painel recebe a Meta compacta antes dos cartões. A aba conserva `tab=orcamentos`, os filtros e links existentes, com rótulo Planejamento; nela ficam orçamento, Metas completas e séries. As condições das abas são exclusivas: há somente um host/controller de Metas visível por vez. O posicionamento segue `docs/planejamento/17-evolucao-prototipo/prototipo/finance.js:78–81`; não foram copiados dados ou a arquitetura demo.

## Sessão e comportamento

O host só existe em modo conectado e fora do encerramento da sessão. A factory concreta `browserFinanceGoalsClient` abre o journal durável existente. Owner, epoch do Provider e referências dos serviços são conferidos antes e depois da abertura. Rerender do objeto do Provider conserva os recursos; troca efetiva encerra o cliente e ignora respostas tardias. Sair da aba descarta somente os handles, sem revogar identidade ou limpar journals.

O próprio canal de Goals continua criando seu único controller. Indisponibilidade silenciosa só oculta a superfície quando não há erro, tentativa pendente ou reconferência; essas recuperações permanecem visíveis. A disponibilidade é consultada pelo endpoint existente e não é inferida da ausência de RPC. Nenhum novo request de foto é admitido nesta fatia.

Preparar pelo editor rejeita a Promise quando o canal recusa a revisão; não retorna sucesso vazio. A confirmação ou resolução da tentativa atualiza as consultas gerais, preservando a exigência de carregar os dados de Metas e registrar a reconferência humana. Falha nessa atualização mantém aviso e bloqueio; não chama acknowledge automaticamente. Contas do Provider oferecem somente identificação/classificação, nunca um saldo disponível calculado por paginação de Metas.

## Validação e limites

A revisão de refresh encontrou um P2 de interleaving: um refresh geral antigo fora da exclusão poderia terminar após outra resolução e liberar a reconferência. O [parecer inicial](evidence/t054-goals-host-refresh-v1-independent-review-20261024.md) foi preservado. A correção mantém `beforeRead` e `controller.page` dentro da mesma `channel.run`, reconferindo controller/owner/client após o await. Falha não lê a página nem limpa needsRefresh; paginação também não pode liberar essa pendência. O [peer corrigido](evidence/t054-goals-host-refresh-v2-independent-review-20261024.md) é favorável estático. Dois E2Es escritos cobrem refresh retido com resolução bloqueada e duas falhas antes de reload completo/aceite humano; ainda não foram executados.

Root executou seis controles puros de lifetime em Node 24.19.0: abertura única, fechamento antes da fila, resposta tardia após fechamento, oito mudanças de identidade/serviços, falha sem retry e recusa de demo/encerramento/epoch inválido. Todos passaram, sem renderer, SDK, banco ou navegador. O [peer H0](evidence/t054-goals-host-h0-independent-review-20261024.md) é favorável estático e não aceita ativação ou DOM.

A closure Admin foi derivada pelo coletor original e confrontada com os dois relatórios próprios de `0d933d9`: 471→504 fontes, exatamente 33 adições e nenhuma remoção; dependências permanecem 61. O [delta público](evidence/t054-goals-host-admin-source-delta-20261024.json) registra paths/hashes. Contrato/declaration e negativos de fonte ausente/forjada foram ampliados para esse conjunto finito, sem relaxar o coletor. O resultado de CI ainda depende do novo SHA.

Dois controles focais Node de derivação da closure e recusa de linhas duplicadas/incompletas também passaram. O teste integral do coletor recusou `SOURCE_REFUSED` ao ler a primeira dependência: o `node_modules` local é uma junction compartilhada, e o realpath não coincide com o path do checkout, como exige o gate. Não houve bypass, cópia/instalação de dependências ou novo serviço; esse controle integral continua pendente do CI com instalação própria. A recusa não é resultado de Auth/PostgreSQL nem aceite negativo de produção.

H1 continua pendente: binder real de fotos, recuperação do scope original A e revogação browser antes de await open. A opção explícita de continuar sem nova foto é outra fatia em implementação. Ativar o host com imagens exige ambas, a união nativa E1-A+M1, promoção canônica/catálogo/tipos e aceites supervisionados de Auth/RLS/Storage. O formulário legado não deve virar atalho implícito para abandonar um envio protegido. Flags, ambiente e produção permanecem inalterados.

Referências: [plano de host](finance-goals-host-mount-plan-20261024.md), [G0](finance-goals-host-no-new-image-design-20261024.md), [promoção do schema](plano-promocao-finance-goals-schema-20261024.md), [gate I1–I8](finance-goals-images-terminal-i1-i8-interface-proposal-20261024.md). Estes documentos preservam as propostas datadas; autoria e aceite efetivos são registrados separadamente.
