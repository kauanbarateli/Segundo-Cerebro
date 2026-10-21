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

## Candidato observado em 8f25900

O [gerador original 39680613942](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/39680613942), tentativa 1, terminou success na origem `8f2590032c1baa5c902ebcad2079ffb704c0d46a`. Root conferiu diretamente a API de origem/digest e os bytes, além da conferência independente: artefato 12383936455, ZIP de 73.356 bytes/SHA256 `0b23efc2048b3bee4021b35b6d529302408a1e86d93698b3ffcd0ba19fbe3c0b`, exatamente três arquivos, sem paths adicionais. Node 24.22.0/npm 11.19.1 foram observados no runner. Os seis contadores da auditoria retornaram zero.

Fontes: package.json 3.501 bytes/SHA256 `3059287dd0f9bfeba6d1e627d7daba7543d7dd1bb25e017ff282c586577e08ba`; lock 325.125 bytes/`f35dd10194b2b7c3ead7f79b811638f9f36b4c92ea4ce041c4b0e8e94468c38a`. Candidatos: package.json 3.501 bytes/`9109fbd6052e5d776b64c1837ea48668d42bcbc8163338b55c665684b7fedbf4`; lock 336.438 bytes/`b6acef1f82b129623a85846b02677ed4dcbc570ea50af290135216955bd9790b`. O manifesto muda somente a faixa `^4.1.0` para a versão exata 4.1.12.

O delta transitivo contém 27 entradas além da raiz: oito pacotes da família Vitest de 4.1.11 para 4.1.12, Vite de 8.3.3 para 8.3.5 e 18 entradas novas sob o Vite (PostCSS, Rolldown, seus bindings opcionais por plataforma e tipos). A dependência direta Rolldown 1.2.12 permanece preservada. Não houve atualização de major ou dependências de produto; este delta de desenvolvimento precisa passar npm ci e os testes completos após a importação. A auditoria do preparador não os substitui.

Dois leitores independentes e Root conferiram o delta completo. As 27 entradas são de desenvolvimento; os 15 bindings novos são opcionais e não surgiu novo script de instalação. As dependências de Vite justificam as cópias aninhadas sem trocar Rolldown/PostCSS da raiz. Root importou apenas os bytes de package.json e lock conferidos acima, preservando todos os demais arquivos gerados.

Antes da nova publicação, os 18 originais de 8f25900 terminaram na tentativa 1: 16 success e dois failure, sem rerun/cancelamento. As únicas falhas foram os CIs [push 39680613859](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/39680613859) e [PR 39680628734](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/39680628734), ainda no lock anterior, pelo mesmo audit. Os sete cenários nativos nos dois eventos, Chromium e o preparador passaram. O novo commit dos dois arquivos corrigidos ainda precisa de sua rodada original completa.
