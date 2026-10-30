# Peer estático — composer candidato de promoção financeira

24/10/2026. **Favorável ao preparo inerte e seus gates escritos, sem bloqueador objetivo identificado nesta leitura.** Não executei Git, Node/WASM, testes, lint, SQL, serviços ou rede; não editei payloads. Isso não aprova migration, release instalada ou aplicação hospedada.

Manifesto de 2.849 B/SHA256 `99961916a031b7f5c0c6a501624168ca9e1e5c12a8415b6f545eb149d23fa17d`. Quatro after coincidem com manifesto e WT do autor; quatro artefatos também conferem.

| Path | SHA256 after |
| --- | --- |
| tests/helpers/finance-mvp-promotion-candidate-source.ts | b287aa9f1e84a935072acc554a946a32913eb8ab162d14c7158d5f16dc222f9e |
| tests/helpers/finance-mvp-promotion-candidate-sql.ts | 700452c3e50cb263f497906b697da416a0f1ae57c01f91fb4b03352eaf0fbbd3 |
| tests/adapters/finance-mvp-promotion-candidate.test.ts | 6df8817fc47d570ebb101572a5dcd4573d5bfeb58392aa06e7c2467efb5ec0e8 |
| docs/implementation/t054-finance-mvp-promotion-candidate-20261024.md | a0ab208d6245ee61f9730aeca8e532ae7e981bcec84f1e96aa71a317d316d444 |

## Conferências

- Source (38–48) remove apenas begin/commit exteriores literais das saídas dos compilers existentes. Budget exige seu marcador único revisado e tail exato; conserva cabeçalho. Não procura instruções internas ou altera corpos, DRAFT guard, prosrc ou hashes.
- Compile (55–69) valida canonical026 e chama todos os compilers pinados antes de produzir SQL. Ordem fechada 1/5/5/1/1 = 13; Budget assertions permanece separado. O teste reconstrói cada saída original exatamente a partir das etapas.
- Factory (8–20) compila/pina antes de chamar o construtor descartável. Os negativos alteram cada companion e assertion, truncam/alteram026 e reordenam/truncam grupos, exigindo zero entradas no construtor real envolvido por spy. O reader026 original fecha também o inventário do diretório: nomes desconhecidos, ausentes ou fora de ordem são recusados; bytes/pins originais permanecem no assert.
- Upgrade (118–138) exige1720/zero desvios antes da promoção. Executa Budget+B2+Goals dentro da transação, captura o fg_commit nesse mesmo engine e exige OID/owner/ACL/definer/config idênticos após E1+M1, ainda antes do commit.
- Rollback (140–154) retira apenas o último sufixo exterior e injeta23514 depois de todos os13 corpos, **antes** de COMMIT. Após rollback, compara definições, bindings/OIDs/ACL e linhas completas de todas as tabelas públicas/privadas/Auth/Storage, além do catálogo histórico1720. Não é um rollback que começa depois de alterações já commitadas.
- Os asserts Budget rodam somente depois da união completa, com suas fronteiras próprias; exigem material/definições/bindings iguais e zero helpers/triggers de fixture ao terminar.

## Riscos e limites concretos

Os testes estão escritos e não foram executados pelo autor ou por este peer. A comparação fresh/upgrade verifica convergência de definições; não substitui um catálogo esperado autorizado da nova release.1720 continua sendo somente o baseline001–026, não um aceite pós-promoção.

O factory é ferramenta de ensaio para checkout imutável. O loader relê arquivos do disco após a captura de Sources; como o documento reconhece, não é operador resistente a filesystem hostil/mutável nem aceita um target operacional. A entrada opcional serve a fixtures públicas pinadas, sem URL, SQL compilado arbitrário ou override de pin.

Atomicidade real do engine, instalação dos13 corpos, Budget asserts, typecheck/CI, catálogo ampliado com negativos, tipos oficiais, SQL Editor e gates nativos E1+M1 continuam pendentes. Nenhuma equivalência com PG17 hospedado, Storage real, restore, rollout ou produção foi inferida.
