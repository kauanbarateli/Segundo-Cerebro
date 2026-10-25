# Auth, RLS e perfil — ensaio conectado CURRENT27

**OBSERVADO:** o ensaio conectado terminou em `PASSED`, com nove critérios aprovados, no projeto pessoal de homologação `twrydxsdemaykgvdlpyd`, com 27 migrations e última versão `20261024160005`. Ele cobre Auth, isolamento de perfil e a RPC canônica de identidade. Não qualifica o conjunto do MVP ou a interface hospedada. O [recibo público](evidence/auth-api-current27-20261024.json) contém somente estados, contagens e hashes de evidência.

A execução foi única e terminou em `2026-10-25T01:40:43.7995082Z`. A conferência anterior do banco foi somente leitura. Não houve aplicação de migration, reset, seed ou acesso a produção. A referência local era `a4fabf7a6df7b652584fb55441ecf6a2cc1acd30`; os sete pins de arquivos do roteiro foram confrontados com esse checkout e o checkout da homologação. Isso vincula os sete arquivos revisados, sem converter o ensaio em validação de toda a árvore do candidato.

## O que foi validado

O roteiro criou duas contas comuns sintéticas, usou login real e JWT de cada usuário nas consultas/RPCs e removeu exclusivamente essas duas contas ao terminar. A chave administrativa ficou restrita ao ciclo de criação e remoção; não substituiu os atores nas provas de RLS. Não foram usados convite, envio de e-mail, signup público ou concessão de Master.

| Critério | Resultado observado |
| --- | --- |
| Configuração Auth | Cadastro público e login anônimo desativados; login por e-mail habilitado. |
| Sessão comum A | Login real, identidade e estado de acesso comum conferidos. |
| Sessão comum B | Login real, identidade e estado de acesso comum conferidos. |
| Perfil próprio e estrangeiro | Uma linha própria e zero linhas da outra conta nos dois sentidos. |
| Alteração direta de papel/moderação | Duas tentativas recusadas com HTTP403/SQL42501. |
| Alteração canônica de perfil | Atualização aceita, replay explícito com o mesmo resultado e um único evento de perfil. |
| Revogação de sessão A | Acesso recusado após logout global enquanto o JWT original ainda tinha mais de 60 segundos de validade. |
| Independência da sessão B | A outra conta continuou íntegra após o logout global de A. |
| Encerramento das duas sessões | Ambos os logouts globais confirmados antes da exclusão. |

Foram **36 requisições e 12 tentativas de efeito**, não 12 escritas de domínio bem-sucedidas. As tentativas incluem duas alterações diretas recusadas e o replay explícito. O journal revisado contém um registro inicial e 36 pares antes/depois completos, sem efeito incerto ou transporte interrompido. Os dois usuários foram excluídos e suas duas ausências posteriores confirmadas pela API.

## Limpeza e preservação

Uma consulta independente em transação `repeatable read, read only`, encerrada com rollback, contou as referências dos dois atores sintéticos em **81 colunas distintas**: 29 em `app_private`, 13 em `auth`, 37 em `public` e duas em `storage`. Todas retornaram zero. O recorte compreende colunas `user_id`, chaves estrangeiras diretas para usuários de Auth nos três schemas indicados e os campos de propriedade dos objetos de Storage. A consulta não excluiu dados.

Isso não é prova de ausência em todo log da plataforma: telemetria/auditoria externa e chaves do limitador sem dono estão fora do recorte. O recibo público omite os identificadores e o SQL; a seleção exata dos dois atores foi feita por Root a partir do manifesto revisado. A revisão independente conferiu o recibo e seus limites, sem reconstruir sozinha a seleção ou executar outra consulta.

A conta QA preexistente também recebeu conferência separada somente leitura após o ensaio: os **16 grupos protegidos** permaneceram iguais à baseline de continuação explicitamente selecionada antes; metadados e progressão não mudaram. Permanecem 107 eventos, duas rodadas concluídas, sete intenções confirmadas e uma rodada pausada com rascunho vazio. Essa comparação não apaga nem requalifica o FAIL anterior da baseline original de onboarding, descrito no [registro hospedado](onboarding-hosted-feedback-a8e-20261024.md). A recarga terminou no Início com a sessão QA preservada; uma espera inicial da automação excedeu seu prazo e a conferência seguinte da árvore acessível confirmou a tela carregada.

## Evidência e limites

A revisão independente dos recibos, do journal e das contagens não identificou bloqueador no escopo parcial declarado. Os hashes no recibo público vinculam os originais locais preservados; os arquivos privados e o journal não fazem parte desta publicação. Não houve nova execução para substituir uma falha.

Continuam fora desta prova: SDK e factories de ambiente, rotas HTTP/cookies/Origin/SSR/Server Actions do Preview, interface Master/Admin e saga de contas, comportamento financeiro ou de Metas, upload/download e políticas funcionais de Storage, OAuth novo, aparelhos físicos, restore e aceite humano. Zero referência de limpeza em tabelas financeiras ou Storage não valida o comportamento dessas funcionalidades.

No candidato `a4fabf7`, a coorte do CI fechou em **19/20 runs e 21/22 jobs aprovados**. Os dois gerais aprovaram 3.618 unidades por fuso, 2.147 contratos de scripts e 533 E2E cada; o geral push falhou depois, na captura da landing, com `CAPTURE_PAGE_ERROR` / `CAPTURE_PHASE_READINESS`. A causa permanece indeterminada. O [geral push original](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/40150973203) conserva FAIL; o [geral PR](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/40150976107) conserva SUCCESS. Nenhum desses estados é substituído pelo ensaio de Auth.

Merge, deploy de produção e encerramento das issues permanecem bloqueados até os aceites restantes. Checkout Asaas e Drive continuam fora desta execução.
