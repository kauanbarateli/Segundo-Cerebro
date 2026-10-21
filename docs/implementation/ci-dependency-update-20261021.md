# Atualização de segurança da cadeia de testes — 21/10/2026

## Motivo e estado observado

A [issue #96](https://github.com/kauanbarateli/Segundo-Cerebro/issues/96) acompanha os avisos oficiais [GHSA-qxg6-89mg-rqv8](https://github.com/vitest-dev/vitest/security/advisories/GHSA-qxg6-89mg-rqv8) e [GHSA-xp26-3454-mjgp](https://github.com/vitest-dev/vitest/security/advisories/GHSA-xp26-3454-mjgp), corrigidos na série 4.x em 4.1.12. Os lockfiles das PRs #94 e #95 resolvem Vitest/@vitest/mocker 4.1.11 e são byte a byte iguais. A exceção pós-MVP da #36 refere-se a outro aviso e não se aplica a estes dois avisos já corrigidos.

No Calendário, SHA `61fa45929029503c780505250735f7355a2f3235`, os 16 runs originais aplicáveis terminaram na tentativa 1: 14 success e dois failure. CI [push 39678769491](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/39678769491) e [PR 39678777803](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/39678777803) falharam no npm audit por dois avisos moderados. Os sete cenários nativos passaram nos dois eventos. Chromium não corresponde aos sete paths dessa rodada; o diagnóstico extra de Capturas não dispara nesta branch. Não houve rerun, cancelamento ou flexibilização de gate.

Capturas, SHA `d3c55d84500afa32d39d566262e92e91081d46f9`, obteve 18/18 success antes da atualização dos avisos: ambos os CIs passaram build/E2E, com 335 testes de navegador por evento; scripts 1.768/1.768, unidades 2.308 por fuso, SQL, tipos/concorrência e cenários nativos passaram. A auditoria dessa rodada é histórica; não prova segurança atual do lockfile afetado. As pendências de editor, migrations e aceite hospedado permanecem.

## Preparação remota, sem importar automaticamente

O workflow `dependency-candidates.yml` prepara um candidato somente nesta branch de revisão. Push corresponde apenas ao próprio workflow e ao gerador; uma atualização posterior dos dois arquivos package não torna esse preparador pontual um gate permanente. O dispatch conserva o destino e a fonte fixos. Os workflows originais, sua auditoria e seus testes permanecem intactos.

O gerador exige Linux/Node 24 em GitHub Actions, repositório/ref e hashes anteriores exatos. Copia somente package.json e package-lock.json para temporário isolado, sem .env, perfis ou credenciais. Executa o npm com registro oficial, sem shell/scripts de instalação, prazos e teto de saída; fixa Vitest 4.1.12 e exige auditoria completa com todos os contadores zero. O package só pode mudar nessa dependência de desenvolvimento; o lock preserva a raiz e expõe o delta transitivo para revisão.

O artefato tem somente package.json, package-lock.json e metadados fechados de procedência/hashes/delta/auditoria. Não é aceite, commit, instalação de schema, merge ou deploy. Logs de subprocessos/configuração não são publicados. Erro, timeout, auditoria não zero ou diff inesperado impedem `ready` e upload.

## Conferência e próximos passos

Root deve conferir SHA de origem e checkout, run original, digest oficial do ZIP, paths, hashes/tamanhos dos três arquivos, igualdade das fontes anteriores e delta completo. O lock não será editado manualmente. Importar somente os dois arquivos revisados e publicar em commit próprio; o mesmo delta pode ser usado em Capturas enquanto as fontes antigas continuarem idênticas. Se houver divergência, reconciliar antes de importar.

Os novos HEADs precisam de seus portões originais completos. Um candidato com auditoria zero não substitui npm ci, testes, build/E2E e cenários nativos no SHA integrado. Não promover falhas ou estados antigos a PASS, nem repetir runs para obter outra observação. Antes de cada nova publicação Root, confirmar os runs originais do último SHA publicado em estado terminal.

Sem execução local de Node/npm/PostgreSQL/browser nesta máquina de 8 GiB. Nenhuma conexão ao banco pessoal, alteração Asaas, aplicação de migration, sincronização, segredo, plano ou deploy nesta correção.
