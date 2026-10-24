# Peer estático EFix1-R2 — tipo do wrapper Web Locks — 24/10/2026

Parecer favorável estático, sem novo bloqueador objetivo neste delta. A correção mantém o callback e a Web Lock nativa e explicita adoção assíncrona da Promise na fixture. Não afirma Typecheck aprovado nem execução de casos.

## Pacote correto e integridade

Somente `finance-goals-image-upload-editor-efix1-r2-20261024` foi revisado como candidato aplicável. Manifesto de 2.347 bytes: SHA256 `47fc3930bc951eff7b1deacb8584f1ce082ede29921bf0458a3937a5f42b1fd0`. O diretório anterior sem `-r2` registra o incidente de alias PowerShell Diff e patch vazio; não deve ser aplicado nem substituído silenciosamente.

Conferi 2 before, 2 after e 3 artefatos por tamanho/hash, sem divergência. Os dois before coincidem com os respectivos after congelados E3. `changes.patch` tem 3.058 bytes, SHA256 `5dd883a2f1e059c7c7eb6a2e3f2e4c20e11635a40147c37ed0e09d8e428593c3` e exatamente dois headers, correspondentes à fixture e ao documento. Conferência textual não equivale a Git apply/check; Root fará a aplicação em checkout autorizado.

## Mudança única de código

`tests/e2e/helpers/finance-goals-image-upload-fixture.tsx:32` muda somente:

`<T,>(name, work): Promise<T> => navigator.locks.request(name, work)`

para:

`async <T,>(name, work): Promise<T> => await navigator.locks.request(name, work)`.

Os tipos explícitos de name e work são preservados, assim como o argumento name, o callback work e a invocação nativa request. Não foi criado cast, valor substituto, early release, lease simulada, tratamento de rejeição que permita continuar, supressão de diagnóstico ou ajuste do oracle. O await continua ligado à Promise retornada pela mesma chamada; não troca o callback por uma tarefa destacada.

A substituição ocorre uma vez. Invertê-la em RAM reconstitui exatamente o raw before/E3 de 14.621 bytes, incluindo o restante do harness. After: 14.633 bytes, SHA256 `87d81b76574ecd2fece58ac64687d1137977d95dae3f3621d522d4b8480b5234`; before SHA256 `d6357c9cf2bb1a40b94f4cd842363ede3e6df5559e8a49eeb567c308d56ed120`.

## Declaração DOM conferida, sem executar compilador

Li o package local TypeScript 5.9.3 e `lib.dom.d.ts`, 1.874.901 bytes, SHA256 `080941d9f9ff9307f7e27a83bcd888b7c8270716c39af943532438932ec1d0b9`, igual ao declarations.json do pacote.

- Linhas 19415–19416: `request<T>(name, callback): Promise<T>` e a sobrecarga com options.
- Linhas 38017–38018: `LockGrantedCallback<T>` retorna T.

Com work retornando Promise<T>, o tipo genérico da chamada request é inferido como Promise<T>; a expressão síncrona é tipada como Promise<Promise<T>>, incompatível com a interface externa Promise<T>. O wrapper async + await faz a adoção/flattening pelo mecanismo de await e conserva a interface Promise<T>. Isto é conclusão da leitura das declarações, não resultado de tsc ou validação de Web Locks no navegador.

## Documento e limites

O segundo arquivo apenas acrescenta nota factual sobre a recusa de Typecheck, a declaração e a correção. Before doc SHA256 `3848fc0d88e0c5529d6aac14e2cb0d51a3a656447821f22e4595f5108fee4eed`; after SHA256 `6a96205bea5d1f3969ed99aa6d44cb720704a601b847a63db3de78a87243b629`. O prefixo anterior foi preservado integralmente.

Segundo Root, os 19 originais de deb586d encerraram em 17 PASS e 2 FAIL nos gerais, ambos em Typecheck antes de unidades/E2E. Essa evidência não executou a hipótese R2 nem os casos visuais E3 e não pode ser herdada pelo próximo SHA. N12 nativo é gate separado; não comprova este wrapper/UI/Storage.

Não executei Node, TypeScript, lint, testes, navegador/renderer, SQL, rede, serviço ou Git writes. Não editei produto, WT, frozen payload ou os incidentes anteriores. Próximos gates: Root conferir before/aplicação do pacote correto, unir o hotfix R3, obter Typecheck e CI próprios e analisar os resultados originais sem converter skip ou ausência de execução em PASS. Merge, produção, montagem e restore continuam fora deste parecer.
