# Metas — resolver uma tentativa sem inventar ausência de efeito

Plano técnico Root, 23/10/2026. A fundação local V2 está em revisão; o protocolo completo de canal/journal/UI não está implementado. Nenhuma aplicação ou ativação. Complementa as PRs #115, #116 e #118. Refs #79.

## Problema observado

O controlador atual conserva a intenção original depois de qualquer envio sem confirmação positiva. A consulta é somente leitura: não encontrar recibo não prova que uma chamada anterior terminou sem efeito. Recarregar, excluir localStorage, receber 400/409/503 ou trocar UUID não resolve essa prova. O comportamento protege contra duplicatas, mas, sozinho, pode deixar uma recusa sem saída para a pessoa. Não é aceite final do módulo.

## Separação de operações

1. **Consultar tentativa V1:** permanece estritamente somente leitura e receipt-only. Devolve resultado confirmado do recibo exato ou incerteza; nunca cria tombstone, faz commit ou repete a escrita. A fatia terminal terá uma consulta própria e versionada do encerramento: confirmado, encerrado ou incerto, vinculados à intenção. Essa leitura também será autenticada e somente leitura. Não se mudará silenciosamente o contrato V1.
2. **Encerrar esta tentativa:** ação humana separada, autenticada, com a mesma intenção e UUID. Não significa desfazer um aporte. O servidor serializa o encerramento e o commit pelo mesmo lock financeiro do Usuário.
3. **Preparar outra operação:** somente depois de resultado terminal positivo, gravação/readback do journal e nova revisão dos dados atuais. Uma ausência de corpo local continua sem autoridade.

## Protocolo proposto para revisão

No servidor, o encerramento autentica identidade, sessão, Entitlement, origem e destino. O corpo é o GoalCommand original fechado, não um novo comando financeiro com dados modificados. A unidade de decisão é Usuário + nome do comando + client_id, igual ao namespace real do recibo. O corpo é vinculado por digest SHA-256 versionado da UTF-8 da canonicalização exata do input completo (`assinatura(input)`); a representação canônica financeira não será duplicada na tabela de disposição. Digest vinculado ao Usuário continua sendo dado pessoal, não anonimização. Igualdade e cálculo ficam no servidor; nada em URL ou logs.

Dentro da mesma transação e **depois de adquirir exatamente o lock usado pelo commit**:

- Se existir recibo válido dessa intenção, devolver o resultado confirmado original; não criar cancelamento nem desfazer o que já ocorreu.
- Se existir disposição terminal válida da mesma intenção, devolver a mesma disposição idempotente.
- Se o UUID estiver vinculado a outro corpo, recusar por conflito; jamais reclassificar a outra intenção.
- Se não existir recibo, persistir uma disposição terminal que proíbe um commit posterior dessa intenção. A tabela, os privilégios e a verificação do commit precisam ser parte da mesma fatia de schema. Não é suficiente inserir um registro que o commit ignore.

O commit precisa adquirir o mesmo lock, verificar primeiro recibo/disposição sob esse lock e recusar intenção encerrada **antes de qualquer efeito financeiro**. Assim, se o commit venceu a corrida, o encerramento vê o recibo; se o encerramento venceu, a chamada anterior ainda aguardando perde a autorização de gravar. Snapshot somente leitura, HTTP 409 genérico ou uma consulta fora do lock não substituem esse ponto de serialização.

Encerrar não depende de `expected_finance_revision`, saldo, situação atual da Meta/Conta/imagem ou outra precondição de execução. Validar a forma e o vínculo da intenção antiga não é executá-la. Auth, sessão, Entitlement e fence transacional atuais permanecem obrigatórios. A ordem e o nome concreto do lock compartilhado devem ser conferidos contra o SQL vigente antes da implementação.

O resultado terminal deve ter versão e shape fechados, vínculo à intenção, dono e identificador da disposição. Não usar um booleano `not_applied` derivado da ausência de recibo. Erro, timeout ou resposta perdida do encerramento mantêm a intenção pendente; uma nova ação humana consulta a disposição original, sem emitir escrita financeira.

## Persistência e eventos

Migration aditiva própria, sem editar 001–026. O registro terminal é metadado de controle do comando, isolado por Usuário, sem dados de cartão, tokens ou conteúdo financeiro duplicado. A decisão de quais metadados são necessários e como emitir o evento de domínio/auditoria atomicamente deve ser revisada junto com os privilégios e retenção; não criar exceção implícita ao ADR-0004.

O marcador mínimo de proibição não expira enquanto esse namespace de comando ainda puder ser aceito para a identidade. Uma limpeza de detalhes não pode apagar esse fence nem reabrir o UUID. Exclusão integral da identidade e eventual rejeição permanente por geração são casos separados. O procedimento de recuperação também precisará preservar essa garantia ou rejeitar gerações anteriores antes de reabrir o app; restaurar um backup antigo não concede autorização para reexecutar uma intenção encerrada.

RPCs de aplicação não recebem autoridade de owner/client_id externo além da intenção: owner e sessão vêm do actor verificado. RLS e grants fechados; nenhuma escrita direta pelo navegador. Reconcile e encerramento continuam acessíveis para uma tentativa anterior quando a flag de novas operações estiver desligada, mantendo os demais controles.

## Browser e interface

O journal conserva o corpo até receber confirmação positiva vinculada ao comando original e conferir a remoção/readback sob lock e epoch. O controlador mantém sua cópia privada até essa mesma prova. Uma resposta tardia de outra sessão, epoch, UUID ou corpo não libera o bloqueio.

Interface proposta: aviso de resultado pendente, “Consultar tentativa” e ação secundária “Encerrar esta tentativa”. Antes do encerramento, explicar: “Se a operação já foi concluída, mostraremos o resultado. Caso contrário, impediremos que esta tentativa seja concluída depois. Isso não desfaz valores já registrados.” Exigir ação humana de confirmação; nenhum encerramento automático por tempo, erro ou unmount.

Depois de confirmado o encerramento, atualizar e conferir os dados atuais antes de preparar outro UUID. Não reutilizar o formulário anterior como autorização financeira. O gate não pode ser declarado concluído apenas por fake de UI.

## Provas necessárias antes de ativar

- Recibo preexistente devolve resultado original, mesmo com revisão atual diferente.
- Resposta perdida depois do encerramento e nova montagem: a consulta terminal própria recupera a mesma disposição, sem nova escrita financeira nem novo tombstone.
- Revisão alterada, Meta arquivada ou Conta indisponível não impedem encerrar a intenção antiga; o namespace de outro dono ou comando não é confundido.
- Encerramento antes do commit, commit antes do encerramento e chamada antiga aguardando lock: no máximo um efeito financeiro; nenhuma escrita após disposição terminal.
- Duas abas, duplo clique, corpo/UUID alterado, disposição alheia, resposta perdida e erro de gravação/readback conservam o fence correto.
- Recibo e disposição não podem coexistir contraditoriamente; constraints, ordem de lock e rollback conferidos no PostgreSQL.
- Sessão revogada, outro dono, Entitlement negado, origem externa, flag desligada e RPC ausente não permitem limpar por silêncio.
- Toda escrita de controle e seu evento são atômicos; nenhuma mudança no saldo real por encerramento.
- Retenção e recuperação não reabrem UUID encerrado: o fence mínimo ou a rejeição permanente de geração continua vigente depois da limpeza/restore.
- Port/controller/journal e UI exibem resultado confirmado, encerrado e incerto como estados distintos, sem depender somente da cor.
- Typecheck, portão de dependências, testes negativos e integração SQL; depois Auth/RLS/CAS e browser durável em homologação. Merge e produção continuam bloqueados.

## O que pode continuar antes dessa fatia

Os canais browser e HTTP já aprovados podem ser construídos e testados com o comportamento conservador atual, sem exposição no FinanceWorkspace e com flag false. Não precisam aguardar uma resposta externa, mas sua ativação depende de uma solução terminal completa e revisada, além dos demais gates de Metas.

## Decisão explícita de contrato V2

O diagnóstico público do codec refutou o parser V1: operações PostgreSQL json sobre o corpo inteiro também recusam NUL e surrogates isolados que o Core permite em nomes. O pacote V1 permanece congelado e não aprovado; os testes não foram retirados para simular aprovação.

Root escolheu a alternativa de texto opaco no caminho sem recibo, sob a autoridade do canonicalizador nominal do servidor. O protocolo terminal passa a version2; canonicalization_version e o resultado financeiro continuam1. Não há fallback terminal1. O SQL continua validando envelope fechado, quota, namespace externo, Auth/sessão/Entitlement, lock e digest dos bytes. **Ele deixa de provar a estrutura e o namespace dentro desse texto.** Um service_role hostil com sessão válida pode encerrar o namespace do envelope usando outro texto: o teste expõe essa limitação, zero efeitos financeiros e a recusa da resposta pelo token honesto original. A credencial privilegiada não é uma fronteira contra comprometimento do servidor.

Com recibo existente, preserva-se o caminho forte: request JSON-string e igualdade textual exata; somente depois interpretar o fingerprint armazenado, conferir o comando/client_id internos e aplicar o decoder original do resultado. Recibo impossível/corrompido falha fechado, sem fabricar encerramento. A ausência continua sem liberar o journal. O fence bloqueia o namespace por inteiro, mesmo com corpo/digest posterior diferente; não expira enquanto o executor puder aceitar aquele namespace.

Essa decisão autoriza autoria e validação, sem mudar os gates de concorrência nativa, recuperação, canal, journal e interface antes da ativação. A fundação SQL continua proposta inerte e não é migration aplicada.
