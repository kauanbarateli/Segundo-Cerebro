# Dados, segurança e retenção

Plano técnico proposto sobre o SHA registrado no índice. **Nenhum SQL de alteração foi executado.** Os nomes novos deste documento são recomendados; reconciliar com os modelos definitivos dos docs06/09/10 e o catálogo remoto antes de criar migrations.

## 1. Fronteiras que permanecem

Usuário continua sendo a unidade de isolamento; não criar tenant/workspace de produto por causa de Workspaces do ClickUp. Core não depende de Next/React/SDK. Canais autenticam/validam e chamam casos de uso; adapters persistem. Escrita local de domínio e evento mínimo acontecem na mesma transação. Google/ClickUp/Auth são efeitos externos e exigem saga/recibo próprios, sem afirmar transação distribuída.

Credenciais externas ficam cifradas em estrutura privada e nunca no payload do navegador, log, captura, Git ou variável `NEXT_PUBLIC_*`. RLS deve existir em tabelas expostas, com privilégios mínimos; políticas de UPDATE verificam origem e destino. Views seguem RLS ou ficam privadas. Não usar `user_metadata` editável como autorização. Sessão/JWT antigos não bastam para uma operação administrativa depois de revogação. [RLS Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security).

## 2. Inventário de evolução

| Domínio | Base existente | Evolução proposta | Canal e acesso |
| --- | --- | --- | --- |
| Identidade e beta | Auth/perfil/papel/moderação/sessões; login/recovery | Registro idempotente de origem de cadastro, início único de avaliação, elegibilidade beta e gratuidade legada explícita; ciência de versão das políticas no cadastro | Auth verificado; usuário não escreve papel, isenção, prazo ou entitlement por metadados livres |
| Funcionalidades | `FEATURE_KEYS`, entitlements e preferências | Catálogo de capacidades lançadas/restritas e concessões, com defaults distintos para existentes/novas; histórico de alterações | ADM autorizado altera disponibilidade; app calcula acesso por caso de uso; preferência apenas visual |
| Capturas | Documento estruturado, anexos de imagem, recibos/draft/CAS | Modal usa modelo atual; sem tipo novo ou tabela paralela de notas | Mesmo contrato `/api/capture-tasks` e Storage privado |
| Conhecimento | Cadernos/páginas/hierarquia, origem de captura, refs e lote de exclusão | Purga que respeita lote/referências e conteúdo promovido, sem transformar cópia sobrevivente em órfã | Dono e direitos da operação; nenhuma leitura administrativa de conteúdo |
| Calendar | Conexões/fontes/eventos, tokens/cursor privados | Modo solicitado, scopes concedidos, ACL, campos de leitura novos, etag e intenções de escrita | Modos e ACL verificados no servidor; operação em nome do usuário autorizado |
| ClickUp | Ausente na main | Conexão, credencial privada, espelho de tarefas, relações remotas, cursor/job/intenção | Dados por usuário; pai de terceiro somente contextual e autorizado; sem acesso implícito à equipe |
| Lixeira | `deleted_at`, restauração, eventos/recibos | Marco de ativação, cálculo de elegibilidade, purga/locks, tombstones e manutenção observável | Dono para ação manual; job privilegiado mínimo para automação, separado da UI |
| Feedback | Ausente | Pedido, respostas/transições, relação opcional ao item do roadmap, retenção | Autor e operador autorizado; sem leitura cruzada, status/reply não editáveis por usuário |
| Roadmap | Ausente | Item editorial, estado, ordem, publicação e vínculos privados a feedback | Usuários autenticados leem somente publicado; ADM publica/move; sem autor de feedback exposto |
| ADM | Saga de contas e auditoria | Canal separado, sessão forte, configuração de origem, consultas operacionais mínimas | Master e capacidades verificadas no servidor/banco; sem confiar no subdomínio como privilégio |
| UTM/atividade | Planejamento histórico; código de coleta ausente | Consentimento, jornada, vínculo comprovado e contadores de uso minimizados | Aquisição facultativa e retirada; leitura individual administrativa explicitamente limitada no doc 10 |

## 3. Entrada aberta e provisão

1. E-mail/senha ou Google produz identidade comprovada por fluxo próprio. Recovery continua distinto.
2. Reutilizar fundação de perfil/papel/moderação, revisar triggers da saga existente e garantir que repetição não crie segunda conta/entitlements duplicados. Cadastro público nunca usa poder Admin entregue ao navegador.
3. **RECOMENDADO:** `evaluation_started_at` na primeira sessão confirmada, uma única vez; término em 168 horas. O vencimento muda a apresentação, não revoga beta. Estado desconhecido não equivale a gratuidade perpétua; resolver por regra explícita de migração/legado.
4. Usuários antigos conservam isenções e decisões de moderação. Não converter “sem registro comercial” em prova de isenção sem identificar a população da migração.
5. Ciência de políticas e consentimento de aquisição são registros distintos. O cadastro funciona sem atribuição; não juntar aceite de marketing. Registrar versão/instante necessários sem armazenar documentos completos em cada evento.
6. Conta social pode não ter senha local: reautenticação, troca de e-mail e operações sensíveis precisam respeitar a identidade real, sem pedir senha inexistente ou permitir bypass.

## 4. Contrato de lixeira

### Elegibilidade e transição

- Tarefas, capturas e páginas: somente `deleted_at` inicia prazo; arquivamento não inicia.
- Novas exclusões após ativação: `purge_at = deleted_at + 7 × 24h`, calculado no servidor em UTC. Interface pode apresentar data/hora local.
- Itens já na lixeira na ativação: `purge_at = max(deleted_at + 7 × 24h, activated_at + 7 × 24h)`. Preservar data original e marco de ativação auditado.
- Restaurar antes de uma purga confirmada cancela a elegibilidade; nova exclusão começa um prazo novo. A confirmação de exclusão permanente manual não precisa esperar7 dias, mas mostra identidade/quantidade/irreversibilidade.
- Após o prazo, item torna-se elegível; o job executa em lotes. **RECOMENDADO:** intervalo horário e indicador de falha/atraso; não prometer exclusão no segundo exato se o scheduler não tem essa garantia.

### Transação e concorrência

Buscar lote indexado e limitado; travar ou reclamar cada candidato, revalidar dono/estado/prazo na mesma transação e eliminar somente quem permanece elegível. Restore vencedor impede purga; purga vencedora devolve estado definitivo e não cria restauração fictícia. Retomar lotes por cursor seguro, tolerar repetição e impedir dois workers de processar o mesmo item simultaneamente.

Antes de habilitar, validar as dependências reais de cada entidade:

- **Tarefa:** vínculos de captura, projeto, evento, páginas e relacionamentos polimórficos. Remover o vínculo/referência derivada ou preservar marcador legível conforme contrato; não excluir o outro registro.
- **Captura:** `origin_capture_id` de página promovida, documento/arquivos, tarefas convertidas. A página/tarefa sobrevivente conserva identidade/conteúdo. Na base, a FK `knowledge_pages.origin_capture_id` e o trigger da migration `20261009144350_knowledge_pages_links.sql` impedem simplesmente apagar/reapontar a origem: criar migration nova de compatibilidade para FK, guarda de imutabilidade e payload/DTO. A operação privilegiada de purga pode converter a origem em marcador histórico mínimo sem conteúdo, conservando a imutabilidade nas edições normais. Não alterar a migration histórica nem aplicar cascata que remova página/imagens ativas; testar promoção, origem removida e uso posterior da página.
- **Página:** `parent_id`, filhos, `deletion_batch_id`, refs, caderno e backlinks. Purga de árvore trabalha de folhas para pais elegíveis; descendente ativo/restaurado ou ainda não elegível impede cascata destrutiva. Revalidar hierarquia e regras de restauração existentes; confirmação manual mostra alcance. Preservar vínculos sobreviventes com estado “conteúdo removido”, sem manter o texto excluído.
- **Imagem:** remover somente quando não houver referência legítima em captura/página/capa. Usar fila de remoção privada e reconciliação entre banco/Storage, pois excluir objeto não participa da transação Postgres. Falha no Storage não recebe status “limpeza concluída”.
- **Busca/cache:** invalidar registros e resultados derivados; não depender só de esconder a linha na UI.

### Eventos, recibos e cópias

A rotina atual `app_private.prune_operational_data()` trata eventos operacionais, não a lixeira. Recibos são conservados para evitar replays tardios. Uma purga que apaga apenas a linha deixa conteúdo em `before/after` e respostas de comandos.

Planejar redução dos payloads afetados sem retirar as identidades/compromissos mínimos de idempotência: tombstone e resultado “removido definitivamente” impedem que um retry antigo recrie o objeto ou devolva seu conteúdo. Não gravar o documento inteiro no evento de purga. Reconciliar hashes/compromissos e testes do protocolo antes de transformar recibos; não simplesmente apagá-los.

Backups têm janela própria: informar limites e reaplicar expiração/tombstones antes de disponibilizar uma cópia restaurada. Não afirmar limpeza instantânea de todas as cópias nem usar backup como desfazer automático de exclusão confirmada. O prazo de backups deve ser conferido no serviço; não foi determinado por este pacote.

## 5. Feedback e roadmap

Nomes conceituais recomendados, a reconciliar com doc 09: `feedback_requests` (dono, categoria, texto, estado, timestamps, encerramento), `feedback_updates` (pedido, resposta, ator, instante), `roadmap_items` (título/resumo/estado/ordem/publicação), `feedback_roadmap_links` (relacionamento privado). Chaves estrangeiras e índices de dono/estado/instante sustentam paginação e retenção.

- Categoria enum proposta: sugestão, reclamação, problema, melhoria e outro. Texto simples com limite inicial recomendado de 4.000 caracteres, validado no servidor; sem HTML, anexos ou dados de diagnóstico coletados silenciosamente.
- Envio usa identificador idempotente e dono derivado da sessão. Autor não escolhe status, dono, visibilidade, operador ou item publicado no payload.
- Estado privado do pedido pode ser recebido/em análise/em acompanhamento/encerrado; não é obrigado a repetir as 5 colunas do roadmap. Resposta/decisão explica encerramento e vínculo quando houver.
- Roadmap autenticado: Planejado, Em análise, Em andamento, Em fase de testes, Lançado. Somente card explicitamente publicado aparece; feedback bruto nunca é copiado automaticamente para o resumo.
- **Decidido:**12 meses após encerramento. Interpretar como meses de calendário em UTC, não360 dias. Reabertura legítima remove `closed_at`; novo encerramento cria novo marco, auditado. Uma simples edição de resposta não prorroga o prazo.
- Pedido de exclusão de conta usa procedimento próprio; retirar relação identificável e respostas privadas. Card editorial sanitizado pode continuar. Regras de preservação excepcional precisam de fundamento registrado e revisão específica, não exclusão automática silenciosa do requisito.
- Retorno aparece no próprio app; não enviar e-mail ou mensagem externa por inferência.

## 6. Permissões, exposição e operação administrativa

Host do produto e host ADM terão canais e sessões separados. `Domain=.segundocerebroapp.com.br` não deve ser usado para compartilhar cookie privilegiado. Recomenda-se cookie host-only, Secure, HttpOnly, política SameSite adequada e nomes separados, com validação exata de Origin/CSRF; subdomínios podem ser same-site, então SameSite sozinho não resolve ataques entre eles. [Cookie attributes](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie).

Autorização deve existir em comandos e RPCs, independentemente de hostname. RLS e API Supabase continuam acessíveis por seus próprios endereços, por isso um bloqueio no roteador do Next não basta. Preferir credencial do usuário com validação de Master/capacidade; quando credencial privilegiada de servidor for indispensável, preservar validação explícita de ator/alvo e não expor o cliente genérico ao navegador.

Recomendação deMFA TOTP/AAL2 para o ADM; fator, segredo e kit não entram em log nem ficha de usuário. Guard de último Master utilizável e reconciliação de operações incertas permanecem. [TOTP Supabase](https://supabase.com/docs/guides/auth/auth-mfa/totp).

## 7. Migrations e implantação de dados

1. Conferir catálogo de produção e QA por metadados e identificar migrations realmente aplicadas; não presumir que a main e o banco são iguais. UTM tem verificação remota pendente.
2. Elaborar migrations novas em `supabase/migrations/`, usando o gerador/CLI instalado conforme `--help`. Arquivos raiz `migrations/` são referência documental. Não numerar/editar SQL histórico para acomodar o plano.
3. Usar expansão compatível: estruturas/colunas novas e defaults seguros; leitura compatível com dados anteriores; backfill idempotente e auditado sem sobrescrever escolhas.
4. Asserções de catálogo/RLS/concorrência ficam separadas, usam dados sintéticos e rollback. Tipos oficiais e portas do Core precisam permanecer coerentes.
5. Registrar application order, lock/tempo esperado e estratégia de interrupção. Aplicação supervisionada somente nos destinos pessoais autorizados, sem CI/build/deploy executar schema.
6. Testar primeiro em QA. Ativar flags por entrega após prova; purga fica desligada até comunicação e carência estabelecidas. Desativar flag interrompe trabalho futuro, não reverte dado purgado.

## 8. Matriz resumida de retenção

| Informação | Marco / prazo | Natureza da regra |
| --- | --- | --- |
| Tarefa/captura/página na lixeira |7 dias; carência mínima7 dias para legado na ativação | Decidida Q8/Q9; job e limpeza ainda a implementar |
| Arquivados | Sem expiração pela regra da lixeira | Preservação do modelo existente |
| Feedback encerrado |12 meses após encerramento; exclusão de conta tratada separadamente | Decidida Q17 |
| UTM antes/depois do cadastro | Janela e marco propostos no doc 10, com retirada antecipada | Extensão técnica do novo pedido; validar no plano, não atribuir a Q17 |
| Credencial Google/ClickUp | Enquanto conexão autorizada; tratamento de revogação/limpeza no doc 06 | Recomendação técnica; segredos nunca aparecem em relatório |
| Recibos/tombstones | Preservar metadados mínimos que garantem protocolo; reduzir conteúdo purgado | Compatibilidade de idempotência; não impor expiração arbitrária |
| Auditoria operacional/segurança | Reconciliar rotinas atuais e retenção por finalidade | Não herdar automaticamente12 meses de feedback |
| Backups/fornecedores | Conferir contrato/configuração e mecanismo de não ressurreição | Não verificado nesta análise |

## 9. Provas mínimas de segurança

Dois usuários e um Master em ambiente de teste; acesso cruzado negado em HTTP e SQL/RLS; usuário comum não se promove nem publica feature; token revogado e sessão antiga negados; callbacks com state trocado falham; cache não mistura donos; nenhuma resposta administrativa inclui conteúdo de domínio pessoal; exclusão limpa as cópias ativas previstas sem permitir replay. As propostas são verificadas pelos casos do doc 11, não por screenshots isolados.

## Base remota verificada e ordem das migrations

A auditoria do [doc 16](16-auditoria-supabase.md) substitui a pendência de acesso ao catálogo: 67 tabelas esperadas presentes e com RLS. Entretanto, 27 arquivos de migrations correspondem a apenas cinco registros no ledger. Antes de gerar/aplicar mudanças, reconciliar proveniência, reprodução em QA e o patch operacional PT409. Não reaplicar as 22 sem registro nem executar repair em lote sem prova por arquivo.

Preservar os 36 casos intencionais de RLS sem policy e os canais RPC de escrita; não abrir acesso direto para remover avisos. Os buckets privados atuais têm limite de 25 MiB, e MIME nulo no bucket não substitui a validação por funcionalidade. O cron de onboarding roda a cada 15 minutos e teve 96/96 sucessos na janela consultada: isso não implementa a lixeira de sete dias ou retenção de feedback/UTM.

Não foram encontradas estruturas dedicadas para ClickUp, feedback/roadmap, aquisição ou vínculo de sessão do novo ADM no catálogo pesquisado. Os modelos novos acima continuam propostos. Configuração completa de Auth, schemas expostos pela Data API, backups/PITR, QA e testes de isolamento ainda precisam de prova própria.

