# Entrega do MVP e pendências — 12/10/2026

**São 12 issues abertas: oito de execução e quatro épicos**, conferidas em 12/10 às 04:51:16 UTC (01:51:16 em Fortaleza). A entrega Drive foi retirada por pedido do mantenedor. A [#29](https://github.com/kauanbarateli/Segundo-Cerebro/issues/29) está encerrada como `not_planned`, sem alegar implementação ou aceite; seus quatro vínculos foram removidos. A nova lógica será descrita posteriormente, sem fase ou solução presumida. Referências: [D-032](../planejamento/registro-de-decisoes.md#retirada-da-entrega-drive--12102026), [OP-018](decisoes-operacionais.md#op-018--retirada-da-entrega-drive-do-planejamento) e [conferência GitHub](evidence/drive-retirada-mvp-20261012.json) e [ajustes complementares](evidence/drive-retirada-mvp-issues-complementares-20261012.json).

O corte reduz desenvolvimento e validação de upload, pastas, lixeira, restauração, cota e download. Capturar, Avatar, Storage privado compartilhado, backup e as seis jornadas de release continuam. Código, dados, migrations e provas históricas foram preservados.

## Banco: nenhuma migration pendente

**001–019 estão aplicadas no projeto pessoal `rishenjoikgmfubmnfiu`. Não reaplicar migrations, bootstrap, seeds ou reset.** O catálogo hospedado pós-019 confirmou 1.269 verificações e zero desvios. CI, build e deploy não aplicam schema remoto; BlackSheep e VOE permanecem fora do escopo.

Os tipos oficiais locais pós-019 incluem 55 RPCs; Foundation de `aa1b526` passou sem diferenças, com cinco divergências recusadas e concorrência de seis conexões — cinco permitidas e uma negada — com limpeza exata. Falta comparar um export oficial hospedado atualizado; pertence ao release e não acrescenta gate à #37. Referências: [tipos pós-019](t013-local-types-019-20261011.md), [guia de tipos](../operations/database-types.md) e [catálogo hospedado](evidence/hosted-catalogue-post019-20261011.json).

## Pendências por issue

| Issue | Trabalho restante | Dependência externa |
| --- | --- | --- |
| [#12 — PWA](https://github.com/kauanbarateli/Segundo-Cerebro/issues/12) | Quatro dos cinco aceites cumpridos; falta registrar instalação em Android/iOS reais. | Aparelhos e revisão humana de produção adiada. |
| [#21 — Auth](https://github.com/kauanbarateli/Segundo-Cerebro/issues/21) | Senha normal, isolamento e limpeza aprovados em Auth813. Recovery confirmou novas credenciais em 7d; falta concluir encerramento e limpeza. | SMTP pessoal não configurado; Mailpit não certifica e-mail de produção. |
| [#24 — Administração](https://github.com/kauanbarateli/Segundo-Cerebro/issues/24) | Concluir os dois casos de navegador: bloqueio de sessão viva e primeira entrada forçada, APIs, salvaguardas master e limpeza. Backend aprovado não substitui GUI. | CI local disponível; nenhum serviço externo novo exigido. |
| [#32 — Google](https://github.com/kauanbarateli/Segundo-Cerebro/issues/32) | Cinco canais implementados localmente; validar OAuth, duas contas, revogação, eventos e scheduler com o provedor real. | Cliente OAuth pessoal e scheduler não configurados. |
| [#34 — Configurações](https://github.com/kauanbarateli/Segundo-Cerebro/issues/34) | Senha normal passou nos 15 estágios/19 checks de Auth813; Avatar tem prova nativa própria. Quatro jornadas UI/SDK/SQL usam seams de Auth/HTTP. Falta tema entre desktop/celular e revisão humana. | Aparelhos e revisão humana de produção adiada. |
| [#35 — Release](https://github.com/kauanbarateli/Segundo-Cerebro/issues/35) | Allowlist com seis testes e catálogo hospedado comprovados. Falta backup cifrado/agendado, restore descartável, export hospedado dos tipos, seis jornadas desktop/iPhone real e audit Impeccable final. | Destino fora do OneDrive e guarda separada das chaves não definidos; aparelhos e revisão humana adiados. |
| [#36 — Dependências](https://github.com/kauanbarateli/Segundo-Cerebro/issues/36) | Aguardar patch upstream compatível e validar instalação/audit/lint/tipos/contratos/build/smoke após mudança real. | Audit de 11/10: zero alertas de produção, cinco high de desenvolvimento; advisory reconferido às 19:11 UTC sem versão corrigida. |
| [#37 — Sessões próprias](https://github.com/kauanbarateli/Segundo-Cerebro/issues/37) | Concluir os dois casos Admin, incluindo master, recarga, isolamento e limpeza; preservar os cinco aceites originais. | Sem gate adicional de SMTP/OAuth/backup/export hospedado. |

Épicos [#2](https://github.com/kauanbarateli/Segundo-Cerebro/issues/2), [#4](https://github.com/kauanbarateli/Segundo-Cerebro/issues/4), [#6](https://github.com/kauanbarateli/Segundo-Cerebro/issues/6) e [#7](https://github.com/kauanbarateli/Segundo-Cerebro/issues/7) dependem dos filhos e dos próprios aceites. #22, #28, #20 e #5 conservam seus fechamentos anteriores. IA, billing, compartilhamento e grafo persistente de fase 2 permanecem fora desta entrega.

## Última execução publicada: 7d04a02

A fonte [7d04a02](https://github.com/kauanbarateli/Segundo-Cerebro/commit/7d04a026451148bb3d12bbd7aa547d566699921f), publicada em 11/10 às 22:28:17 UTC, concluiu seis dos nove workflows com sucesso. O CI geral completou 27 etapas; o status [Vercel](https://vercel.com/kauanbarateli-projects/segundo-cerebro-of/E28TzD883kw79bh3AMHti1488PPN) confirmou deploy às 22:29:10 UTC. Resultados e hashes próprios: [evidência fechada](evidence/native-ci-7d04a02-20261012.json).

- **Admin — [38180549310/1](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/38180549310/attempts/1):** BLOCK confirmou oito estágios até `actor-intact`, duas RPCs e duas visões próprias. Falha `QUIESCENCE_HTTP_AUTH_NO_RESPONSE_PENDING`: uma request de login/fetch/frame main ficou pendente em `after-blank`, depois de StopACK próprio. Limpeza zero, FIRST `NOT_RUN`, escrita incerta preservada; manifesto declarado 348/50 conferido.
- **Recovery — [38180549305/1](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/38180549305/attempts/1):** sete estágios até `credentials-changed`, 195 requisições de navegador/seis SDK/cinco SQL/três Mailpit. Falha `QUIESCENCE_HTTP_ASSET_NO_RESPONSE_PENDING`, fase `full`, cinco requisições e zero inspeções pendentes. Caso sem escrita incerta; runner com incerteza e descarte incompleto. Limpeza zero; manifesto declarado 192/50 conferido.
- **Auth, Foundation, Captura Storage, Avatar Storage e Admin backend:** success por metadados nesta fonte. Seus relatórios integrais não foram capturados nesta rodada; a prova completa de Auth continua em [8134463](evidence/native-ci-8134463-20261011.json).
- **Produção:** status de deploy não comprova novo login autenticado, configuração global Auth ou persistência pessoal.

Os diagnósticos aceitos são `OFFLINE_UNKNOWN_STEP_DIAGNOSTIC`; não aprovam jornadas nem identificam causa física. A terceira captura histórica recusou o enquadramento (`FRAME_BOUNDARY_AMBIGUOUS`), conservando relatório e incerteza null. Não converter recusa de parser em prova funcional. As capturas são únicas e fechadas; não reabrir logs, reports ou status privados.

## Orientações de continuidade

1. Conferir HEAD, branch e instruções. Preservar projeto pessoal e SSH exclusivo; não usar a conta master pessoal como fixture.
2. Concluir o encerramento Admin e Recovery: depois das barreiras de escrita/efeito, colocar contextos offline com guard presente, confirmar StopACK e páginas blank, retirar interceptadores com espera e exigir eventos terminais reais antes do descarte. Preservar prazo absoluto de 15 segundos, primeira falha, incerteza e veto de limpeza; ACK ou cabeçalhos não provam conclusão de request.
3. Aguardar prova nativa da fonte com esse ajuste. Admin e Recovery mantêm dois segundos entre relatório fechado e fim do step para reduzir ambiguidade do intervalo oficial; parser e PASS permanecem intactos. O workflow legado retirado fica somente manual e fora do gate automático do MVP.
4. Revisar entregas, testes focados, tipos, lint, links e whitespace. Publicar sem coautoria e conferir resultados próprios e critérios literais antes de fechar issues.
5. Após definir serviços pessoais, usar os runbooks de SMTP, OAuth e backup/restore. Serviço não definido e revisão humana adiada continuam pendentes.

Guias: [Auth](t014-auth-backend.md), [PWA](t005-pwa.md), [Configurações](t026-t027-busca-configuracoes.md), [Google](../operations/google-calendar-release-verification.md), [backup/restore](../operations/backup-restore-release.md). Ferramentas: `npm run database:types:help`, `npm run google:cron:help`, `npm run backup:help`, `npm run release:help`.

Histórico: [0b37329](evidence/native-ci-0b37329-20261011.json), [b608f19](evidence/native-ci-b608f19-20261011.json), [8134463](evidence/native-ci-8134463-20261011.json) e [checkpoints anteriores](pendencias-mvp-20261011.md). O [advisory oficial](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) registra a pendência upstream; dependências não foram alteradas nesta conferência.
