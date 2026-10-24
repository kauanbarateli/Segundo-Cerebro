# Preparação nova de inspeção somente leitura — 22/10/2026

**PREPARADO / NÃO EXECUTADO / NÃO AUTORIZA RESTORE.** Refs #41/#42/#35. A revisão e a decisão de executar pertencem à Root. Nenhuma captura CLOSED foi reaberta. Não foram abertos, listados ou hashados perfil, certificado ou archive privados; não houve conexão, Node, SQL, navegador ou teste local.

## Fonte e destino fixos

- Fonte pública: PR #100, commit `3d86cd8f7e1e97e89990513237a8d4ef792b3249`, árvore `7566fe2ee28c2199ad07252a758072aa239ea247`.
- Checkout de execução conferido pelo preparo: `C:\Users\Kauan Sousa Barateli\Documents\Codex\2026-10-07\inicie-a-constru-o-do-software-2\work\Segundo-Cerebro-finance-review`. Este pacote não altera esse checkout.
- Operação única: PS7 `-NoProfile -NonInteractive` → dispatcher versionado `run-operator.ps1 -Operation restore-inspect-baseline` → inspector original. Não existe escolha de comando, SQL, alvo ou executable pelo chamador.
- Origem pessoal: `rishenjoikgmfubmnfiu`. Alvo autorizado historicamente: Ensaio_restore `jvwduowyavpaxssogadn`. O perfil pinado conserva sua configuração; não foram conferidos agora seu conteúdo ou o estado remoto. Outro projeto exige autorização e preparo novos; a forma genérica do guard do aplicativo não concede essa autorização.

O archive permitido é **somente o de 17/10 já declarado no template público**, com basename `second-brain-2026-10-17T01-27-25-163Z-6b65e5f5.scbackup`, SHA-256 `21c0e0eb0b60a123854ec4d10d2bdbf69e1cb922bc2ed2591c89ec422262088a`, ciphertext 951.230 bytes e plaintext do banco 950.017 bytes. Esses são metadados históricos herdados, não medição nova. O default `ArchiveBinding=$null` impede uso implícito. Backup futuro/025 exige outro binding revisado; não selecionar “mais recente”, aceitar path livre ou inferir versão pelo ledger.

## Gates e fronteira privada

`GateExecute=$false`, `ReviewedCommit=$null`, `ArchiveBinding=$null` e `SelfSha256=''` são os defaults. Gate falso termina antes de I/O operativo e não exige as entradas privadas. Gate verdadeiro sozinho é insuficiente: exige PS7/Windows, commit **exatamente** 3d, self path/hash, HEAD/tree exatos, 19 paths tracked limpos e todos os pins públicos/executáveis sob leases `FileShare.Read`. Somente depois desses gates pode a futura execução abrir leases do perfil DPAPI, certificado e archive pinados. O preparo não desserializa o perfil; somente o dispatcher o faz na execução futura autorizada.

Os seis executáveis públicos foram reconferidos **por leitura de bytes**, sem iniciá-los: Node24, PS7, pg_restore18, pg_dump18, psql17 e o PowerShell5 derivado de SystemRoot. Todos mantêm bytes/hashes da referência. Perfil DPAPI (3.901 bytes/`e2cd8374…`), certificado (`70072358…`) e archive mantêm apenas pins previamente declarados; nenhuma entrada privada foi consultada. Os pins verificam arquivos, não toda a closure de DLLs ou a integridade de uma máquina hostil.

A união transitiva continua com 19 arquivos: dispatcher selecionado e 18 módulos alcançados pelos imports relativos do inspector. O observer novo é interno ao inspector; não adiciona um import. Atualizados os pins do inspector (53.678 bytes/`915f5753…`) e do SQL de validação importado transitivamente (63.650 bytes/`9a178637…`). Os outros 17 permanecem iguais. A presença transitiva do SQL025 não o executa nesta inspeção. O parser JavaScript estreito `parseSourceTocFailure` não é importado nem usado como atalho de aceite; ele não cobre sucesso, outras fases ou erro do operador.

## Coleta e interpretação

- Teto externo **90 s**, cooperativo e sem renovação, inclui preparo/coleta e liberação dos recursos próprios; há reconferência depois do parse e veto de sucesso tardio após liberar os recursos. Uma recusa já existente conserva seu código. Chamadas síncronas são conferidas antes/depois, sem promessa de preempção. O inspector mantém seu prazo absoluto **45 s**, com ACL **15 s** dentro dele. Nenhum desses prazos foi ampliado.
- Child PS7 sem shell/janela, ambiente selecionado com `Environment.Clear()`, PATH System32 e PATHEXT `.EXE`. Credenciais PG, NODE_OPTIONS/NODE_PATH e tokens alheios não são herdados.
- stdout bruto em RAM até **64 KiB**, UTF-8 estrito, JSON único com nomes duplicados recusados e profundidade limitada. stderr é drenado, descartado e zerado, nunca interpretado ou impresso. Os dois EOFs e a saída original do child precisam ser observados; timeout/kill não certificam terminação ou limpeza. Os guards nativos originais continuam pertencendo ao inspector.
- Leitor integral: sucesso nativo de comparação; falhas fechadas em todas as fases combinadas; envelope curto `OPERATOR_SETUP_FAILED`. Exit0 exige sucesso, exit1 exige falha. Shapes/códigos desconhecidos recusam; nenhuma mensagem/stack/path/URL é encaminhada. Inventário Source continua deliberadamente omitido na projeção externa, como na referência.
- Falhas incluem `sourceTocDiagnostic`, nulo antes de haver observer. Quando presente, valida versão/observer, as duas fotografias, 22 eventos nominais, sequência saturada64/overflow, códigos e sinais fechados, `firstError`/`lastError` e preservação dos fatos iniciais. `firstRefusal=null` é legítimo depois de Source bem-sucedido e falha posterior. Estado inicial não é reescrito pelos fatos da limpeza. Ausência de evento continua nula; pedido local ou ACK nunca vira EOF.
- `ok:true` do preparo significa somente inspeção concluída e envelope aceito; A2 pode registrar diferenças. `inspectionOnly:true`, `baselineQualified:false`, `remoteMutation:false` e `restoreAccepted:false` permanecem obrigatórios. Nada concede mint/capacidade/importação, ownership remoto, recuperação ou aceite hospedado.

## QA preparado e ainda não executado

O `test-*.ps1` lê somente o novo template público e seleciona via AST 26 funções puras do leitor. O mesmo leitor de bytes usado pelo coletor operativo é exercitado com UTF-8 inválido, tamanho excessivo, entrada vazia/nula e JSON duplo/truncado. Não executa o corpo operativo, dispatcher, processos, arquivos privados ou SQL. O pin de self da QA é o hash do preparo final; alteração requer revisão e novo pin.

Conservados os controles anteriores de binding exato, defaults, 19 fontes, leases/ambiente/EOFs, A2/ordem dos motivos, correlações TOC/histórias/snapshot, modos sintéticos recusados, autoridade falsa, codes fechados, sucesso/falha/exit e `OPERATOR_SETUP_FAILED`. Novos vetores em RAM cobrem:

- SourceTOC recusado com fatos antes/depois, erro/callback discordantes e primeira observação preservada;
- Source bem-sucedido com recusa posterior e `firstRefusal=null`;
- todos os enums de erro/sinal/exit, ausência de EOF e saturação explícita;
- campos faltantes/extras, canários de mensagem/path/URL, duplicados simples e escapados;
- sequência fora do limite/fracionária/repetida, overflow incoerente, erro órfão ou fora da ordem, reescrita de fatos/primeiro erro e regressão no cleanup;
- `sourceTocDiagnostic` ausente recusado no novo envelope, null permitido conforme contrato e nenhuma promoção a autoridade.

**Executado agora:** somente leitura/hashes públicos, autoria e parse estático AST para detectar sintaxe. **Não executado:** QA, default gate, gate operativo, Node, dispatcher, inspector, PostgreSQL, conexão ou operação privada. Root/peer ainda precisam revisar o pacote e decidir a QA. Depois, qualquer inspeção real deve ser uma invocação nova explícita, sem retry automático; os resultados CLOSED anteriores permanecem históricos. Não aplicar schema, criar backup, fazer restore, abrir vendas ou agendar tarefas por este pacote.
