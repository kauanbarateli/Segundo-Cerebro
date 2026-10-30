# Onboarding — feedback real e preservação na homologação a8e

**OBSERVADO:** o Preview `dpl_4dW1vVL5x9YKpCQ2hiGc1jWF9akQ`, targetnull/Preview e Source `a8e5f5f718c96b3879ecc69cbf0450add3570c8e`, foi conferido na branch de homologação e no projeto isolado `twrydxsdemaykgvdlpyd`. A sessão comum descartável existente continuou funcionando. Não houve nova identidade, papel Master, permissão Google, migration ou produção. O [recibo detalhado](evidence/onboarding-a8e/receipt.json) contém contagens e limites, sem os fingerprints privados.

| Percurso real | Resultado observado |
| --- | --- |
| Nota sem título → confirmar → revisar | Confirmação recusada sem criar intenção; editor abriu, foco no título, aria-invalid e descrição específicos; caderno/texto preservados. Corrigir limpou o erro e o foco permaneceu na área de texto após autosave. |
| Pausar → retornar por link → recarregar | Mesma rodada, mesmas chaves e mesmo draft nos três comparadores; os três campos fictícios retornaram. Nenhum resumo válido foi confirmado. |
| Hábito com nome em branco → confirmar → revisar | Confirmação recusada; editor da mesma escolha abriu/focou o campo inválido com erro associado. A escolha foi descartada apenas do rascunho. |
| Cinco notices por URL | Enum reconhecido em consent-denied/connection-failed/connected; unknown/duplicado ignorados, sem refletir conteúdo arbitrário. As cinco visitas não alteraram contagens, comandos ou eventos. Isso não é um novo ensaio OAuth. |
| Encerrar | Nova terceira rodada pausada, draft vazio e0intenções novas; duas completas/sete confirmadas, registros dos grupos conferidos e duas contas Google preservados. |

Capturas próprias: [título inválido escuro](evidence/onboarding-a8e/note-title-invalid-focused.jpg), [claro](evidence/onboarding-a8e/note-title-invalid-light.jpg) e [nome do hábito](evidence/onboarding-a8e/habit-name-invalid-focused.jpg). Um peer abriu as três, conferiu hashes e não encontrou PII visível. Foco/ARIA são fatos DOM/CUA separados dos pixels. No erro do título, a medição computada foi6,27:1 no escuro e5,32:1 no claro; fonte16px e campo com cerca52px de altura. Isso não certifica a tela inteira.

## Falhas preservadas e continuação explícita

A proposta SQLv2 de observação falhou por omissão de aliases no FROM, sem retornar baseline. Era somente leitura; a conclusão do rollback dessa tentativa não foi observada. A v3 corrigida teve execução própria e estabeleceu a base real de94eventos, não a referência antiga44.

Ao medir contraste, Root escolheu Claro e depois Sistema, supondo efeito só no navegador. O controle do onboarding também salva a preferência da conta. A comparação estrita original detectou os dois recibos/eventos extras e três grupos diferentes; permaneceu FAIL e foi preservada. Uma prova RO revisada confirmou exatamente os dois pedidos theme-only, encadeamento Sistema→Claro→Sistema, timestamps transacionais, estado atual Sistema, os23recibos anteriores e os eventos protegidos originais reconstruídos, além da preferência original com as demais configurações.

Somente após essa prova, Root selecionou uma baseline de continuação:96eventos protegidos, com13hashes originais conservados e somente três grupos atualizados para as duas ações conhecidas. Uma nova leitura exigiu os16comparadores e a mesma rodada antes de retomar. Isso não requalifica a comparação que falhou. Ao final,107eventos=94originais+2preferências+11da rodada;25recibos=23originais+2preferências. Não houve limpeza de histórico, reset ou seed.

A revisão independente de preservação e dos três JPEG foi favorável, com parecer SHA256 `323ccd511a861dfac9aaeaa4d40a35b675f525b86978fee5d3fb1fbcd8cb4d8c`. Permanece uma observação de polish: erro de título também abre a opção secundária de vínculo a Projeto; nenhum ajuste foi aplicado neste lote.

O ensaio cobre esses percursos com uma identidade. Não substitui OAuth externo novo, duas identidades/RLS, replay, concorrência, falha injetada, aparelho físico, zoom ou aceite humano. O app hospedado é a8e; CI/captura e os próximos candidatos conservam evidência própria. Merge e produção permanecem bloqueados.
