# T-053/T-054 — candidato atômico de promoção, 24/10/2026

## Estado e escopo

**IMPLEMENTADO, ainda não executado:** composer de teste inerte sobre a base canônica fechada001–026. Não é migration, SQL Editor, release instalada, aplicação hospedada ou aceite de Metas/imagens. Merge, produção, flags e montagem permanecem sob decisão do mantenedor. Nenhum arquivo canônico ou proposta histórica foi alterado.

Base de autoria: `0d933d98ca8fcd6def222d184d9b9462370d98eb`, árvore `b6c018609cac8267f9c58def3385911f6dcd8eb2`. Os três arquivos da extração E1 pura, já transportados pelo Root, são dependências preservadas: `finance-goals-images-candidate-source.ts`, seu factory anterior e o controle puro de extração. O novo código não copia compilers, DDL, hashes ou WIPs de host/G0.

São somente quatro novos paths: dois helpers em `tests/helpers/finance-mvp-promotion-candidate-{source,sql}.ts`, `tests/adapters/finance-mvp-promotion-candidate.test.ts` e este documento. Não houve instalação de dependências, Node, lint, TypeScript, Vitest, WASM, PostgreSQL, navegador, SQL remoto/local, serviço, rede, commit, push ou despacho de CI durante a autoria.

## Composição mecânica

A ordem fixa é **Budget(1) → B2(5) → Goals(5) → E1-A(1) → M1(1)**. São13 companions, mais as asserções Budget independentes. `readFinanceMvpPromotionSources` reutiliza os leitores de Sources existentes; `compileFinanceMvpPromotionCandidate` exige o guard completo de26 migrations e os cinco compilers pinados antes de devolver SQL. Não há pin observado, opção de arquivo, URL, credencial, fallback ou busca de fonte no banco.

O composer remove somente as fronteiras exteriores dos resultados já compilados. Para B2/Goals/E1/M1, são o prefixo literal `begin;\n` e o sufixo literal `\ncommit;\n`. Budget retém o cabeçalho e usa o marcador exato `-- BEGIN PROPOSED MIGRATION BODY.\nbegin;\n` e o último `commit;\n`. Não há scanner genérico de BEGIN/COMMIT/ROLLBACK, remoção de bloco interno, alteração de DRAFT_ONLY ou substituição de prosrc. A retirada dos guards inertes continua exclusivamente nos compilers históricos já revisados; o composer não a reimplementa.

Os corpos ficam em cinco etapas imutáveis para inspeção mecânica, com as referências aos13 hashes originais. Eles são unidos por separadores de newline dentro de **um único BEGIN/COMMIT exterior de promoção**. O histórico001–026 continua sendo instalado pelo loader declarativo anterior, com suas próprias fronteiras: não se alega tornar o histórico inteiro uma única transação. A factory valida fontes antes de construir o engine descartável e só retorna o engine após a promoção inteira concluir. Em falha tenta ROLLBACK e fecha o engine, sem resultado positivo ou engine parcialmente retornado.

A entrada opcional da factory é somente o conjunto de fontes públicas pinadas, para negativos de pré-construção. Não aceita SQL compilado arbitrário, target, alternativa de pin ou versão de release. A composição normal lê o checkout imutável; o loader original permanece intacto e relê seus próprios arquivos ao construir a base. Esta ferramenta de teste não é um protocolo de operação sobre filesystem hostil/mutável ou um mecanismo de aplicação supervisionada.

## Invariantes mantidas

- Compilers e source gates dos13 corpos, Auth/lock/CAS/receipt-first, guards B2/Goals, oracles, OIDs e ACL históricos permanecem nos bytes originais.
- E1-A mantém lookup real por último, FK owner+file, projeção histórica `goal_project` tipo31, adição `goal_z_image_binding` tipo23 e holder completo, inclusive Meta arquivada. Não envia bytes ou presume que metadata seja aceite Storage.
- M1 conserva o executor via CREATE OR REPLACE, autoridade opaca do canonicalizador servidor, fence absoluto/imutável e quota30/min apenas para novo fechamento; não reintroduz parser SQL de canonical_input nem poda disposições.
- Asserções Budget continuam no resultado separado `budgetAssertions`, com BEGIN/ROLLBACK original. Elas nunca integram o SQL de instalação.
- Nenhum dado de negócio é criado por este composer. As fixtures Auth existentes nos testes são explicitamente sintéticas, dentro de engines descartáveis, para verificar material prévio preservado.

## Gates escritos, ainda pendentes de execução

1. Equivalência mecânica: reconstruir exatamente cada saída dos cinco compilers a partir dos corpos, confirmar ordem1/5/5/1/1, soma13 e asserções Budget idênticas. Não se tenta analisar SQL por regex para certificar atomicidade.
2. Antes de DB: alterar individualmente cada um dos13 companions, asserções, migration026, cardinalidade/reordenação; a factory deve recusar com zero entradas no construtor real embrulhado por spy. Nenhum mock substitui o loader declarativo positivo.
3. Upgrade026: exigir o catálogo histórico1720/zero desvios **antes** de promover; executar todas as etapas numa única transação, ler fg_commit após Goals e confirmar OID/ACL/owner/security/config iguais após E1+M1. Comparar definições completas à instalação candidata fresca em outro engine, sem comparar OIDs entre engines.
4. Rollback tardio: depois de todos13 corpos, antes do único COMMIT, inserir uma exceção23514 exclusiva do teste. Após ROLLBACK, exigir catálogo por definições, OIDs/ACL e material de todas as tabelas públicas/privadas/Auth/Storage iguais à base anterior e novamente1720/zero desvios. Não reduzir o erro a um simples stale ou aceitar falha parcial.
5. Dados/asserts: tabelas antigas preservam suas linhas integrais; tabelas novas entram vazias. Rodar asserções Budget somente depois da união completa e exigir retorno do material/catálogo/OIDs, zero helpers temporários e zero triggers de fixture.

O snapshot comparativo de definições cobre relações/RLS, colunas/defaults/NOT NULL, constraints, funções/ACL, triggers, índices, policies e default ACL. Não é um catálogo expected da nova release: comparar duas instalações iguais não prova que qualquer alteração seria autorizada. O catálogo ampliado com negativos, tipos oficiais, SQL Editor e inventários/closures são próximas fatias Root-owned. A exclusão de constraints `contype='n'` no comparativo mantém a distinção PG17/18; `attnotnull` continua explícito.

Comando focal proposto, **não executado**:

```text
vitest run tests/adapters/finance-mvp-promotion-candidate.test.ts
```

O novo arquivo não altera os imports nem os ataques dos seis testes financeiros existentes. Root deve decidir a composição/versionamento futuro dessas fixtures, rodar checks no SHA próprio e manter os gates nativos separados. N12 prova Goals+M1; I1–I8 precisa provar E1-A+M1. Nenhum resultado desses candidatos equivale a Storage/Auth hospedados, imagem real, restore ou rollout.

## Próxima decisão técnica

Revisar e executar este candidato em CI antes de criar qualquer migration numerada. Só depois definir a release canônica e atualizar loaders históricos/versionados, catálogo esperado, tipos oficiais e SQL Editor por fontes conhecidas, preservando001–026 e as evidências anteriores. Aplicação supervisionada e aceites conectados exigem etapas próprias; não derivam desta autoria. O restore operacional #35, Ensaio_restore, archives e preparadores privados permanecem intocados.
