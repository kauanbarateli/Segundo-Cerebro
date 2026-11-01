# Testes e critérios de aceite

**Plano de validação funcional futura.** A revisão 1.2 executou a consulta estrutural de catálogo descrita no doc 16; nenhum fluxo funcional do produto foi executado. Cada evidência deve informar SHA, ambiente, hora, cenário, resultado e limitações. Teste em fixture não é teste de provider ou produção.

## Estratégia proporcional ao risco

- Usar testes de domínio para acesso, datas, idempotência, deduplicação, status e retenção; testes de canal/adapters para autenticação, origem, payload, erros e efeitos externos.
- RLS, grants, cascatas, corrida restore/purge e migrações exigem asserções SQL/concorrência, não só mocks. Executar em ambiente autorizado e isolado, com dados sintéticos e protocolo de limpeza.
- E2E prova o fluxo crítico completo e suas falhas. Não escrever testes que apenas fixam classe CSS, redação exata ou estrutura de documentos.
- Alterações visuais reversíveis: inspeção renderizada em lote e verificações de navegação/acessibilidade pertinentes. Não criar centenas de snapshots sem relação com regressão real.
- Google/ClickUp: usar contas/tarefas/eventos QA, conferir resultado remoto e identificar convites/comentários que enviam notificações reais. Nenhum ensaio em contatos/tarefas pessoais por conveniência.

## Matriz funcional mínima

| ID | Cenário | Resultado esperado | Camada / evidência |
| --- | --- | --- | --- |
| AUTH-01 | Cadastro por e-mail confirmado | Uma identidade/perfil/avaliação; onboarding abre e retoma | Core, canal, SQL e E2E QA com SMTP |
| AUTH-02 | Link inválido, expirado, repetido ou de outra sessão | Não troca dono nem cria duplicata; mensagem útil e retry seguro | Canal/E2E |
| AUTH-03 | Google novo e Google de usuário existente | Novo chega ao onboarding; existente conserva conta, dados e destino | ProviderQA/E2E |
| AUTH-04 | E-mail não comprovado coincide com outra identidade | Nenhum merge indevido/tomada de conta | Auth real e contrato |
| AUTH-05 | Usuário bloqueado ou sessão revogada | Cadastro social/login não contorna moderação | HTTP+SQL |
| AUTH-06 | Recovery após adicionar callbacks | Recuperação original continua válida; intent social/cadastro não é aceito como recovery | Testes existentes+novos canais |
| AUTH-07 | Fim dos7 dias e usuário antigo isento | Beta continua funcional; nenhuma cobrança ou restrição inesperada | Relógio fixo+E2E |
| AUTH-08 | Onboarding parcial, skip, retry e deep link | Rascunho versionado preservado; conclusão idempotente; sem reenrolar contas antigas | Core/HTTP/E2E |
| AUTH-09 | Social sem senha local | Operações sensíveis exigem prova adequada, sem senha inexistente nem bypass | ProviderQA/E2E |
| UI-01 | Header público/links da landing | Princípios/âncoras removidos; Entrar/tema acessíveis; CTA leva ao cadastro real; sem preço | Browser e links |
| UI-02 | Termos/privacidade na checkbox | Abrir link não altera ciência ou submete form; teclado/foco/erro corretos | Browser teclado |
| UI-03 | TemaSistema→toggle e sincronização | Um clique alterna resolvido; ícone/nome atualizam; escolha persiste; Sistema permanece disponível | Browser+persistência |
| UI-04 | Drawer/modal e teclado virtual | Foco contido/devolvido, respiro adequado, scroll interno e campos visíveis | Desktop/mobile/zoom |
| CAP-01 | Capturar de outra página | Salva sem navegar, fecha com confirmação e permite abrir nota correta | E2E+reload |
| CAP-02 | Fechar com rascunho ou erro de save | Não perde texto/anexo; decisão de descarte explícita; retorno ao gatilho | E2E |
| CAP-03 | Limites/MIME inválido/imagem excessiva | Servidor rejeita; sem upload órfão permanente nem perda do rascunho | Canal/StorageQA |
| CAP-04 | Timeout, CAS stale e clique repetido | Mesma intenção não duplica; conflito preserva trabalho e escolhas do PR #120 | Core/HTTP/E2E |
| EDIT-01 | Abrir formatação e aplicar à seleção | Seleção mantida; comandos/atalhos e documento continuam corretos | Browser |
| EDIT-02 | Promoção/vínculos/Reader-Edit | IDs/backlinks/rascunhos preservados; sem novo tipo implícito | SQL/E2E |
| CAL-01 | URL antiga view=week/day/month com date/event | Abre lista no contexto correto; nenhum seletor antigo em Configurações | Core/browser |
| CAL-02 | DTO ampliado e cache anterior | Descrição/Meet/ACL chegam após resync; falta/recusa não vira dado inventado | Adapter/SQL/providerQA |
| CAL-03 | Modo readonly e ACL reader | URL/API direta não cria/altera/cancela | HTTP+providerQA |
| CAL-04 | Avulso com fuso/dia inteiro/DST | Datas corretas, fim exclusivo dia inteiro, sem deslocamento ao sincronizar | Core/providerQA |
| CAL-05 | Participantes/Meet | Aviso prévio; convite/atualização correto; Meet pendente/falho tratado | ProviderQA/browser |
| CAL-06 | Etag412, timeout de criação, retry | Não sobrescreve nem duplica; rascunho/resultado incerto resolvidos | Adapter/providerQA |
| CAL-07 | Evento recorrente | Apenas leitura/linkGoogle; nenhum caminho indireto escreve ocorrência/série | HTTP/browser |
| CAL-08 | Revogação, scope parcial,410,429 e outra conta | Isolamento; resync/backoff; conexão degradada honesta | Adapter/providerQA |
| CU-01 | OAuth A/B e Workspaces | Cada dono acessa só suas credenciais/tarefas autorizadas | HTTP/SQL/providerQA |
| CU-02 | Mais de 100 tarefas, status customizados | Paginação completa; done/closed excluídos sem comparar nomes traduzidos | Adapter/providerQA |
| CU-03 | Subtarefa minha sob pai alheio | Pai só contexto permitido; terceiros não ficam editáveis | Core/E2E |
| CU-04 | Conclusão, mudança de responsável, exclusão/remoto inacessível | Espelho sai da fila ativa; reconciliação não depende só de query filtrada | Scheduler/providerQA |
| CU-05 | Status/descrição concorrente | Campos permitidos e mínimos; aviso de conflito; não alegar CAS remoto inexistente | Adapter/providerQA |
| CU-06 | Comentário confirmado/incerto | Uma publicação comprovada; timeout não dispara retry cego | ProviderQA e journal |
| CU-07 | Ao abrir/manual/fundo,429 e cursor parcial | Frescor real; backoff; cursor não salta páginas; meta5min não vira garantia falsa | Worker+telemetriaQA |
| CU-08 | Desconexão/revogação | Novas operações impedidas; token/cache tratados; limitações de revogação remota claras | SQL/providerQA |
| DEL-01 | Antes/no/depois de 7 dias | Apenas elegíveis são purgados; arquivados preservados | Relógio fixo/SQL |
| DEL-02 | Lixeira antiga na ativação | Todos recebem carência mínima7 dias; data original permanece | SQL migração |
| DEL-03 | Restore concorre com purge | Um resultado serializável coerente; sem restaurar item removido ou apagar item restaurado | PostgreSQL concorrente |
| DEL-04 | Página com filhos/restauração parcial/captura promovida | Nenhuma cascata remove descendente ativo ou cópia sobrevivente | SQL/E2E |
| DEL-05 | Anexo compartilhado, evento, recibo, busca e cache | Limpeza de cópias previstas; arquivo útil preservado; payload pessoal purgado | SQL+StorageQA |
| DEL-06 | Retry de comando antigo após purga | Tombstone impede recriação/exposição do conteúdo | Core/SQL |
| DEL-07 | Worker interrompido/repetido/atrasado | Lotes retomáveis, sem duplicidade; alerta de falha e nenhuma falsa conclusão | SchedulerQA |
| DEL-08 | Exclusão permanente manual, cancelar/confirmar/repetir e timeout | Cancelar não altera; confirmar remove só o alvo/alcance informado; retry não duplica; outro dono negado; após reload não oferece restauração fictícia | HTTP+SQL+E2E |
| SET-01 | Duas colunas/uma coluna e saves independentes | Sem sobreposição; salvar aparência não perde perfil/imagem em edição | Browser/persistência |
| PROJ-01 | Sem capa, título longo, zero/muitas tarefas | Hierarquia consistente; progresso derivado; nenhum prazo/status inventado | Browser/core |
| FB-01 | A envia, B tenta ler porID | A consulta próprio pedido; B negado; payload não altera dono/status | HTTP+RLS |
| FB-02 | Operador responde e publica melhoria | Autor vê retorno; card sanitizado só aparece quando publicado | ADM→app E2E |
| FB-03 | Pedido fechado/reaberto e12 meses | Regra de encerramento correta; visualização não prorroga; card pode sobreviver sem vínculo pessoal | Relógio fixo/SQL |
| FB-04 | Anônimo consulta roadmap; usuário comum move/publica por API | Leitura anônima negada; mutações só por operador autorizado e canal administrativo | HTTP+RLS |
| ADM-01 | Comum, bloqueado, Master sem MFA e sessão revogada | Nenhuma leitura/ação administrativa; sem bypass por host/header/metadata | HTTP+RLS |
| ADM-02 | Cookies e CSRF entre subdomínios | Cookie ADM não vai ao produto; origem não autorizada rejeitada | Browser+HTTP |
| ADM-06 | Bearer de sessão do produto reapresentado ao ADM/RPC | Mesmo papelMaster/MFA não substitui vínculo administrativo de sessão emitido pelo fluxo protegido | HTTP+SQL |
| ADM-03 | ÚltimoMaster, saga incerta e replay | Sem perder operador; reconciliação existente preservada | Testes Admin atuais/SQL |
| ADM-04 | Feature fechada/piloto/aberta, veto e preferência | Mesma regra em UI/API/RPC/jobs; novas fechadas; existentes preservadas | Matriz Core/SQL/E2E |
| ADM-05 | Corte das rotas antigas | /admin, /api/admin e saúdeAdmin antiga sem dados/efeitos, inclusive URL direta | Dois deploymentsQA |
| UTM-01 | Ausência/recusa/aceite posterior | Sem coleta persistente anterior; cadastro funciona; não reconstrói visitas | Browser+SQL |
| UTM-02 | Campanha parcial/direct/referral/duplicatas | Pacotes coerentes; direto não apaga campanha nem prolonga prazo | Core |
| UTM-03 | Confirmação/OAuth, outra aba/conta/aparelho | Associação comprovada uma vez; desconhecido permanece desconhecido | HTTP+SQL |
| UTM-04 | Retirada/expiração/callback tardio/restore | Jornada não ressuscita em projeção, evento, recibo ou cache | SQL+ensaio autorizado |
| UTM-05 | Consulta individual e grupos pequenos | Só operador autorizado; auditoria mínima; agregados não revelam além do contrato | RLS/API |
| MET-01 | Contas criadas, verificadas, DAU/WAU/MAU | Definições reproduzíveis; distintos e fuso corretos; sem inferir online | Fixture determinística |
| MET-02 | Prefetch/cron/refresh/QA/admin/telemetriafalha | Não inflar uso; exclusões explícitas; falha não impede trabalho | Core/HTTP |

## Matriz visual

Verificar as superfícies alteradas em 320,390,768e1440px; claro/escuro; sidebar expandida/recolhida quando aplicável. Incluir teclado, zoom200%, movimento reduzido e teclado virtual. Não exige produto cartesiano indiscriminado: capturas desktop+mobile por tema, variantes relevantes nos componentes compartilhados e fluxos críticos nos demais tamanhos.

Confirmar títulos/labels legíveis, campos≥16px, alvos≥44px, contraste real, foco e ordemDOM. Testar vazio, loading, erro, offline/transporte incerto, conteúdo longo, dado ausente, poucas/muitas linhas e permissão negada. Cor nunca é a única indicação. Comparar imagens de referência como direção, não como prova de dados reais.

## Comandos existentes e execução futura

Conferir scripts no `package.json` do SHA de trabalho. A base inclui `npm run typecheck`, `npm run lint`, `npm test`, `npm run check:layers`, `npm run check:design-system`, `npm run test:scripts`, `npm run test:local-sql`, `npm run check:secrets`, `npm run build` e `npm run check:client-auth`. Para E2E usar os projetos/fixtures próprios e configuração de ambiente correta; não executar suíte conectada contra produção por padrão.

Testes existentes a preservar: `tests/adapters/admin-route.test.ts`, `admin-runtime.test.ts`, `calendar-route.test.ts`, `calendar-security-provider.test.ts`, `capture-task-commands.test.ts`, `knowledge-route.test.ts`, `onboarding-route.test.ts`; `supabase/tests/admin-behavior.sql`, `calendar-behavior.sql`, `capture-task-behavior.sql`, `knowledge-behavior.sql` e catálogos correspondentes. Acrescentar casos significativos ao domínio apropriado, sem copiar snapshots frágeis.

Na máquina com recursos limitados, medir RAM antes de build/browser/banco, usar serialização e workers compatíveis, e transferir validação pesada para CI autorizado. Não atribuir aprovação a testes que não rodaram. Não manter servidores/browser extras apenas para documentação.

## Registro de evidência e liberação

Para cada frente, registrar: ID do caso, commit, ambiente/projeto, comando ou percurso, entrada sintética, oráculo esperado/observado, resultado, limpeza e limitação. Valores secretos e conteúdo real não entram no recibo. Salvar capturas com versão e descrição de tema/largura.

Critérios de liberação: nenhum desvio crítico de autorização/integridade; checks próprios do candidato; efeito remoto comprovado nas integrações; job executado de forma autônoma e monitorável; operações administrativas antigas cortadas após contingência; documentação comercial/privacidade coerente. Resultado de preview não aprova produção automaticamente. Plano de rollback do doc 12 acompanha cada liberação.

## Evidência estrutural executada e novos aceites

O [doc 16](16-auditoria-supabase.md) registra a auditoria MCP READ ONLY: catálogo versionado com 2.512 verificações e uma divergência do wrapper onboarding_call; comparação com o patch PT409 confirma corpo CRLF e fronteira de privilégios. O resultado bruto é ok=false, não aprovação integral de release. As demais suítes e fluxos de produto deste documento não foram executados por essa auditoria.

Acrescentar à execução: DB-REC-01 (reconciliação das 27 migrations versus cinco registros), DB-REC-02 (expectativa PT409 e HTTP 409), DB-SEC-01 (fechamentos intencionais e isolamento), DB-AUTH-01 (configuração Auth), DB-CAL-01 (quatro policies otimizadas), DB-RET-01 (purga própria preservando onboarding) e DB-NEW-01 (novos domínios). Os resultados esperados completos estão no doc 16. Não executar suites com fixtures ou DDL em produção para completar essa evidência; usar homologação isolada.

