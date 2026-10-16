# Integração do transporte binário Windows — Frente B

O controle público de `pg_restore 18.4 --file=-` no Windows produziu CRLF. O reader dos históricos agora usa um named pipe próprio em modo binário para conservar os bytes do produtor, sem converter SQL/COPY nem alterar a gramática de B3. O [módulo separado](frente-b-native-binary-output.md) descreve sua interface e os limites de confiança.

## Ordem e autoridade

O fluxo conserva autenticação integral do backup, reconferência do ciphertext, listagem original, plano e TOC binário antes de extrair os dois históricos. Depois materializa a lista própria, inicia a lease do helper, aguarda READY e obtém seu path uma única vez. Somente então inicia o PG original com `--file=<pipe próprio>`.

O coletor do PG e o coletor do helper permanecem separados. O primeiro exige seus próprios stdin finish/callback ou EPIPE pareado permitido, stdout/stderr EOF, exit0 e close0. A saída padrão do PG precisa estar vazia quando a saída SQL vai para o pipe. O helper exige READY/COMPLETE, contagem/digest, seus próprios EOFs e exit/close0. `Promise.all` aguarda os dois; nenhum evento é sintetizado ou atribuído ao outro processo.

Só depois dessas provas o reader obtém uma cópia dedicada e chama B3. `nativeFacts.stdoutBytes` continua descrevendo os bytes SQL de B3; `outputTransport=windows_binary_pipe` e `binaryHelper` distinguem o novo canal dos terminais originais do PG. O contador diagnóstico `stdoutBytes` recebe o tamanho SQL depois da cópia qualificada. Os campos anteriores de EOF/close descrevem o PG, não o helper.

O mesmo escopo original de até 45 segundos inclui criação, coleta, parse e limpeza. Nenhum prazo é renovado. O guard do helper fica retido com o receipt dos históricos e é reconferido durante a limpeza externa do inspector e no getter final. Falhas tardias de qualquer produtor invalidam o uso; descarte zera as cópias e não prova término de processo.

As duas portas de teste anteriores continuam no canal stdout sintético. A terceira porta opcional `binaryOutput` permite exercitar a integração em RAM; qualquer injeção mantém o receipt externo em modo `synthetic`, mesmo que os metadados fornecidos aleguem `native`. O modo nativo usa somente o módulo interno e os provedores reais. Isso não cunha capacidade de restore, autenticidade do archive ou autorização do destino.

## Controles executados

- Root passou **59/59** controles combinados do delta de prazo Auth e do reader integrado. A primeira rodada teve uma falha de classificação de erro e a seguinte uma falha no getter da fixture; ambas foram corrigidas e reconferidas. Esses resultados não são testes de navegador.
- Com o primeiro helper, Root passou **105/105** testes combinados em RAM, lint e peer de fonte. O [primeiro controle público](evidence/public-windows-pg18-binary-pipe-first-20261016.json) recusou o receipt: encerramento original do helper, isoladamente, não bastou para aceitar a integridade.
- A revisão encontrou retornos de escrita .NET que podiam entrar no pipeline PowerShell. O helper agora suprime explicitamente esses resultados com `[void]`; a leitura conserva a atribuição do número de bytes. Regressão de fonte falhou antes e passou depois. Não foram normalizados payload, digest, limites ou parser.
- Com o helper corrigido, Root passou **78/78** controles de helper, reader e B3 em Node 24.19.0, concorrência 1, além de lint dos dois módulos/testes e do controle público. Os 28 controles Auth anteriores conservam sua fonte e evidência próprias.
- O [novo controle público corrigido](evidence/public-windows-pg18-binary-pipe-corrected-20261016.json) executou uma vez: fixture artificial de 83 bytes, saída de 551 bytes, LF no banner, zero CRLF, integridade do helper e terminais originais dos dois processos confirmados. Nenhum perfil, backup privado, banco ou rede foi acessado.
- Após a cópia por hashes para Main, Root passou **34/34 controles do inspector**, com o controle ACL nativo preexistente explicitamente excluído. O novo preparo v3, com união de 15 fontes, passou **173/173 controles puros do autor e 173/173 de Root**, incluindo 170 JSONs artificiais; peer conferiu o delta, pins e gates. Scanner de 1.511 arquivos passou. Essas execuções não acessaram perfil ou backup privado nem iniciaram a inspeção real.

O controle público não certifica os históricos privados nem atribui retrospectivamente todos os bytes recusados à diferença de transporte. Uma nova inspeção privada exige preparo novo, união de fontes atualizada e SHA publicado. Não existe comparação A2, baseline do alvo, mint, sétima importação ou aceite de restore neste registro.
