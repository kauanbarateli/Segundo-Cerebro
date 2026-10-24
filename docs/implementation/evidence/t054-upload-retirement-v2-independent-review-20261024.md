# R7 V2 — peer estático independente

Resultado: favorável, sem novo bloqueador objetivo nesta leitura. O P2 da V1 está endereçado estaticamente. Runtime, TypeScript, lint, testes, navegador/Storage real e CI do candidato combinado continuam pendentes; este parecer não autoriza montagem ou operação conectada.

Fonte congelada: finance-goals-image-upload-retirement-freeze-v2-20261024/manifest.json, 5.359 bytes, SHA-256 9ac3f3f2107d56d4054bb60481e96f41ae2a1b6042264d738e49b4ac2c91feef. Foram conferidos tamanhos e hashes dos sete after, sete before e sua igualdade com os sete after da V1, além dos quatro artefatos. Zero divergências. Quatro deltas efetivos: J2, seus testes, testes do retirement e documento; client, coordinator e teste do issuer permanecem byte-exatos da V1 previamente revista. A V1 bloqueada não recebe aceite retroativo.

## P2 e reconciliação do hold

Em src/lib/files/goal-image-upload-journal.ts:116–134, reconcileReplacement só executa sob a lease/guard já existente, chamado antes do trabalho do consumidor em :188. A candidata B fica vinculada ao predecessor inteiro (:182–184). O registro durável passa pelo decoder fechado, owner/epoch e limite originais (:61–69); sua identidade imutável completa, normalizada apenas em phase/uploadId, precisa coincidir com a candidata exata (:120).

A revisão mínima é derivada do predecessor e do menor caminho permitido por fase: +1 prepared, +2 reserving, +3 reserved, +4 put-uncertain, +5 put-confirmed/finalizing e +6 ready-unbound/review. O salto uncertain→finalizing explica +5. Identidade divergente ou revisão insuficiente não limpa o hold. Nenhum phase/state/ID inválido é admitido pelo decoder. Nada permite A operar B ou substitui o CAS integral de replaceRetired.

O efeito da reconciliação limita-se a heldPrepared=B e heldReplacement=null. Não chama SET/DELETE, não altera revisão, não executa HTTP/Storage e não emite ready/proof/grant. Há guards antes de observar o hold, antes de mudar os caches e depois. Se o último fence falhar transitoriamente, os caches anteriores são restaurados; se houve revoke/dispose explícito, sua redação permanece, sem ressuscitar o ator (:127–132). Stage continua exigindo B exata; nova C continua recusada enquanto B/predecessor não corresponderem ao contrato.

## Regressões escritas

O teste J2 positivo observa B já progredida para finalizing após SET com efeito/erro, exige zero escrita durante reconciliação e stage(B), e prova admissão de C somente após retirement de B. Negativos de identidade e revisão conservam o hold e recusam C sem escrita.

O teste de coordinator tem dois modos, erro após SET e readback falho. Cada modo realiza três ciclos consecutivos: cria novo handle sobre o MESMO journal, retoma B sem arquivo/IO, mantém A stale, progride apenas a fixture nominal e retira B antes da candidata seguinte. Ao fim exige a quarta candidata, zero Storage IO e somente a disponibilidade financeira originalmente esperada. A resposta finalize sintética agora usa o upload_id original de cada ciclo; não há observação de metadados transformada em prova.

Os três payloads R da V1 não mudaram. As guardas do issuer nominal, consumo único, financeiro sem pending/hold e fence depois dos awaits permanecem as previamente revistas. Nenhuma alteração em schema, Core financeiro, endpoint, prazo, política de montagem, exclusão de arquivo ou autoridade de clear/retire foi introduzida por este delta.

## Limites

Foi feita apenas leitura pública de manifesto, diff e fontes, com verificação local de hashes. Nenhum Node, teste, SQL, serviço, rede, runtime de aplicação ou dado privado foi executado/lido para este parecer. As novas regressões ainda precisam passar no SHA que transportar a união; não substituem ensaios reais de locks/Storage/Auth/RLS.
