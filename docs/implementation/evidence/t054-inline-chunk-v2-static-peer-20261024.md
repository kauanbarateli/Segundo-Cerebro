# Reconferência estática — inline chunk V2

24/10/2026. Favorável; P2 da V1 fechado, sem novo bloqueador objetivo. Nenhum Node, teste, bundle, renderer, SDK, SQL ou rede executado por este peer.

Manifesto EV/inline-browser-chunk-self-metadata-freeze-v2-20261024:17428b216fdf8f0be7facb08d54436c4c58abbc259f52ac45fea234c6468eb2c. Quatro after conferidos por bytes/SHA; patch coincide com o manifesto.

A condição mjs:13 agora exige length0 ou índice0 próprio e igualdade exata ao fileName, sob o length<=1 anterior. Array(1) e uma selfref somente herdada não passam. O teste acrescenta ambos os negativos e reconfirma que o índice próprio não foi criado. A inversão textual remove apenas esse bloco e troca apenas a linha Own0+Self, recompondo helper/teste V1 inteiros.

Spec e declaration são byteiguais à V1. IIFE único, imports[], regex original, codeSplitting:false, CSS/cleanup e demais controles permanecem. AST/parseDiagnostics e todos os negativos nonself/misto/duplicata, imports reais, import.meta e exportfrom também permanecem literais.

Hashes after: helper1eb5849559b3632899026748edea31669225f020047f1e1644f5e19608c968f1; teste88281fb8fd9b50008b0153cb53dcf9c35fb2670bf38fb458a6f2f2b723d37425. Spec16febe14d77f237b4758738b1d46bd760e8378b8febf9c53357e541683718dcd e declaration4f7909c22755716349c8fac19a5db2c8f74096c5983a908ecab7bd8754549c42 preservados.

Root informou sete puros após freeze; não reexecutei nem atribuí aceite de bundle/CI novo. A validação do output concreto e o restante do coorte continuam gates próprios.
