# Providências do mantenedor por etapa

Este checklist substitui a ordem do doc15 da base; não exige Google Cloud, ClickUp ou DNS do ADM para começar a primeira entrega. Não compartilhar credenciais em issues, prompts, repositório ou chat.

## Agora, enquanto a Frente A avança

- Confirmar acesso ao projeto/equipe Vercel correto e ao ambiente QA já documentado (`twrydxsdemaykgvdlpyd`); a frente verifica o estado real antes de usar. Produção é somente o projeto pessoal `rishenjoikgmfubmnfiu`.
- Identificar SMTP transacional, remetente e responsável pelo DNS; disponibilizar acesso por canal protegido. A equipe precisa comprovar confirmação, reenvio e recuperação em caixa de teste antes de abrir cadastro.
- Confirmar a conta Master existente, por canal privado, para validar a tela de métricas. Não criar papel administrativo a partir do e-mail informado em formulário.
- Disponibilizar duas contas QA autorizadas e dados fictícios para isolamento. Reaproveitar os acessos existentes; não criar infraestrutura paga por presunção.
- Opcionalmente fornecer links de campanha com as cinco UTM e primeiros cards editoriais de Atualizações. Ausência de campanha não bloqueia cadastro; quadro vazio é aceitável.
- Conferir os textos de acesso gratuito e os ajustes de Termos/Privacidade correspondentes à coleta mínima, sem reabrir decisões já respondidas.

Supabase MCP já foi autorizado e o catálogo auditado. Não repetir autenticação por rotina. A reconciliação de migrations, teste de isolamento, configuração segura de Auth e revisão do patch PT409 são trabalho técnico da Frente B.

## Depois, para as integrações e o ADM

Google Cloud/verificação OAuth, contas Calendar fictícias; Workspace ClickUp e responsável OAuth; DNS para `adm.segundocerebroapp.com.br`; MFA e contingência de acesso administrativo; configuração e operação de jobs de sincronização/purga. Consultar o [checklist completo histórico](base-planejamento-completo/15-providencias-do-mantenedor.md) e os tickets posteriores antes de cada ativação.

O Pro da Vercel não comprova o plano do Supabase, SMTP, quotas OAuth nem capacidade de memória local. Não contratar planos ou avançar deploy com essa inferência. Nenhum gasto, migração ou publicação do aplicativo é executado por este planejamento.
