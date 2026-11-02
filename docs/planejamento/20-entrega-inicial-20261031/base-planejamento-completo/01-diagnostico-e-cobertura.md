# Diagnóstico técnico e cobertura do escopo

Base reconferida em **31/10/2026**: `main`, commit `bd35288404c493d1b03f7a1a0208f808cc2079a2`, merge do PR #120. Análise do código, referências e catálogo hospedado por MCP autenticado. A auditoria estrutural de leitura está no [doc 16](16-auditoria-supabase.md); não houve execução de fluxos do app ou testes com dados de usuários.

## Arquitetura observada

Next.js 15.5.28, React 19.2.8 e TypeScript, com Core independente de framework, adapters de banco/serviços, canais finos, Supabase Auth/Postgres/Storage e DS 2.1. As versões vêm do package.json observado; reconferir lockfile e changelog antes da execução. Os módulos possuem persistência real: nomes históricos “demo” não provam que o aplicativo seja apenas um protótipo.

Auth implementa senha, recuperação e sessões. O onboarding tem nove telas, retomada e conclusão idempotente. Google Calendar possui OAuth, cache e sincronização de leitura, até duas contas, com participantes. Captura e Conhecimento têm documentos, vínculos, rascunhos e conflitos. Admin tem operações reais e proteção do último Master. A evolução deve aproveitar essas fronteiras, sem substituir contratos por estado local de interface.

## Matriz requisito → diagnóstico → entrega

| Escopo | Estado observado e lacuna | Frente / documento |
| --- | --- | --- |
| 3.1 Favicon e identidade | Ícone e marca existem; conferir entrega/cache e harmonizar composição | F03; doc 08 |
| 3.2 Google Cloud | OAuth Calendar existe; console e verificação não auditados | F02/F06; doc 06 |
| 3.3.1 Princípios | Seção e âncora ainda presentes | F03; doc 08 |
| 3.3.2 Tema e rodapé | Tema e Configurações no rodapé; header fixo existente | F03; doc 08 |
| 3.3.3 Acesso e cadastro | Login fechado; sem cadastro público/social implementado | F02; docs05/06/07 |
| 3.3.4 Comunicação e teste | Cobrança apenas planejada; teste gratuito não implementado | F02; DEC01–04 |
| 3.3.5 Logo | Marca empilhada já disponível no login | F03; reutilizar Brand |
| 3.4 Login e políticas | Checkbox com links separados e aviso de cadastro fechado | F02/F03; links no texto e fluxo real |
| 3.5.1 Captura rápida | Ação atual navega; pipeline aceita imagens | F04; DEC06 |
| 3.5.2 Tema imediato | Header abre seletor | F03; preservar persistência e opção Sistema |
| 3.5.3 Painéis | Drawer comum abre à direita e fica colado às bordas | F03; revisar primitiva e consumidores |
| 3.5.4 Texto da imagem | Explicação técnica compartilhada extensa | F03; mensagem curta, validações preservadas |
| 3.5.5 Lixeira | Exclusão lógica e restauração existem; purga de 7 dias não | F08; DEC08/09 e doc 07 |
| 3.5.6 Ruído visual | Mensagens repetidas; erros e conflitos têm função | F03/F04/F09; simplificar sem perder trabalho |
| 3.6 ClickUp | Nenhuma implementação encontrada | F07; doc 06 e DEC11–13 |
| 3.7.1 Admin | Aba, página e APIs com poderes reais | F11; DEC05/15 e doc 09 |
| 3.7.2 Calendário em lista | Lista existe junto a outras vistas e preferência inicial | F05; layout, URL e preferência |
| 3.7.3 Permissões e escrita | Somente leitura; ACL não conservada no DTO | F06; avulsos completos, recorrências em leitura |
| 3.7.4 Detalhes de eventos | Participantes reais sem fotos; descrição e Meet ausentes | F05/F06; DTO, cache e iniciais como alternativa |
| 3.8 Notas e editor | Editor compartilhado; modelos Captura/Página distintos | F04; reorganizar controles existentes |
| 3.9 Configurações | Uma coluna; Meus dados contém texto, sem exportador | F09; retirar cards preservando sessões, políticas e PWA |
| 3.10.1 Feedback | Ajuda estática; domínio de solicitações ausente | F10; texto/categoria, privado, 12 meses após encerramento |
| 3.10.2 Atualizações | Quadro persistente inexistente | F10/F11; cinco colunas, publicação editorial e gestão |
| 3.11 Projetos | Capas e progresso existem; mock inclui dados fictícios | F09; polimento sem adicionar status ou prazo |
| Ampliação Q15 — ADM | Canal atual embutido no app | F11; subdomínio separado e gestão completa prevista |
| Ampliação Q15 — UTM | Sem coletor no código ou estruturas dedicadas localizadas no catálogo inspecionado | F12; docs 10/16 e evidências de catálogo |
| Ampliação Q15 — métricas | Criação, último login e sessões não formam DAU/WAU/MAU | F12; definições, cobertura e atividade mínima |

## Implicações para a execução

1. **Cadastro aberto exige backend:** criar provisionamento, confirmação, callbacks e condição de beta, preservando recuperação e identidades existentes.
2. **Integrações exigem efeitos reais:** Google e ClickUp precisam refletir permissões e resultados externos, inclusive respostas incertas e conflitos.
3. **Retirar Admin exige corte operacional:** validar substituto e contingência antes de negar os endpoints antigos; não apagar saga, dados ou proteção do último Master.
4. **Lixeira exige integridade e manutenção:** referências, cópias, anexos e concorrência tornam insuficiente apagar uma linha ou exibir um aviso.
5. **UTM continua sendo implementação nova:** nenhuma estrutura dedicada foi localizada no catálogo pesquisado; não reconstruir história anterior ao consentimento. Reconciliar o histórico 5/27 antes de novas migrations.
6. **Liberar abas é autorização:** capacidades novas fechadas exigem catálogo e controle no servidor; ocultar a navegação não impede execução direta.

## Documentação a reconciliar

CONTEXT.md, PRODUCT.md, DESIGN.md, briefs Impeccable, ADRs 0003/0007/0008/0009/0010, doc 16 de atribuição/comercial, doc 18 e políticas em `src/lib/legal/documents.ts`. Usar registros datados e relações de substituição; não apagar evidências históricas nem declarar implementação por publicar um plano.

O índice local de 16/10/2026 precede o PR #120. O protótipo conserva autoridade visual, mas dados fictícios, vistas retiradas e checkout demonstrativo não prevalecem sobre as decisões atuais. O README organiza os documentos completos e a matriz de execução.

## Achados da auditoria remota

67 tabelas previstas encontradas, todas com RLS; 27 migrations no Git e cinco registradas no banco. O catálogo verificou 2.512 condições, com uma divergência: wrapper do onboarding compatível com o patch operacional PT409 versionado. Os dois buckets são privados e o cron de onboarding teve 96/96 sucessos na janela de 24 horas. A F01 deve reconciliar proveniência e expectativas sem reaplicar as 22 migrations sem registro. Auth completo, SMTP, backups, QA e testes funcionais continuam pendentes. Consulte o [doc 16](16-auditoria-supabase.md).

