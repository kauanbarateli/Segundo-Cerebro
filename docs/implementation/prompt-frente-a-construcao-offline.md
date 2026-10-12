# Prompt para iniciar a Frente A

Copie o texto abaixo para o outro agente. O handoff completo está em `docs/implementation/handoff-duas-frentes-mvp-20261012.md` no repositório.

```text
Assuma a Frente A de construção offline do MVP de Segundo Cérebro, no repositório git@github.com:kauanbarateli/Segundo-Cerebro.git.

Leia AGENTS.md, CONTEXT.md, docs/implementation/handoff-duas-frentes-mvp-20261012.md, o planejamento/ADRs pertinentes e as issues relacionadas. Esse handoff define seu escopo e prevalece sobre a antiga organização em quatro frentes.

Trabalhe em checkout/worktree isolado e branch própria a partir da origin/main atualizada, registrando o SHA de base. Preserve o checkout e arquivos locais da raiz. Não copie .env.local, work/, perfis, dados ou chaves pessoais.

Priorize: (1) cobertura interativa do CalendarWorkspace original com portas sintéticas, Dia/Semana/Mês, evento de três dias, expansão da janela e refresh sem reload; (2) matriz visual de Configurações/sessões com fixtures existentes; (3) auditoria Impeccable local das seis jornadas/PWA. Corrija defeitos de lógica local/apresentação demonstrados e conclua os recortes offline aprovados, sem reconstruir módulos já implementados ou inventar funcionalidades. Se um item já estiver completo, registre a prova e continue.

Use obrigatoriamente a Impeccable local para UI, conforme DS 2.1/D-030. Execute verificações adequadas ao diff: tipos, lint, camadas, DS, scanner, testes herméticos e browser local/demo com dados sintéticos. PGlite em memória é permitido; não certifica Supabase real.

Não acesse Supabase, Vercel, Google, SMTP/Sentry ou Auth/GoTrue real, mesmo local. Não rode runners nativos/conectados, aplique migrations, altere segurança/segredos/pipeline, faça deploy ou use contas reais. A raiz é responsável pela criação que exige essas conexões, pelos testes integrados e pela revisão da sua PR. Para backend, transportes, SQL e harness nativo, entregue diagnóstico à raiz; não implemente outra solução paralela. Drive foi retirado do MVP e não será entregue.

Ao concluir, faça commits claros sem coautoria e abra uma PR Draft para main com sua parte pronta. Use Refs #12/#32/#34/#35/#37 conforme o diff; não use Closes/Fixes/Resolves, não feche issues e não faça merge. Inclua docs/implementation/frente-a-entrega.md com implementado, validado localmente, pendente da raiz, comandos/resultados reais e limites. Entregue URL da PR, branch/SHA e checklist da validação conectada que restou.

Persista até entregar os recortes offline em PR revisável. Se só houver gaps de cobertura/documentação, entregue essa prova sem fabricar alterações de produto. GitHub é permitido para ler o planejamento e entregar a PR; nenhuma credencial do produto deve ser necessária.
```
