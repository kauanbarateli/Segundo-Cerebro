# T026/T027 — Busca e Configurações

## Comportamento entregue

A paleta Ctrl/Cmd+K e o botão do celular pesquisam tarefas, capturas, páginas, lançamentos, arquivos, projetos e hábitos. Os resultados têm ranking estável, grupos, contagem anunciada, sugestões para vazio e atalhos para criar captura/tarefa. Setas, Enter e Escape preservam a navegação e o retorno de foco. Os deep links são reconstruídos por tipo/ID permitido; respostas com formato, URL ou campo inesperado são recusadas. Títulos financeiros ficam ocultos em texto, options e aria-label quando a privacidade está ativa. Cofre não é fonte da Busca.

O canal conectado valida sessão, troca obrigatória, origem, dono esperado e o termo antes de construir o port privilegiado. SQL confere os gates atuais de cada fonte, exclui lixo/arquivo e usa FTS/substring normalizada; `%` e `_` são literais. Preferência oculta um atalho, mas não concede nem revoga Entitlement. Nenhuma consulta retorna corpo de nota, valor financeiro ou URL assinada. Cada grupo é limitado; busca não carrega snapshots completos dos módulos.

Configurações salva perfil, tema, preferência de privacidade, vista inicial da agenda, lembrete e ordem/visibilidade de módulos por canais fechados. Os módulos essenciais são protegidos no Núcleo e banco. Escrita, Evento, recibo e consumo do limite são atômicos; replay exato precede a cobrança. Avatar usa o pipeline de bytes reais do Drive, com re-encode e leitura privada; remoção é explícita. Troca de senha usa o fluxo existente que exige a atual e revoga outras sessões. A área Meus dados identifica exportação como Fase 2.

O tema da conta participa do HTML inicial do servidor; fallback local serve ao modo demo/offline. Salvar preferências invalida Configurações e Agenda, de modo que um lembrete desligado deixa de usar o snapshot anterior. Relacionados recebe um aviso estreito de invalidação e relê somente seus metadados, inclusive após renomear/apagar uma origem. Respostas antigas não sobrescrevem leituras posteriores.

Logout conectado mantém a máscara, desmonta conteúdo, limpa o estado local de Busca/Relacionados, aborta transports e ignora JSONs tardios. O formulário cookie-only é conectado ao DOM depois da limpeza. Os comandos duráveis passam pelo journal com o JSON original e client_id; OAuth, senhas, kit, tokens e URLs temporárias não entram nele.

## Provas e limites

Asserções de Settings, Busca e Atividade ampliada passaram na cadeia PostgreSQL local completa, com rollback. O ensaio com 50 mil metadados Drive ficou em até 29 ms nos seis termos desta máquina; 500 ms é orçamento recomendado, não SLA hospedado. O método e os limites estão na [validação SQL](validacao-sql-finalizacao.md).

Os testes HTTP verificam guards, origem, DTO fechado, limite/Retry-After, erro privado e consulta vazia sem RPC. Contratos de paleta, deep link, máscara, descarte no logout e atualização Agenda/Configurações passaram. A rodada integrada Chromium aprovou busca → abrir Capturas/Tarefas/Projetos, repetição da ação Nova tarefa, teclado/foco e preferências demo; os sete tipos também têm testes de Núcleo e SQL.

Não houve Supabase remoto nesta finalização. Tema entre aparelhos, avatar real, sessão antiga revogada, leitor de tela real, orçamento hospedado e os sete tipos pelo navegador conectado continuam em [entrega e pendências](entrega-mvp-pendencias.md). Doubles não encerram esses aceites.

## Arquivos principais

- `src/core/busca`, `src/core/configuracoes`: contratos e validação independentes do SDK.
- `src/adapters/db/search-runtime.ts`, `settings-runtime.ts`: composição dos canais conectados.
- `src/components/layout/command-palette.tsx`, `related-panel.tsx`: interfaces transversais.
- `src/components/features/configuracoes/settings-connected-workspace.tsx`: central da conta.
- Migrations `20261009151557_account_preferences.sql` e `20261009154609_global_search_activity.sql`, mais dependências anteriores na ordem do manifest.
