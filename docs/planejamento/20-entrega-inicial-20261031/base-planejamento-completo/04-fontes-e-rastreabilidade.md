# Fontes e rastreabilidade

Consulta: 31/10/2026, horário de Fortaleza. A revisão 1.2 comprova a inspeção estrutural de leitura no Supabase pessoal, dentro dos limites do doc 16. Configurações externas e fluxos funcionais continuam exigindo evidência própria.

## Base de código

- Repositório: [kauanbarateli/Segundo-Cerebro](https://github.com/kauanbarateli/Segundo-Cerebro).
- Commit observado da branch real `main`: [`bd35288404c493d1b03f7a1a0208f808cc2079a2`](https://github.com/kauanbarateli/Segundo-Cerebro/commit/bd35288404c493d1b03f7a1a0208f808cc2079a2).
- Mensagem do commit: `MVP: convergência ao protótipo, onboarding e validação integrada (#120)`.
- [PR #120](https://github.com/kauanbarateli/Segundo-Cerebro/pull/120) incorporado na base acima. A descrição do PR contém estados históricos anteriores ao merge; não substituir o estado Git observado pelo texto antigo de rascunho.
- [PR #127 — planejamento de aplicativo](https://github.com/kauanbarateli/Segundo-Cerebro/pull/127) é referência de coordenação: retirar o card de instalação de Configurações não autoriza cancelar a frente de PWA/offline. Não foi incorporado ao diagnóstico como código implementado.

Leitura realizada em snapshot exportado por `git archive` desse commit, sem checkout sobre trabalho de outra frente e sem mudar código do produto. O snapshot local contém apenas arquivos versionados; não foram lidos arquivos de segredos de produção.

## Documentação de produto e visual

- [AGENTS.md](https://github.com/kauanbarateli/Segundo-Cerebro/blob/bd35288404c493d1b03f7a1a0208f808cc2079a2/AGENTS.md): camadas, isolamento, eventos, padrões visuais, limites operacionais.
- [CONTEXT.md](https://github.com/kauanbarateli/Segundo-Cerebro/blob/bd35288404c493d1b03f7a1a0208f808cc2079a2/CONTEXT.md): vocabulário canônico.
- [PRODUCT.md](https://github.com/kauanbarateli/Segundo-Cerebro/blob/bd35288404c493d1b03f7a1a0208f808cc2079a2/PRODUCT.md) e [DESIGN.md](https://github.com/kauanbarateli/Segundo-Cerebro/blob/bd35288404c493d1b03f7a1a0208f808cc2079a2/DESIGN.md): contexto e DS 2.1. Estados comerciais/operacionais históricos devem ser reconciliados com o novo escopo.
- [Protótipo aprovado do doc 17](https://github.com/kauanbarateli/Segundo-Cerebro/tree/bd35288404c493d1b03f7a1a0208f808cc2079a2/docs/planejamento/17-evolucao-prototipo): referência visual e funcional demonstrativa.
- [Plano e comparação doc 18](https://github.com/kauanbarateli/Segundo-Cerebro/tree/bd35288404c493d1b03f7a1a0208f808cc2079a2/docs/planejamento/18-convergencia-prototipo-20261025): convergência do MVP e evidências datadas.
- [ADRs do projeto](https://github.com/kauanbarateli/Segundo-Cerebro/tree/bd35288404c493d1b03f7a1a0208f808cc2079a2/docs/adr): principalmente 0003 acesso, 0004 eventos, 0007 Admin, 0008 Calendar somente leitura, 0009/0010 cobrança e provisionamento.
- Origem do novo pedido: cópia preservada em [00-escopo-original.md](00-escopo-original.md), fornecida em `C:/Users/Kauan Sousa Barateli/Downloads/planejamento-segundo-cerebro.md`.
- Pasta local consultada: `D:/USUÁRIOS/Kauan/TRABALHO/CÉREBRO - STARTUP (SEGUNDO CÉREBRO)`. Seu `Comece aqui.md` registra consolidação em 16/10/2026; é referência de contexto, não retrato atualizado após o PR #120.
- O protótipo local foi localizado em **Prótotipos/Protótipo - Codex/** (grafia real do diretório). O endereço do briefing usa outra posição do acento em Protótipos; não é ausência do material.

## Skills aplicadas

- [grill-me](https://github.com/kauanbarateli/Segundo-Cerebro/blob/bd35288404c493d1b03f7a1a0208f808cc2079a2/.agents/skills/grill-me/SKILL.md) → [grilling](https://github.com/kauanbarateli/Segundo-Cerebro/blob/bd35288404c493d1b03f7a1a0208f808cc2079a2/.agents/skills/grilling/SKILL.md).
- [grill-with-docs](https://github.com/kauanbarateli/Segundo-Cerebro/blob/bd35288404c493d1b03f7a1a0208f808cc2079a2/.agents/skills/grill-with-docs/SKILL.md) → grilling + [domain-modeling](https://github.com/kauanbarateli/Segundo-Cerebro/blob/bd35288404c493d1b03f7a1a0208f808cc2079a2/.agents/skills/domain-modeling/SKILL.md). Decisões registradas imediatamente; glossário separado da especificação. A instrução posterior do mantenedor substitui a cadência em várias rodadas por uma rodada consolidada.
- [Impeccable local 4.4.0](https://github.com/kauanbarateli/Segundo-Cerebro/blob/bd35288404c493d1b03f7a1a0208f808cc2079a2/.agents/skills/impeccable/SKILL.md): planejamento `shape`, `operate`, `distill`. Também consultada a versão4.7.0 disponível no host. Sem edição de UI, criação de paleta ou afirmação de auditoria visual da produção.
- Skill Supabase do host: leitura das diretrizes de Auth/RLS/credenciais, para recomendações de planejamento. Sem uso do serviço conectado ou mudanças de schema.

## Documentação oficial de serviços

Os links específicos de Calendar/ClickUp/Apple estão associados às afirmações em [insumos-integracoes.md](insumos-integracoes.md). Fontes centrais:

| Assunto | Referência oficial |
| --- | --- |
| Escopos Calendar | [Authorization](https://developers.google.com/workspace/calendar/api/auth) |
| Eventos, convidados e conferenceData | [Events](https://developers.google.com/workspace/calendar/api/v3/reference/events) e [Insert](https://developers.google.com/workspace/calendar/api/v3/reference/events/insert) |
| Recorrência e concorrência | [Recurring events](https://developers.google.com/workspace/calendar/api/guides/recurringevents) e [Versioned resources](https://developers.google.com/workspace/calendar/api/guides/version-resources) |
| Publicação e marca Google | [Brand verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification) e [Sensitive scopes](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification) |
| Revogação Google | [OAuth web server](https://developers.google.com/identity/protocols/oauth2/web-server#tokenrevoke) |
| ClickUp OAuth | [Authentication](https://developer.clickup.com/docs/authentication) |
| ClickUp tarefas filtradas | [Get filtered team tasks](https://developer.clickup.com/reference/getfilteredteamtasks) |
| ClickUp escrita | [Update task](https://developer.clickup.com/reference/updatetask) e [Create task comment](https://developer.clickup.com/reference/createtaskcomment) |
| ClickUp sincronização | [Rate limits](https://developer.clickup.com/docs/rate-limits), [Webhooks](https://developer.clickup.com/docs/webhooks) e [Signature](https://developer.clickup.com/docs/webhooksignature) |
| Google no Supabase | [Google Auth](https://supabase.com/docs/guides/auth/social-sign-in/auth-google) |
| União de identidades | [Identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking) |
| E-mail de autenticação | [SMTP](https://supabase.com/docs/guides/auth/auth-smtp) |
| Proteção do cadastro | [CAPTCHA](https://supabase.com/docs/guides/auth/auth-captcha) |
| Apple posterior | [Configuração web](https://developer.apple.com/help/account/capabilities/configure-sign-in-with-apple-for-the-web/) e [provider Supabase](https://supabase.com/docs/guides/auth/social-sign-in/auth-apple) |

## Limites da evidência

- Na revisão 1.2 houve autenticação OAuth do MCP e consultas SQL estruturais READ ONLY. Não houve novo build, login no produto, OAuth de Calendar/ClickUp, upload, purga, sincronização de usuários, envio de comentários, alteração de tarefa ou deploy.
- A disponibilidade pública do domínio não pôde ser confirmada pelo leitor web. Isso não comprova indisponibilidade do site.
- O índice `https://supabase.com/changelog.md` foi rejeitado pelo leitor por tipo de conteúdo. A implementação deverá reconferi-lo por ferramenta compatível; as páginas oficiais dos recursos foram consultadas.
- Fotos/cores/estado das capturas demonstrativas não são evidência do estado real de uma conta.
- Alterações futuras da `main` exigem reconciliação do diff antes de executar o plano; esta análise está vinculada ao SHA informado.


## Complemento após as respostas finais

As 17 respostas de produto estão registradas no doc 02. A main foi reconferida e permanece no mesmo SHA. O planejamento inclui agora ADM separado e leitura individual restrita da jornada, por ampliação explícita Q15.

A recusa inicial do conector foi superada após configurar e autenticar o MCP local solicitado. A auditoria de produção inspecionou metadados em transações READ ONLY; homologação e bancos de terceiros não foram consultados. O [doc 16](16-auditoria-supabase.md) e o [resumo da auditoria](evidencias/supabase/audit-summary.json) registram escopo, SHA, contagens, desvios e limites. A [verificação UTM](evidencias/verificacao-utm.json) preserva o histórico e acrescenta a busca de catálogo sem estruturas dedicadas encontradas.

Fontes adicionais para o novo ADM: [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [MFA TOTP](https://supabase.com/docs/guides/auth/auth-mfa/totp), [SSR](https://supabase.com/docs/guides/auth/server-side/advanced-guide), [cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie) e [CSRF](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html). São fundamentos técnicos; não comprovam configuração ativa.

Uma revisão cruzada dos documentos verificou decisões, prioridades, fronteiras e cenários de teste. Foram esclarecidos: sessão administrativa vinculada ao canal, FK/trigger de captura promovida, grants Google de leitura/escrita, requestId do Meet por tentativa, credencial nativa do cron e geração da conexão ClickUp contra jobs antigos. Isso é revisão do planejamento, não teste de implementação.

## Revisão 1.2 — fonte remota autenticada

A origin/main foi reconferida, permanecendo em bd35288404c493d1b03f7a1a0208f808cc2079a2. O projeto foi confirmado pela URL retornada pelo MCP. As consultas e resultados estão em anexos/auditoria-supabase e evidencias/supabase. A consulta versionada de release retornou ok=false: 2.512 verificações, uma divergência do wrapper PT409. A comparação do corpo com CRLF identifica o script operacional correspondente; o resultado original permanece preservado. Nenhum teste de negócio, mutation ou aplicação de migration foi executado.

