# Restore — consolidação pública das regras e próximos bindings

Consolidação de25/10/2026, com contexto de código f91ae89fde384d798f933e5be84b9e54ab1152b7. **Este documento registra regras vigentes. Não altera contrato ou código, não qualifica baseline e não autoriza acesso privado, preparo de alvo ou restore.** O [registro estruturado](evidence/restore-baseline-public-decision-v1.json) é documental; nenhum reader ou issuer recebe autoridade dele.

## Quatro direções mantidas

- **Ordem estrita A2v1:** preservar ordem e multiplicidade das dependências, distinguindo os contextos managed e união. Não normalizar, ordenar, deduplicar ou introduzir exceção multiset nesta entrega. Os quinze motivos de recusa permanecem.
- **Privilégios restritivos:** manter a política pública001/003/016. Origem oficial de um grant não o torna aceitável. Owner, grantee/grantor, grant option e defaults globais/schema são verificados separadamente. Nenhuma migration será reaplicada como atalho.
- **Preservação do helper:** uma futura proposta limitada de hardening deve preservar corpo, OID, owner, configuração e vínculo de ensure_rls, conforme a003. Esta direção não escolhe um corpo normativo nem declara equivalência entre variantes conhecidas.
- **Cobertura exata:** classificar cada entrada uma única vez, com selected∩preserved vazio, cobertura completa e todas as arestas/ocorrências nos contextos correspondentes. Não aceitar uma allowlist por nome, origem ou contagem.

A [proveniência pública](restore-public-infrastructure-provenance-20261024.md) e seu [recibo de reconstrução](evidence/restore-public-infrastructure-root-reconstruction-20261024.json) já identificam os candidatos textuais deste recorte. Essa identificação não será repetida nem transformada em equivalência, comportamento de plataforma ou aceite. O resultado histórico recusado e seus originais permanecem preservados.

## Bindings que continuam faltando

| Binding | Estado e fronteira |
|---|---|
| Corpo normativo e fixture | Não selecionados. Falta revisão exata do corpo e uma imagem/revisão pública imutável com PostgreSQL, extensões e papéis explicitados. O pinPG18.4 do produtor/formatters não é pin do servidor de infraestrutura. Não escolher o corpo antigo apenas para obter igualdade nem inferir compatibilidade do nome ou da data. |
| Oito counterparts | O manifesto completo ainda não está fechado. Não inventar os três nomes ausentes do recorte público. Exigir identidades em bytes, campos semânticos e todas as dependências/ocorrências. Hash auxilia recibo/busca; não substitui a identidade completa. |
| Vínculo operacional | Corpo/OID/owner/config/trigger reais, privilégios efetivos/defaults globais, alvo vazio, histórias, atores e capacidades continuam sem nova conferência nesta entrega. Uma fixture pública não supre esses fatos. |

Não preencher ausência com valores presumidos ou slots habilitados. O [plano anterior](handoff-20261024/plans/restore-baseline-decision.md) e a proveniência explicam as etapas distintas; este registro não abre uma nova inspeção.

## Próximo trabalho público delimitado

Preparar somente uma **especificação de fixture pública de comportamento**, antes de autoria ou execução. Usar os dois candidatos já pinados como fixtures distintas, sem declarar equivalência. A pergunta é se uma alteração restritiva de privilégios, preservando corpo/OID/owner/config/trigger, mantém o comportamento exigido em cada fixture suportada.

A especificação deve registrar a imagem/revisão pública imutável e o ambiente de servidor; sem esses inputs, parar. Deve exigir oráculos completos de pré/pós para CREATE TABLE, CREATE TABLE AS e SELECT INTO sintéticos; EXECUTE efetivo da API/PUBLIC, owner e ensure_rls; defaults futuros de TABLES/FUNCTIONS/SEQUENCES; preservação de outros owners/schemas e rollback integral diante de falha. Não executar SQL, criar policy/issuer/reader, ampliar perfil de alvo ou alterar workflow neste lote documental.

A regra pública de cobertura pode ser especificada agora. Sua vinculação às oito identidades reais pertence a uma etapa operacional posterior, não autorizada aqui: os oito pares de infraestrutura, com o contexto managed/união completo da mesma observação nominal. Não extrair apenas dezesseis entradas e presumir fechamento do grafo. Evidência privada existente só pode ser reutilizada pelo protocolo próprio; este documento não concede acesso nem solicita novo dump/backup.

## Paradas e validação

Parar diante de pin ausente/diferente, corpo ou fixture não selecionados, counterpart extra/faltante/duplicado/desconhecido, campo/owner/aresta omitido ou contexto aberto. Se for necessário alterar corpo, seleção/plano, grants globais ou outro owner, a proposta limitada deixa de bastar. Qualquer motivo A2 ou falta de proveniência/ator/vazio mantém o baseline recusado. Preparação/mutação/restore continuam pendências operacionais; nova geração de backup exige futura janela de quiescência própria.

Reutilizar os testes públicos existentes `restore-dependency-order-provenance.test.mjs`, `restore-public-infrastructure-contract.test.mjs`, `restore-managed-baseline.test.mjs`, `restore-inspected-baseline.test.mjs` e `restore-target-baseline.test.mjs`. Não criar teste que apenas espelhe esta redação. O workflow geral já inclui esses arquivos; o QA readonly público de PowerShell cobre AST/JSON do leitor, não helper/ACL/PG nem restore. Este documento não contém resultado novo de execução nem herda PASS de outra Source.

**Estado mantido:** baselineQualified=false, restoreAccepted=false, targetMutationAuthorized=false e privateAccessAuthorized=false.
