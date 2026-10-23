# Controle local público PostgreSQL18 — diagnóstico somente

Base: `0259d0cd78acc6286cf2c452c6d4cec7b330b05d`, árvore `ff47deeef569277008fe01d114760529d48d4955`. Este pacote não contém backup, archive, perfil, conexão SQL, segredo ou módulos de restore. Não altera o manifesto local, o probe original, seus testes ou o workflow EDB. Importação e execução sem flag são inertes.

O preflight PowerShell verifica, **antes de iniciar Node**, o executável Node24.19.0, wrapper, controlador e manifesto bruto; em seguida os30pins do PostgreSQL18.4 instalado em `C:\Program Files\PostgreSQL\18\bin`. Mantém leases Read sem Write/Delete sobre os34arquivos enquanto o processo roda. Recusa arquivo/ancestral reparse, drift, ambiente CI e configuração Node injetada. Não reinstala PG, copia DLLs, altera serviços, PATH global ou políticas do Windows. O caminho padrão de Node é: `C:\Program Files\nodejs\node.exe`; se não corresponder ao pin, recusa sem executar. Root pode selecionar outro caminho local absoluto com -NodePath, com os mesmos bytes/hash de Node24.19.0, nunca outra versão. A seleção é vinculada ao execPath e conferida sem reparse antes de iniciar.

O filho recebe somente SystemRoot canônico, PATH restrito, o caminho selecionado de Node e os dois nomes próprios públicos do cwd. O wrapper reconfere pins, cria cwd novo exclusivo e chama diretamente `runPublicBatch` original. Há somente dois inputs sintéticos,83B e83B+8MiB; os45s/caso e90s/lote, primeira falha, quotas e veto ao segundo spawn após inconclusivo continuam originais. Nenhuma variável GitHub/ImageVersion ou binding de ZIP é fabricado. O recibo identifica **instalação local pinada**, não distribuição EDB, runner atestado ou restore aceito. EOF permanece literalmente EOF, inclusive quando os terminais naturais chegam depois.

## QA remota antes de qualquer operação

Executar no GitHub, Node24, sem PostgreSQL e sem arquivos privados:

```text
node --test tests/scripts/local-pg18-stdin-probe.test.mjs
npx eslint --no-ignore --max-warnings=0 tests/fixtures/public-windows-pg18/local-pg18-stdin-probe.mjs tests/scripts/local-pg18-stdin-probe.test.mjs
node scripts/check-secrets.mjs
```

A suíte nova testa runtime/runner, paths, canários, ambiente mínimo, ausência contra AccessDenied/IO, dois inputs pelo controlador original, primeiro EOF preservado, filho inconclusivo impedindo segundo spawn e cleanup, exit1 sem PASS e contradições/autoridade fabricada. Usa EventEmitter e relógio sintético; importa também a QA original do controlador, que lê somente seu manifesto público do repositório. O path `tests/scripts/*.test.mjs` a inclui automaticamente no CI geral, sem novo workflow ou override do controle EDB. Não certifica ACL, carregamento de DLLs ou limpeza Windows real. Root também deve parsear o launcher via AST PowerShell sem executar seu corpo, conferir o literal de hash do wrapper e revisar os quatro paths no SHA publicado. Os checks de CI do projeto continuam necessários.

## Operação posterior exclusiva de Root

Somente após peer/checks e decisão de Root: reconferir externamente o hash do launcher contra o pacote aprovado e rodar **uma vez**, sem transcript, por PowerShell7/NoProfile:

```powershell
pwsh -NoProfile -File '<checkout-revisado>\tests\fixtures\public-windows-pg18\run-local-pg18-probe.ps1' -Execute
```

Sem parâmetros de banco, password, arquivo privado ou URLs. O preflight não pede credenciais. Não usar esse comando para recuperar banco ou importar backup. Nesta autoria não foi executado Node/PG, nem QA de runtime.

## Fechamento e falhas

O recibo Node é JSON≤64KiB em `%TEMP%\sc-local-pg18-<guid>.json`, criado com `wx`, e stdout. O envelope do launcher informa esse caminho público, código do Node, watchdog e fechamento das leases. A primeira recusa é mantida quando a limpeza falha. Nenhuma mensagem livre de exceção/PG, stdout/stderr de PG, variável de ambiente ou segredo entra no JSON.

O cwd próprio contém somente marcador público. Depois de terminais conclusivos, o wrapper verifica marcador, o remove e usa **rmdir não recursivo**: arquivos inesperados permanecem e recusam a limpeza. Confirma ausência por lstat com ENOENT próprio; AccessDenied/IO não significam ausência. Se houver filho inconclusivo, a limpeza fica bloqueada e o cwd é preservado. Não iniciar outra operação ou repetir automaticamente; Root precisa tratar esse resultado antes.

O watchdog externo120s existe para o launcher e não renova45/90s do controlador. Se precisar matar a árvore que criou, emite recusa e `outerWatchdogTreeCleanupUnconfirmed=true`; matar/WaitForExit não viram terminais naturais ou aceite de limpeza PG. O launcher não apaga o cwd nessa situação. Esse campo informa somente o watchdog externo; os estados dos filhos PG e o bloqueio de cleanup continuam sendo os do recibo Node, inclusive quando Node termina sem timeout.

Um `OBSERVED` exige ambos os casos naturais com exit/close0 sem sinal, ausência do cwd confirmada, arquivo de recibo gravado e envelope externo sem timeout/erro de leases. Mesmo assim **restoreAccepted=false**. Não muda os três predicados EPIPE privados e não torna o check EDB da PR#103 verde. A qualificação nativa/A2/A1, stream PACK019, Storage e aceites Auth/Cofre/dados continuam separados.
