# Main conectado #62–65 — versão externa concreta

**Código pronto para Root/peer; nenhuma execução pela autoria.** proposal-v1 permanece intacta. Este main-v1 contém entry, Runtime, codec e testes. O transporte do Preview permanece em HOLD até Root vincular a origem correta e liberar um canal autorizado. Não há criação de atores para descobrir se a proteção permite acesso.

## Ordem e ausência de efeitos antes do canal

Prepare só lê/hash/gera manifesto local; não abre env ou rede. Execute exige o hash próprio, selo, config aprovada, Source 3403/tree 7fdeb, deployment dpl5SA, projeto Twry, janela operacional explícita e prova 404 do Root. O resultado/journal/plan do GET concluído são pinados; A/B são exatamente os UUIDs reservados nesse plano. **Não há ABSENCE_A novo.** A ausência de B é conferida antes de criá-lo. O diagnóstico 404 não é repetido nem reinterpretado a partir da antiga 403 HEAD Data API.

A primeira chamada externa de Main é GET /api/onboarding em jar novo, sem Auth do app/chave/Bearer. Só 401 JSON com o código e mensagem estática exatos da rota prova que a proteção Vercel deixou a requisição chegar ao app. HTML/SSO/redirect/shape diferente não são essa prova.

Sem canal, retorna HOLD_PROTECTION com Auth requests 0/creates 0. O input privado opcional AuthorizedDeploymentLink só é materializado se Root aprovou seu uso no mesmo deployment/origem e validade. Suporte estreito: URL HTTPS da mesma origem, raiz e único parâmetro _vercel_share, sem userinfo/fragmento/percent encoding. Outro formato fica HOLD/recusado, sem adaptar secretamente URL/alias. O link nunca vai a arquivo/journal/console. Nenhuma proteção é desativada; não há headers de bypass/OIDC, CLI, SSO automatizado ou cookiejar humano.

Com link autorizado, há no máximo três GETs finitos: direto, link e confirmação app 401. Não se segue redirect; Location de retorno precisa ser mesma origem e caminho simples conhecido. Só o cookie _vercel_jwt recebido por esse jar novo pode ser copiado em RAM aos jars A/A2/B, sempre restrito ao host atual. Nenhum sc-auth humano é importado. Link expirado, resposta desconhecida ou proteção persistente param antes de carregar Secret/publishable, gerar senhas ou enviar Auth Create.

## As quatro alterações finitas

1. O Auth donor 61e7 mantém 22 helpers literais. Invoke-Operation conserva todo o corpo de I/O e recebe somente uma pré-condição adicional de teto total 64, também protegendo cleanup. Set-Session original continua literal: Capture-Session copia a resposta GoTrue real antes de o helper remover refresh_token. GET user e my_access_state precisam confirmar identidade comum/sessão antes de instalar cookies.
2. O codec SSR 0.12.7/sc-auth/base64url/chunk 3180 é o port puro já proposto. O factory agora aceita somente eventual cookie de proteção recebido no preflight; A/A2/B têm jars independentes. A2 usa a mesma sessão real de A. No Preview não existem Authorization/apikey/default credentials; Origin e expectedUser vêm do plano/ator. TLS, redirect recusado, streaming 1 MiB, request 64 KiB, 15 s/request e deadline 300 s permanecem bounded.
3. Main.Runtime resolve apenas os 64 steps fechados. Não interpreta JSON como código/URL. Start/save/confirm/advance repetidos usam o corpo/clientId original; CAS usa revisão real capturada, sem rebase. Sete advances correspondem aos sete kinds da fonte. Cada ACK valida shape/estado; unknown/pending em retorno de advance vira COMMIT_UNCONFIRMED e bloqueia cleanup. Recibos já confirmados precisam permanecer idênticos entre advances.
4. Relatório novo, contagens próprias 19 Auth+45 Preview, journal before/after e primeira falha preservada. A exportação fixture-bindings.json ocorre antes do cleanup, inclusive quando houve falha parcial; fixture-cleanup.json registra o estado posterior dos mesmos atores. Nenhum payload/token/cookie é exportado. O cleanup donor é literal, confirma markers/ID/email, logout, DELETE exato e ausência 404. Transporte interrompido/escrita incerta não autoriza limpeza. Falha de exportação conserva fixtures para reconciliação.

O deadline 300 s começa antes do preflight e permanece cumulativo até a admissão final. Filesystem síncrono não tem preempção garantida; não se promete interrupção física no milissegundo. O preflight tem teto próprio 3 GET e não amplia o teto 64 do cenário. O GET Admin diagnóstico já executado é evidência externa reutilizada, não chamada deste Main.

## Por que os 64 passos estão no recorte D-077

MATRIX.json marca cada passo por finalidade: 10 pré-condições Auth, 46 critérios/observações de onboarding e 8 sessão/cleanup. Não são 64 permutações manuais nem 64 critérios diferentes. São requests programáticos, inclusive sete efeitos unitários e as leituras necessárias para comparar estado. A repetição de ABSENCE_A foi trocada pelo negativo RLS_FOREIGN_PROFILE_A com JWT ordinário, útil ao isolamento e sem service_role. Não há comercial #54/#68, billing, checkout, Drive, novo OAuth, consentimento ou revogação Google.

A escolha completa A tem nome/foco, Hábito diário, Projeto/contexto, Tarefa por ID/data civil do snapshot, Caderno/Página e vínculo. B conclui vazio. Fonte e schema são os atuais; nenhuma migration/ACL/DTO muda. Suites e provas 85b/a8e/D1/Fundação 541 E2E cobrem as outras permutações nos seus canais; Main não força expiração 720 h, Cron, suspensão comercial ou espera de provedor. Não declara que mocks são consentimento, SDK ou UI hospedada.

## Operação Root após revisão

1. Manter config.approvedByRoot=false até revisar todos os bytes/testes. Vincular previewOrigin à origem real APP_URL e ao deployment 3403 atual; confirmar target Twry/source pelos recibos permitidos. Preencher executionWindowEndsUtc; a janela precisa conter o 404 pinado e a execução. Não refazer o probe. Não usar cookie de browser.
2. Root executa os puros separadamente, sem credencial/API: main-static-contracts.test.ps1, main-pure-contracts.test.ps1, cookie-codec-pure.test.ps1; o oracle oficial mjs só carrega dois utilitários CJS fixados, sem SDK cliente. Nenhum desses testes foi executado pela autoria. Os 7 checks do oracle V1 passaram por Root, mas o Main/factory novo não herdam esse PASS.
3. Prepare cria runs/<novoRun>/manifest+seal, actors A/B vindos do probe, clientIds/keys antes de efeitos. Se config mudar depois, preparar outro manifesto antes de executar; nunca retomar um STARTED. Nenhuma senha/token/link é gravado.
4. Somente após revisão e autorização do canal, Root passa SecureStrings privados SecretKey/PublishableKey/AuthorizedDeploymentLink ao Execute, com ExpectedRunnerSha256 e AllowHostedWrites. O script não lê nenhum env. Sem canal, HOLD sem Auth. Root obtém a credencial exclusivamente da fonte privada já autorizada; não usar texto de CLI/transcript.
5. Root pode fazer auditoria RO final dos dois UUIDs do manifesto, sem selecionar QA nem fazer DML. cleanupAuthConfirmed não equivale a todas as cascatas; cleanupCascadeVerified permanece null até prova própria. O arquivo privado de bindings serve exatamente a essa seleção.

Estado: parser AST 6 PS sem erros e comparação estática dos helpers/pins; todos os testes Main e todo HTTP/SDK/DB/browser seguem NOT_RUN pela autoria. Source 3403 Preview é independente do Source f39 documental. Produção/Operations, arquivos privados/backup e a QA existente permanecem fora. O Main não fecha automaticamente #62–65/#80/#81 ou libera merge/produção.
