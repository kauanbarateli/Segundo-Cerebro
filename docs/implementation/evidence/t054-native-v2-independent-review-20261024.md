# Peer independente estático — N completo V2

24/10/2026. Parecer **favorável à composição explícita e ao CI próprio**, sem novo bloqueador objetivo nos cinco deltas. Não é aceite nativo, de imagem, hosted, restore ou produção. Não executei Node, testes, SQL, bundle, processo nativo, navegador, serviço, rede ou qualquer operação privada. Não alterei fontes dos autores.

## Integridade e origem

Manifesto `finance-goals-terminal-native-complete-freeze-v2-20261024/manifest.json`: 5.924 bytes, SHA-256 `e563f8ba83d21eb94c90cb3e88a79a6e17643deb949ca83240d5a29c37c2d059`. Conferidos os 11 payloads after, os 11 previous-v1 e os 11 arquivos correspondentes no WT autor `Segundo-Cerebro-goals-terminal-browser-20261023`; tamanhos e hashes coincidem. Conferidos também patch, delta, preservation-proof e diffstat contra os quatro hashes do manifesto.

O manifesto histórico V1 permanece em 5.309 bytes/SHA `c1e7383632ddb917f741ff13f3728c1467058f6536da95b6daff87e8ac0e942b`. Seus 11 arquivos after correspondem exatamente aos beforeV1 declarados em V2. Há somente cinco paths alterados: contract, runner, dois testes e documento. Session, SQL, entry, teste de session, case e workflow são os seis N integralmente preservados. O parecer V1 e o adendo Root permanecem históricos; os dois bloqueios de composição recebem correção explícita em V2.

| Path alterado | SHA-256 after |
| --- | --- |
| tests/e2e-auth-local/finance-goals-terminal-native-contract.mjs | 4b3b3e9f1afdea242d55acbc3877a5daf2e325b726e13e5e4d118378c4eab9cc |
| scripts/verification/finance-goals-terminal-native-ci.mjs | 105878e8518c36b440da3799b3b141d6bc0b7cdfc2d2daf22c3a674d6ecae9f9 |
| tests/scripts/finance-goals-terminal-native-contract.test.mjs | 92589daf77af6bd91eaf1ea1222a4f304e22cec5e693aca6359aaffbddd1baf2 |
| tests/scripts/finance-goals-terminal-native-ci.test.mjs | 644f4357b0b22047af0fa6e0f5a73251b6f5ce4624dfd671fcaeca476ac05194 |
| docs/implementation/t054-finance-goals-terminal-native-races-20261024.md | 4989109819a2f52356681750d1134c1b3f90a5f9ae4f7ef390a0e8c78a717cd7 |

## Conferências dos deltas

1. **Seleção e runtime Node:** `contract:23–27` aceita apenas strings primitivas, seleção trim igual a `24` e runtime completo estável `24.x.y`, com comprimento limitado e sem espaços, prerelease, build ou zeros indevidos. Não chama coerção. `runner:145` passa o conteúdo real de `.nvmrc` e `process.versions.node`; a versão integral só é gravada depois da validação. O arquivo Root continua selecionando major24; ele não foi mudado para acomodar o runner.
2. **Relatório fechado V2:** `contract:79–110` acrescenta somente `nodeVersion:string|null`, exige versão2 e impõe evidência Node válida quando há fonte conhecida, caso executado ou PASS. A recusa anterior à observação conserva null. Cases, ordem, checks, contagens, unknown, pending, cleanup e limitações permanecem fechados. O entrypoint help/recusa também anuncia versão2. Um objeto sintético aceito pelo decoder não é prova de runtime real; o documento mantém essa distinção.
3. **Grafo admitido e proveniência:** `runner:22–31` acrescenta exatamente `src/lib/finance-goals-terminal-contract.ts`. A guarda extraída exige path primitivo, ausência de imports dinâmicos e admissão em conjuntos fechados. Não admite HTTP/browser/journal/WASM ou factories candidate-sql. O plugin `runner:111` continua conferindo realpath literal e SHA dos bytes previamente capturados; o predicado puro não substitui essas provas. Coleção AST, correspondência Git/blob, exports e fechamento dos módulos obrigatórios não foram relaxados.
4. **Controles novos:** contei 29 declarações de teste (contract9 + session13 + CI7), incluindo os três controles acrescentados sobre V1: major versus runtime integral/coerção; relatórioV2 sem evidência/versão antiga; grafo com contrato puro e negativos desconhecidos/dinâmicos/WASM. São testes escritos, não executados. Os 12 confrontos e os limites15s/120s/5s, OLD_EXECUTOR forte, terminais, material e cleanup não receberam delta nesta V2.

## Composição e próximo gate

Transportar somente os 11 N. Não transportar Sources históricos ou os nove M2-B a partir do WT autor. Por leitura, os Sources Root atuais conservam Terminal SHA `901cb380963c9edcd9dbdd36458311a2ad41670d12df060b35189f3632fac10d` (pin M1 7fb) e Budget SHA `724b78228e2c92d9db34a60f3f637ab03d5bbeab6061396f6af8293b5851cb41` (ajuste final de LF). Eles não foram editados ou requalificados por este peer.

Ainda são necessários os checks próprios da composição publicada: lint, TypeScript/camadas quando aplicáveis, 29 controles puros e os 12 confrontos nativos com origem/árvore/versão/fontes/material/EOF/exit/close/pending/cleanup próprios. Não herdar os 16 PASS do70c, não converter skip em PASS e não ampliar allowlists, pins, prazos ou recusas para ocultar falha. Nenhum deploy, schema, operação hosted ou rollout foi autorizado por este parecer.