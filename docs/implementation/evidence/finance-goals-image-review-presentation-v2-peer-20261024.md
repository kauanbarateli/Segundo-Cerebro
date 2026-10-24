# Peer V2 — revisão com foto e foco natural

Favorável estaticamente, sem bloqueador objetivo restante nesta leitura. O P2 de foco que recusou V1 foi tratado na fonte e nos testes escritos; render/DOM e novo CI continuam pendentes. Nenhum Node, browser, teste, SDK, SQL, rede ou edição do autor/Root foi executado por este peer.

Manifesto: 4.346 bytes/SHA256 68a832dc92ab3d8e2947c8c74e059fac134cf3f7d7b8e6bf02cc60b162fd1e27. Foram conferidos os quinze hashes before/previous-v1/after e quatro artefatos. Editorc6649eb3…, Noticef32c42c1…, spec5ccb0fd5… são os três deltas. Picker20fb299f… e Panel62279ebf… permanecem byteiguais V1. Prefixo e sufixo em volta do único caso alterado são byteiguais891: as outras doze instâncias de caso, contraste e nomes das capturas permanecem.

ReviewNotice é componente privado em escopo de módulo. Reutiliza o markup, handlers, máscaras e mensagens da revisão financeira original. Sua única nova ação é foco DOM no botão Voltar à edição na montagem/primeiro estado não ocupado. A ref de uma vez evita recuperar o foco em cada ciclo posterior de busy. O componente é montado somente no ramo de review já autorizado; pending/reconfirm continuam com prioridade e comportamento anteriores. Nenhum hook condicional foi introduzido no pai.

O Editor guarda o botão Revisar e o estado anterior de reviewing. O novo layout effect só retorna foco no true→false e !hidden/!busy/!blocked da mesma instância isolada por key/scope. Não cancela nem prepara operação e não acessa File, URL, journal, coordinator, proof, storage ou rede. Não há timer novo. Os efeitos existentes de sessão e preview mantêm dependências; reviewing continua boolean derivado exclusivamente de channel.review.

O teste remove back.focus(). Agora exige foco natural no Back antes do Tab/ShiftTab e no Revisar após Voltar. Conserva os asserts de mesmo DOM/BlobURL/arquivo, snapshot integral do envio, nenhuma chamada na volta, mesma identidade financeira, finalize único e execute único depois do clique explícito. Não aceita uma nova UUID como recuperação e não usa um fake novo de prova. O preview continua carregado enquanto controles são escondidos; hidden e display:none não desmontam o picker.

As mensagens neutras deixam de afirmar que a foto ainda não foi enviada. A apresentação separa escolha local, envio e confirmação financeira sem inferir resultado remoto. Root/autor não alteraram CSS de produto, tokens/Geist, privacidade, handlers/guards, Core/HTTP/SQL ou Workspace/flags/schema nesta fatia.

Limite de aceite: este parecer aprova a correção de fonte para o próximo candidato, não afirma foco visual observado, contraste novo, persistência ou hosted. Git apply/whitespace/transportes ficam para Root e a execução precisa ser própria do novo SHA. O 19/19 de891 e o V1 recusado permanecem registrados separadamente.
