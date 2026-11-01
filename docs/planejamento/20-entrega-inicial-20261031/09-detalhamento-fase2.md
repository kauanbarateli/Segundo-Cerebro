# Detalhamento da fase posterior

Preparado em 31/10/2026. Base examinada: `main` em `bd35288404c493d1b03f7a1a0208f808cc2079a2`, com auditoria estrutural do Supabase registrada no doc 16. **Detalhamento do backlog posterior; nenhuma implementação ou operação de produto executada.**

## Precedência e recorte

O novo faseamento prevalece sobre a sequência E0–E6 e as dependências Fxx do pacote completo anterior. A fase 1 tem duas frentes: A simplifica visual/navegação/fluxos existentes; B entrega cadastro gratuito por e-mail/senha, snapshot dos cinco UTMs, métricas para Master, envio/histórico próprio de feedback privado e atualizações versionadas. Essas entregas **não esperam** Google login, escrita Calendar, ClickUp, ADM separado ou purga.

O Admin legado permanece operante e protegido na fase 1. Sua remoção só ocorre após substituição ou contingência comprovada na fase 2. Não transformar a antiga dependência de F11 em bloqueio da abertura do cadastro gratuito ou da gestão mínima da fase 1.

Esta proposta aplica `to-tickets`: comportamentos completos, dependências explícitas e corpos sem caminhos de implementação. O mapa documental/técnico fica ao final. São 12 tickets; P2-01–P2-12 são chaves deste plano e seus números reais estão no [registro de issues](05-registro-de-tickets.md). Na publicação, todos ficam em **fase 2 / posterior**, com triagem `needs-triage`, sem `ready-for-agent` e sem início automático. A liberação da fase 2 é uma decisão de agenda do mantenedor, distinta das dependências técnicas abaixo. As dependências definitivas e números reais estão no registro; a descrição por capacidades permanece como contexto técnico.

### Limites que não retornam por herança

- Não recriar checkout, preço, cobrança ou bloqueio após sete dias. Login Google conserva o acesso gratuito e as gratuidades existentes, seguindo o contrato final da fase 1.
- Não ampliar o snapshot dos cinco UTMs para visitante persistente, identificação entre dispositivos, sequência de visitas, atribuição multitoque, timeline individual de navegação ou coletor genérico de eventos. A jornada complexa do doc 10 exige recorte e triagem próprios; **nenhum ticket desta proposta a implementa**.
- Não duplicar métricas Master ou transformar último login em pessoa online. Migrar as definições e os dados da fase 1 quando necessário.
- Atualizações/roadmap é uma única superfície. Na fase 2, preservar seus IDs e migrar o conteúdo versionado para a fonte administrável, com transição explícita e sem dois quadros concorrentes. Não criar CMS genérico.
- Apple, edição de recorrências Google, ClickUp Chat/DM, webhooks ClickUp, novas plataformas de tracking e acesso administrativo ao conteúdo pessoal continuam fora.

## Dependências e marcos

| ID | Título | Entrega demonstrável | Bloqueado por | Esforço relativo |
|---|---|---|---|---|
| P2-01 | Entrar e criar conta com Google preservando o cadastro gratuito | Novo usuário segue ao onboarding; usuário existente conserva conta e dados | Cadastro/verificação/provisionamento da fase 1 | M–L |
| P2-02 | Exibir detalhes e permissões reais dos eventos Google | Pessoa lê descrição, participantes, Meet e restrições sem dados inventados | Nenhum ticket da fase 2 | M |
| P2-03 | Criar, editar e cancelar eventos Google avulsos | Alteração remota confirmada com convidados/Meet quando permitidos | P2-02 | L |
| P2-04 | Consultar minhas tarefas ClickUp no Segundo Cérebro | Conexão OAuth, seleção de Workspaces, lista própria e sincronização manual | Nenhum ticket da fase 2 | M–L |
| P2-05 | Atualizar tarefas ClickUp e conversar nos comentários | Status, descrição e comentários confirmados sem sobrescrita silenciosa/reenvio cego | P2-04 | M–L |
| P2-06 | Manter tarefas ClickUp atualizadas com a página fechada | Atualização aproximada de cinco minutos, atraso e recuperação visíveis | P2-04 | M |
| P2-07 | Acessar o ADM separado com MFA e consultar contas | Master entra no novo host com sessão própria e lê metadados autorizados | Nenhum ticket da fase 2 | M–L |
| P2-08 | Transferir a operação administrativa e cortar os canais antigos | Gestão atual e da fase 1 disponíveis no novo ADM, contingência e corte comprovados | P2-07; superfícies Master da fase 1 | L |
| P2-09 | Responder feedbacks em privado e publicar o roadmap | Autor recebe resposta no app; autenticados veem somente cards editoriais publicados | P2-07; feedback persistente da fase 1 | M–L |
| P2-10 | Controlar liberação de funcionalidades pelo ADM | Master libera capacidade existente para piloto ou público, respeitando vetos | P2-07 | M–L |
| P2-11 | Excluir definitivamente itens da lixeira sem quebrar referências | Usuário remove tarefas, capturas e páginas com confirmação e integridade | Nenhum ticket da fase 2 | L |
| P2-12 | Aplicar retenção automática de sete dias na lixeira | Prazo real, carência do legado, restauração e job verificáveis | P2-11 | M–L |

Dependências somente técnicas: P2-05 e P2-06 são paralelos depois de P2-04; sincronização não espera edição. P2-09/P2-10 não precisam esperar P2-08, e o corte P2-08 não espera roadmap ou gestão de releases que ainda não estejam liberados. P2-02 não depende de Google login, porque a conexão Calendar já tem OAuth próprio. P2-11 não depende de ADM novo; usa autorização por dono e mecanismo operacional existente.

**Marcos comuns, sem criar uma cadeia artificial:** reconciliação do histórico 5/27 e patch PT409 antes de DDL, capacidade de QA e guarda de segredos. Reaproveitar o resultado correspondente da fase 1; não abrir outro ticket de fundação para repetir trabalho. A auditoria não autoriza reaplicar as 22 migrations sem registro. Configuração de OAuth, verificação Google, DNS e testes com contas externas são condições de aceite/liberação dos respectivos tickets, não bloqueios a todo o trabalho visual nem justificativa para bloquear tickets independentes.

## Corpos candidatos para issues

### P2-01 — Entrar e criar conta com Google preservando o cadastro gratuito

**O que construir:** o visitante pode escolher Google no acesso; a conta verificada entra no mesmo processo de provisionamento gratuito e onboarding da fase 1. Contas já existentes permanecem com sua identidade, dados e concessões.

**Bloqueado por:** ticket da fase 1 que entrega cadastro verificado, provisionamento idempotente e entrada no onboarding. Nenhum outro ticket da fase 2.

**Estado de publicação:** posterior; `needs-triage`.

- [ ] Novo usuário chega ao onboarding e usuário existente chega ao destino interno permitido sem duplicar perfil, histórico ou gratuidade.
- [ ] Cadastro e acesso por senha/recovery continuam funcionando; retorno social não reutiliza o contrato de recuperação de senha. Cancelamento, retorno adulterado/repetido, troca de usuário e destino externo são tratados.
- [ ] Bloqueio, veto e sessão revogada continuam válidos; associação de identidades segue o provider, sem merge próprio por comparação de e-mails.
- [ ] Pedir somente identidade/e-mail/perfil para login. Entrar com Google não conecta Calendar nem concede acesso à agenda.
- [ ] Publicar botão somente com fluxo operacional, configurações por ambiente e políticas coerentes. Registrar prova com conta nova/existente e concessão mínima, sem valores secretos.
- [ ] Documentar o efeito de revogação quando Auth e Calendar usam o mesmo projeto Google; preservar sessão/cookies próprios do produto e retorno esperado.

**Adiável:** Apple, link manual de contas, cobrança e alterações comerciais. Configuração Google fica no aceite desta entrega, não bloqueia o login por senha já liberado.

### P2-02 — Exibir detalhes e permissões reais dos eventos Google

**O que construir:** na lista de calendário, o usuário abre um evento e compreende conteúdo, participantes, conferência, fuso e limites de edição. Conexões legadas continuam em leitura; essa entrega não modifica eventos remotos.

**Bloqueado por:** nenhum ticket da fase 2. Integrar sobre a versão do calendário que a fase 1 entregou, sem refazer a composição visual.

**Estado de publicação:** posterior; `needs-triage`.

- [ ] Mostrar descrição sanitizada, datas civis de dia inteiro, fuso, participantes e link Meet somente quando fornecidos legitimamente. Usar iniciais quando não houver imagem; não consultar People API só para fotos.
- [ ] Representar evento recorrente, fonte sem permissão de escrita, evento privado/detalhe oculto e ausência de conferência; oferecer acesso ao original sem afirmar capacidade indisponível.
- [ ] Ampliar e versionar a projeção persistida; preencher cache legado por resync controlado, preservar vínculos e não depender de eventos antigos aparecerem no incremental.
- [ ] Paginação completa, recuperação de cursor inválido, duas contas e separação por usuário continuam corretas. Conexões existentes não exigem consentimento de edição.
- [ ] Otimizar as quatro policies de leitura do Calendar preservando dono, sessão/entitlement, fonte selecionada e conta conectada. Demonstrar acesso equivalente e plano de execução em QA, sem alterar grants para silenciar advisors.
- [ ] Detalhe funciona com teclado, celular e ambos os temas; erros de sincronização não inventam conteúdo nem removem seleções válidas.

**Adiável:** consentimento de escrita e editor remoto pertencem a P2-03. Não solicitar scope adicional antes de existir finalidade operacional para o usuário.

### P2-03 — Criar, editar e cancelar eventos Google avulsos

**O que construir:** usuário autoriza edição de uma conexão e cria, altera ou cancela eventos avulsos no calendário autorizado, com descrição, convidados e Meet quando disponíveis.

**Bloqueado por:** P2-02, pelas capacidades reais e projeção compatível usadas pelo editor.

**Estado de publicação:** posterior; `needs-triage`.

- [ ] Modo de leitura permanece padrão; consentimento adicional habilita edição somente após validar scopes concedidos, acesso ao calendário, sessão/entitlement e elegibilidade do evento no servidor.
- [ ] Aceitar conexões antigas de leitura e novas de escrita sem exigir scopes redundantes. Reduzir para leitura bloqueia comandos imediatamente; informar diferença entre restrição local e revogação Google.
- [ ] Criar/editar título, período/fuso, dia inteiro, descrição e convidados; avisar o envio de convites/atualizações. Meet mostra pendência/falha real e reintento não duplica evento.
- [ ] Recorrentes e instâncias de série permanecem em leitura; não criar cópia avulsa para contornar a restrição. Cancelamento avulso exige confirmação e não passa pela lixeira local.
- [ ] Uma intenção de criação produz um evento. Edição/cancelamento usam revisão remota; conflito conserva rascunho e exige nova escolha. Timeout conserva resultado incerto e concilia antes de nova tentativa.
- [ ] Permissão alterada, desconexão, credencial revogada e conta trocada entre abas bloqueiam efeitos indevidos; segredo e conteúdo pessoal não aparecem em logs/ADM.
- [ ] Provar efeitos remotos com contas de teste e gates de consentimento/verificação aplicáveis, além dos testes de contrato/isolamento. Desligar flag impede novas escritas sem descartar intenções pendentes.

**Adiável:** séries/ocorrências recorrentes, gestão/compartilhamento de calendários e fotos de convidados. O ticket é limitado ao ciclo completo de um evento avulso; não reescreve o sincronizador existente.

### P2-04 — Consultar minhas tarefas ClickUp no Segundo Cérebro

**O que construir:** usuário conecta sua identidade ClickUp, escolhe Workspaces e vê uma seção própria com suas tarefas/subtarefas acionáveis, atualizada ao abrir ou manualmente.

**Bloqueado por:** nenhum ticket da fase 2. Exige o contrato de acesso já existente e a linha de base de dados reconciliada antes da migration.

**Estado de publicação:** posterior; `needs-triage`.

- [ ] OAuth usa intenção de uso único vinculada à sessão; a identidade remota vem do provedor. Credencial é cifrada e nunca entregue ao navegador. Interface pública não pede token pessoal.
- [ ] Listar somente tarefas/subtarefas atribuídas ao usuário e não concluídas, com status reais; paginar além de 100 itens. Estado Done/Closed não depende de rótulo traduzido.
- [ ] Pai de terceiro é somente contexto quando acessível; pai inacessível não revela título/conteúdo. Filhos de outras pessoas não entram em contagens ou controles acionáveis.
- [ ] A seção informa origem/Workspace/lista, horário da última atualização e link original. Não converte espelhos em tarefas nativas nem mistura progresso/estados dos dois módulos.
- [ ] Abrir/manual compartilham sincronização deduplicada; falha parcial não publica cursor completo nem remove itens por ausência numa página que falhou. Reconciliação retira concluídos/desatribuídos.
- [ ] Desconectar impede novas chamadas e invalida respostas atrasadas, limpando credencial/cache local. Não afirmar revogação remota quando só houve desconexão local.
- [ ] Dois usuários, Workspaces distintos, revogação e reconexão passam ensaio conectado em QA; dados remotos sanitizados e segregados.

**Adiável:** edição, comentários no app, sincronização sem aba aberta, webhooks e Chat. O ciclo manual já deve ser demonstrável isoladamente.

### P2-05 — Atualizar tarefas ClickUp e conversar nos comentários

**O que construir:** dentro do detalhe de uma tarefa própria, o usuário altera status/descrição e lê/envia comentários usando a identidade conectada, vendo confirmação ou resultado incerto.

**Bloqueado por:** P2-04.

**Estado de publicação:** posterior; `needs-triage`.

- [ ] Oferecer status válidos da lista e editar somente campos suportados; preservar campos não alterados. Texto remoto passa por sanitização.
- [ ] Revalidar acesso, responsabilidade e elegibilidade antes de cada envio. Perder atribuição conserva rascunho para copiar, bloqueia efeito e retira o item da fila na próxima reconciliação.
- [ ] Divergência desde a leitura é apresentada antes da gravação; enviar apenas campos alterados e reler o resultado. Não prometer CAS/serialização inexistentes no provider.
- [ ] Ler/enviar comentários de tarefa com indicação da conta autora e de possíveis notificações; não construir Chat/DM.
- [ ] Duplicata local de intenção não repete efeito; timeout de comentário mantém texto e estado incerto, sem retry automático nem deduplicação apenas por texto igual.
- [ ] Concorrência, status inválido, perda de permissão, timeout e confirmação remota são verificados com dados de teste. Espelho só mostra sucesso confirmado/reconciliado.

**Adiável:** Custom Fields editáveis, anexos espelhados, tarefas de terceiros, Chat e atualização de workflow do Workspace.

### P2-06 — Manter tarefas ClickUp atualizadas com a página fechada

**O que construir:** mesmo sem aba aberta, a seção ClickUp permanece atualizada com alvo aproximado de cinco minutos; o usuário vê atraso/falha e consegue solicitar nova sincronização.

**Bloqueado por:** P2-04. Não depende de P2-05.

**Estado de publicação:** posterior; `needs-triage`.

- [ ] Um executor de servidor sincroniza conexões elegíveis com fila limitada, jitter, lease e backoff; abertura/manual usam o mesmo coordenador, sem chamadas concorrentes duplicadas.
- [ ] Demonstrar atualização com navegador fechado; não substituir job por intervalo JavaScript. Apresentar horário real/atraso, sem promessa de tempo real ou SLA exato.
- [ ] Cursor só avança após páginas confirmadas; reconciliação periódica remove concluídos, desatribuídos e inacessíveis sem transformar erro temporário em exclusão remota.
- [ ] Desconectar/reconectar invalida gerações antigas e impede cache reaparecer; lease expirada não prova que uma chamada antiga terminou.
- [ ] Verificar autenticação do executor, duplicatas, 429, volume, atraso e recuperação; registrar consumo/limites e telemetria mínima sem conteúdo de tarefas.
- [ ] Exibir controles coerentes com a disponibilidade: flag suspende trabalho futuro; operação incerta continua conciliável. Scheduler e evidência de execução próprios, sem usar cron de onboarding/Google como prova.

**Adiável:** webhooks e infraestrutura nova sem necessidade medida. Usar o executor adequado ao ambiente autorizado, sem contratar plano automaticamente.

### P2-07 — Acessar o ADM separado com MFA e consultar contas

**O que construir:** o Master entra em `adm.segundocerebroapp.com.br` por login próprio com MFA e consulta contas/metadados administrativos paginados em um ambiente separado do produto.

**Bloqueado por:** nenhum ticket da fase 2. Reutilizar identidade/roles/moderação/saga existentes e o cadastro da fase 1 quando integrado.

**Estado de publicação:** posterior; `needs-triage`.

- [ ] Novo deploy permite login/MFA, leitura paginada/ficha mínima, refresh e logout com recuperação operacional ensaiada; não duplica usuários em outro Auth.
- [ ] Cookie host-only próprio e vínculo administrativo server-side por sessão impedem acesso automático pela sessão do produto. Reapresentar bearer do produto não concede autoridade administrativa.
- [ ] Toda consulta valida Master, moderação, veto, sessão e nível MFA; metadados editáveis, Host/Origin arbitrários ou menu oculto não concedem autorização.
- [ ] DTOs excluem conteúdo de notas, financeiro, Cofre, agendas, tarefas, arquivos e credenciais. Domínio distinto não substitui guards/RLS/RPCs.
- [ ] Usuário comum, Master bloqueado/vetado, sessão revogada e ausência de MFA são negados em chamadas diretas; proteger origem/CSRF sem confiar só em SameSite.
- [ ] O Admin legado continua operante nesta entrega. O novo host não publica gestão incompleta nem cria proxy transparente para os canais antigos.

**Adiável:** corte do legado, novos comandos, liberação de módulos, respostas a feedback e roadmap. DNS/TLS/Auth efetivos precisam de evidência antes da liberação deste acesso.

### P2-08 — Transferir a operação administrativa e cortar os canais antigos

**O que construir:** Master executa no ADM separado as operações atuais de conta e os recursos administrativos que a fase 1 já entregou; depois de ensaiar contingência, a página e as APIs administrativas antigas deixam de operar no produto.

**Bloqueado por:** P2-07; tickets da fase 1 de métricas Master e snapshot UTM, para migrar o comportamento realmente entregue. Não depende de P2-09 ou P2-10.

**Estado de publicação:** posterior; `needs-triage`.

- [ ] Criar/bloquear/desbloquear conta, exigir troca de senha, alterar papel/veto e acompanhar resultado usam a saga existente com proteção do último Master e conciliação de efeitos incertos.
- [ ] Migrar sem duplicar dados/semântica os recursos Master da fase 1: métricas com definições existentes e snapshot dos cinco UTMs conforme acesso permitido. Feedback de usuários permanece no produto; não há fila administrativa entregue na fase 1. Atualizações versionadas do produto continuam acessíveis.
- [ ] Limitar atribuição ao snapshot da fase 1; ausência de dados aparece como ausência. Não criar visitantes, timeline de navegação, eventos genéricos ou reconstrução retroativa.
- [ ] Confirmar operador habilitado, recuperação, ações permitidas e conciliação de pendências em contingência ensaiada antes do corte. Logs/recibos não contêm conteúdo pessoal ou segredos.
- [ ] Retirar navegação e impedir dados/efeitos nas páginas/APIs administrativas antigas, inclusive diagnóstico de Calendar, hosts alternativos e chamadas diretas. Não encaminhar cookies nem manter proxy privilegiado no host do produto.
- [ ] Verificar operação no novo host após o corte. Rollback preserva contingência; não reabre APIs antigas automaticamente nem deixa cadastro/feedback sem gestão.

**Adiável:** funcionalidades novas de P2-09/P2-10. O ticket transfere o conjunto administrativo existente no candidato, sem incorporar a jornada complexa do pacote antigo.

### P2-09 — Responder feedbacks em privado e publicar o roadmap

**O que construir:** Master acompanha feedbacks no ADM, responde ao autor no app e publica cards editoriais num roadmap visível somente a usuários autenticados. Reclamações e identidades continuam privadas.

**Bloqueado por:** P2-07; tickets da fase 1 de feedback persistente e quadro de atualizações versionado. Não depende do corte P2-08.

**Estado de publicação:** posterior; `needs-triage`.

- [ ] Reutilizar pedidos/donos/histórico da fase 1; Master categoriza/acompanha/encerra e envia resposta visível somente ao autor. Notas internas têm contrato separado e nunca entram no DTO do usuário.
- [ ] Autor vê resposta e estado no próprio app; dois usuários não leem pedidos/respostas um do outro por ID direto, busca, cache ou payload manipulado. Não enviar e-mail ou mensagem externa por inferência.
- [ ] Roadmap autenticado organiza Planejado, Em análise, Em andamento, Em fase de testes e Lançado; somente card explicitamente publicado aparece. Texto editorial não copia automaticamente feedback, e-mail ou identidade.
- [ ] Vínculo entre pedido e card é privado; publicação/reordenação/retirada é auditada e idempotente. Preservar IDs/conteúdo/estados da única superfície Atualizações da fase 1; importar para fonte administrável e trocar a origem de leitura com reversão, sem segundo quadro ativo.
- [ ] Cumprir 12 meses de calendário após encerramento: reabertura legítima muda o marco de forma auditada; visualização não prorroga. Implementar/validar o executor necessário da retenção de feedback sem depender da purga de tarefas/capturas/páginas.
- [ ] Falha preserva rascunho e não duplica resposta/publicação. Provar acesso Master, histórico do autor, exclusão/expiração prevista e isolamento; só prometer acompanhamento depois do canal operacional funcionar.

**Adiável:** roadmap público, anexos, notificações externas, votos públicos e CMS genérico fora do quadro editorial já definido. A retenção de feedback não herda sete dias da lixeira.

### P2-10 — Controlar liberação de funcionalidades pelo ADM

**O que construir:** Master escolhe uma funcionalidade já implementada e a mantém fechada, libera para um piloto ou abre aos usuários elegíveis, com prévia do impacto e autorização consistente.

**Bloqueado por:** P2-07. Não depende de P2-08; não é pré-requisito retroativo das entregas já funcionais da fase 1.

**Estado de publicação:** posterior; `needs-triage`.

- [ ] Administrar somente chaves conhecidas e implementadas; novos recursos começam fechados. Demonstrar o fluxo completo com capacidade real do candidato, sem rota arbitrária ou feature fictícia.
- [ ] Migrar capacidades atuais para preservar exatamente o acesso vigente; ausência histórica de entitlement não vira negativa global. Gratuidade e contas existentes permanecem intactas.
- [ ] Separar disponibilidade, direito da pessoa e preferência visual; piloto não ignora moderação/vetos e esconder aba não é autorização.
- [ ] Mudança passa por confirmação de impacto e revisão/idempotência; usuário não se concede acesso por payload, preferência ou metadata de Auth.
- [ ] UI, URL direta, API/RPC e jobs aplicam a mesma regra. Revogação bloqueia novas operações sem apagar dados nem interromper conciliação/limpeza indispensáveis.
- [ ] Evidenciar aberto/piloto/fechado com dois usuários, caches/sessão antiga e chamadas diretas; auditoria registra apenas metadados permitidos.

**Adiável:** planos comerciais, cobrança, equipe de suporte com novos papéis e sistema genérico de feature flags para experimentos. A liberação operacional desta capacidade não pode atrasar por herança o acesso gratuito da fase 1.

### P2-11 — Excluir definitivamente itens da lixeira sem quebrar referências

**O que construir:** usuário confirma a exclusão permanente de tarefa, captura ou página já na lixeira; o item deixa de existir nas cópias ativas previstas e os conteúdos legítimos relacionados continuam utilizáveis. A restauração normal permanece disponível até uma exclusão definitiva confirmada.

**Bloqueado por:** nenhum ticket da fase 2. Reconciliar histórico/catálogo e contratos referenciais antes das migrations; isso deve reutilizar a preparação concluída na fase 1.

**Estado de publicação:** posterior; `needs-triage`.

- [ ] Ação distingue arquivado, excluído e removido definitivamente; confirmação informa identidade, alcance e irreversibilidade. Somente dono autorizado pode agir, inclusive em chamadas diretas.
- [ ] Remover tarefa conserva captura/projeto/página/evento sobrevivente. Remover captura promovida conserva a página/tarefa resultante e suas imagens, com origem histórica mínima compatível com FK/guarda de imutabilidade.
- [ ] Exclusão de página considera subárvore e lotes: descendente ativo, restaurado ou fora do alcance confirmado impede cascata indevida. Resultado e backlinks sobreviventes não preservam texto excluído.
- [ ] Coordenar exclusão física de imagem somente sem referência legítima; falha no Storage fica pendente para reconciliação e não é rotulada como limpeza concluída.
- [ ] Corrida restauração/exclusão tem um vencedor confirmado. Repetir intenção é seguro; recibos/eventos/cache/busca têm conteúdo removido ou reduzido sem apagar compromisso mínimo que impede replay/ressurreição.
- [ ] Fixtures de tarefas vinculadas, captura promovida, imagens compartilhadas legitimamente, árvore de páginas e dois donos passam testes de integridade/concorrência; os três percursos são demonstráveis pela interface.
- [ ] Registrar limites das cópias/backups e procedimento de reaplicação de tombstones antes de reabrir cópia restaurada. Não prometer eliminação instantânea de todos os backups.

**Adiável:** prazo e execução automática de sete dias, operações em massa não necessárias e exclusão remota Google/ClickUp. A divisão interna por entidade usa o mesmo contrato de exclusão; não liberar destruição de uma entidade antes de validar suas referências. Se o diff exceder uma janela de execução, subdividir este ticket por entidade na triagem, preservando o mesmo aceite final e sem criar ticket apenas de schema.

### P2-12 — Aplicar retenção automática de sete dias na lixeira

**O que construir:** depois de ativada a política, a lixeira mostra data real de elegibilidade; itens expirados são removidos pelo mesmo mecanismo seguro de exclusão permanente, com recuperação de falhas e carência explícita para legados.

**Bloqueado por:** P2-11, que fornece o ciclo de exclusão permanente seguro para as três entidades.

**Estado de publicação:** posterior; `needs-triage`.

- [ ] Novas exclusões vencem após sete dias de 24 horas contados no servidor; arquivamento não inicia prazo. Datas locais da interface correspondem ao timestamp persistido.
- [ ] Itens legados recebem pelo menos sete dias de carência desde a ativação, sem reescrever a exclusão original; marco de ativação é auditado e backfill idempotente.
- [ ] Restaurar antes da purga confirmada cancela elegibilidade; nova exclusão inicia novo prazo. Revalidar estado/prazo/dono na mesma transação de cada item, sem corrida destrutiva com restauração.
- [ ] Executor trabalha em lotes limitados, tolera repetição/falha e respeita dependências de árvores/arquivos; registrar sucesso/atraso sanitizado. Job de retenção do onboarding existente permanece independente.
- [ ] Aviso e contador só são habilitados quando a política e o executor correspondentes funcionam. Expiração significa elegibilidade para processamento, sem promessa de remoção no segundo exato.
- [ ] Provar carência, fronteira temporal, concorrência, interrupção/retomada e não ressurreição em QA; antes de ativar produção, conferir inventário agregado, comunicação, destino e autorização aplicáveis.
- [ ] Flag pausa processamento futuro; não restaura o que foi definitivamente removido. Falha operacional fica detectável e tem responsável/procedimento de retomada.

**Adiável:** novas categorias de dados, retenção de integrações, feedback, métricas ou logs. Cada uma possui finalidade/prazo próprios; não aplicar sete dias por conveniência.

## Mapa documental e técnico para o PR

Os caminhos abaixo são **mapa de referência**, não instruções para congelar arquivos nas issues. Reconciliar com a main no início de cada ticket; caminhos propostos continuam identificados como propostas nos documentos fonte.

| Tickets | Documentos do pacote | Pontos atuais de código/contrato para explorar |
|---|---|---|
| Todos | `05-plano-executivo.md`, `11-testes-e-criterios-de-aceite.md`, `12-riscos-operacao-e-liberacao.md`, `16-auditoria-supabase.md`; novo documento de faseamento prevalece sobre a sequência antiga | `AGENTS.md`, `CONTEXT.md`, `docs/implementation/decisoes-operacionais.md`, `supabase/migrations/`, `supabase/tests/release-catalog.sql`, `supabase/operations/onboarding-conflict-code.sql` |
| P2-01 | `06-integracoes-e-google-cloud.md`, §§2.2, 4 e 10; contratos finais de cadastro da fase 1 | `src/lib/auth/runtime.ts`, `service.ts`, `ports.ts`, `actions.ts`; recovery atual em `src/app/auth/callback/route.ts`; provider social/retorno próprios ainda a implementar |
| P2-02/03 | `06-integracoes-e-google-cloud.md`, §§2.1, 2.3, 5 e 10; `08-plano-visual-e-fluxos.md`; fase 1 A06 | `src/core/calendario/`, `src/adapters/db/google-calendar-provider.ts`, `google-calendar-security.ts`, `google-calendar-runtime.ts`, `src/components/features/calendario/`; migrations Calendar/participantes e suites de catálogo/comportamento |
| P2-04/05/06 | `06-integracoes-e-google-cloud.md`, §§6–8 e 10; `15-providencias-do-mantenedor.md` | `src/app/(workspace)/integracoes/page.tsx`, composição de Tarefas e fronteiras Core/adapters existentes; módulo, credenciais, espelho, journal e worker ClickUp são novos, conforme mapa proposto do doc 06 |
| P2-07/08/10 | `09-administracao-separada.md`, `07-dados-seguranca-e-retencao.md`, §§6–7; contratos e telas Master da fase 1 | `src/core/admin/`, `src/adapters/db/admin-runtime.ts`, `src/app/api/admin/route.ts`, `src/app/api/calendar/admin-runs/route.ts`, `src/lib/auth/cookie-policy.ts`, `src/core/access/resolve-access.ts`; ADR-0007 e saga/guards SQL existentes |
| P2-09 | `07-dados-seguranca-e-retencao.md`, §5; `09-administracao-separada.md`; contrato de feedback da fase 1 | Estruturas de feedback surgirão na fase 1 e devem ser descobertas no candidato; roadmap e respostas administrativas são deltas. Não presumir implementação atual nem criar segunda tabela de pedidos |
| P2-11/12 | `07-dados-seguranca-e-retencao.md`, §4; `11-testes-e-criterios-de-aceite.md`; `16-auditoria-supabase.md` | `src/core/tarefas/`, `src/core/capturas/`, `src/core/conhecimento/`, `src/app/api/files/cleanup/route.ts`; relações e guarda de origem em `supabase/migrations/20261009144350_knowledge_pages_links.sql`; contratos de recibos/eventos, Storage e recuperação |

O doc 10 é referência histórica para distinguir o que **não** entra: snapshot simples/definições da fase 1 prevalecem sobre a jornada complexa anterior. Não inserir links para sua seção de coleta detalhada como aceite implícito de P2-08.

## Observações de integração e publicação

1. Conferir duplicatas e comentários das issues reais antes da publicação; preservar IDs e histórico existentes. Este insumo não fecha nem altera issue pai.
2. Corpo de issue recebe referência ao épico/PR documental e às seções relevantes; caminhos técnicos ficam no mapa do PR. Dependências nativas devem representar somente as arestas da tabela, não todas as referências de leitura.
3. `needs-triage` e identificação de fase posterior são intencionais. Ter critério detalhado não autoriza iniciar a fase 2 nem contratar/configurar serviços; mudar para pronto exige liberação e pré-requisitos reais.
4. Não herdar a antiga exigência de ADM novo para feedback mínimo/métricas/cadastro da fase 1. Na fase 2, P2-08 migra o que estiver funcionando e só corta canais depois da prova de substituição/contingência.
5. Cada ticket inclui a própria validação necessária e evidência de release; não criar um ticket genérico de testes do qual tudo dependa artificialmente. Registrar implementado, validado e pendente separadamente.
6. As configurações ainda não auditadas — Auth provider, SMTP/DNS, schemas expostos pela Data API, backups, QA e runtime — continuam checklists operacionais das entregas aplicáveis. A auditoria de 67 tabelas/2.512 checks não substitui seus testes conectados.

## Síntese para o coordenador

O conjunto preserva as capacidades aprovadas e reduz acoplamento: Google social isolado de Calendar; ClickUp primeiro útil por leitura/manual, depois escrita e fundo em paralelo; ADM primeiro acesso/leitura, depois corte, feedback/roadmap e releases em percursos próprios; exclusão permanente antes de automatizar prazo. A fase 1 pode ser publicada com cadastro gratuito, Master legado, snapshot UTM simples, feedback mínimo e atualizações versionadas sem executar qualquer ticket desta fase 2.
