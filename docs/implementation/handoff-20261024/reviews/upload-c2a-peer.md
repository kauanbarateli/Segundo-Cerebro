# Peer estático C2a — coordenador de imagens de Metas

Parecer: **V1 bloqueada por um P1 de envio após deadline**. O autor concordou com o cenário; a correção deverá preservar V1 e produzir V2. Nenhum Node, teste, DOM, navegador, HTTP, Storage, SQL, arquivo privado ou operação de upload foi executado nesta revisão.

## Fonte e integridade

Pacote `finance-goals-image-upload-c2a-freeze-v1-20261024`, manifesto 3.806 bytes, SHA-256 `b2fabf1f6861eb469542bf11c5b831e86d502fd32f5d78f93c5eab1b1356efc3`. Conferidos tamanhos e hashes dos nove payloads e dos quatro artefatos. Os 12 arquivos M2-S e quatro J2 continuam byte a byte iguais aos hashes da prova e ao checkout Root `70c5dd5`. Remover exatamente as três linhas novas do client reproduz seu before integral; before Git blob `438b21018fe786f34fd11f199b4c1c33defa7be1`, SHA-256 `630ebec71a814a63c7e96977e2d0468a9c5ece66b43fe1e7c00f2802d978e505`.

## P1 — uma lease obtida depois do prazo ainda pode enviar finalize

`src/lib/files/goal-image-upload.ts:168–171` entrega à fila de `journal.exclusive` um callback que começa por `attempt(lease)`. Esse método confere a sessão, mas chama `guard()` sem o signal da operação. Se o lock durar mais que os 150 segundos de `operation()`, a chamada externa já rejeitou e abortou o signal; a instância continua viva. Quando a lease é liberada, o callback tardio pode entrar em `finalize` para uma A em `finalizing` ou `ready-unbound`.

Na linha 158, `this.app().executeDomainCommand(...)` é avaliado antes de `wait(..., signal, ...)` conferir esse signal. Portanto a recusa de `wait` chega depois de o sender original já ter sido invocado. O CommandSession real não recebe esse AbortSignal e poderá continuar o comando original. O journal J2 não remove A, mas isso não impede um envio remoto tardio, contrariando a afirmação de que o timeout bloqueia os efeitos posteriores. Não se deve resolver isso liberando A nem gerando outro UUID.

Correção delimitada recomendada: `guard(signal)` no início de cada callback de lease associado à operação (incluindo a retomada e a reseleção), no início de `finalize` e imediatamente antes de avaliar o sender. Conferir também as demais chamadas cujo Promise é criado como argumento de `wait`, para que o ponto de IO tenha uma guarda anterior. Não alterar deadlines, journal, parser, fases, receiver, assinatura ou resultado incerto.

Negativo necessário: A já durável em `finalizing`; outra lease do mesmo upload retém o lock; `resume` expira após 150 s; comprovar a recusa antes de liberar o lock; liberar e drenar a fila; exigir **zero chamadas do sender**, zero reserve/observe/PUT, metadata integral idêntica e nenhum ready. Cobrir `ready-unbound` e a reseleção tardia se compartilharem a mesma solução. Não substituir esse teste pelo caso existente de resposta tardia de um sender que já começou: são fronteiras diferentes.

## Demais contratos examinados

Não surgiu outro bloqueador objetivo nesta leitura. A barreira concreta usa o journal financeiro privado existente e verifica owner/epoch/lease/pending e hold do controlador antes da transição local; não executa comando financeiro. A captura do serviço e a reconferência após awaits conservam owner/epoch/mode/closing. A metadata J2 é completa antes do IO, mantém UUID/corpo e não apaga a tentativa após erro. O transporte limita resposta a 64 KiB e exige EOF/UTF-8/shape, origem e URL literais, expected owner e capability nominal de uso único com credentials omit no PUT. A observação isolada não emite ready: o caminho passa pelo finalize original e pela validação fechada do arquivo. A prova em WeakMap depende da instância, identidade e alvo atual; não há clear, retire, vínculo financeiro ou montagem.

Foram lidos os quatro testes novos e o documento do pacote. Seus cenários são sintéticos e ainda precisam de TypeScript, lint, camadas, unidades e browser/servidor quando houver uma composição autorizada. O pacote continua sem presenter/host, retirement e aceite conectado. Esta revisão não autoriza montagem, execução de upload ou promoção de ambiente.