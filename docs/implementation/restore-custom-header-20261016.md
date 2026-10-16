# Formato do archive observado — 16/10/2026

A nona inspeção, com propósito próprio e fontes revisadas, confirmou a tupla do mesmo database autenticado: **CUSTOM 1.16-0, intSize 4, offSize 8, GZIP**. O plano manteve 982 selecionados, 350 preservados e cinco segmentos. [Evidência e pins](evidence/restore-custom-header-native-20261016.json).

O comando explícito `restore-inspect-format` passa pelo dispatcher privado existente. O modo normal `restore-inspect` mantém seu output. A observação ocorre após autenticação total do archive, reconferência do ciphertext, hash/tamanho do database, EOF+close0 da listagem e planejamento; o finally zera os buffers e exige cleanup. Não consulta o destino, importa dados ou cunha capacidade.

O observador puro lê somente os 12 bytes fixos da versão pinada; não interpreta datas, strings, TOC completo ou dados. Recusa outra versão/tamanho/formato, compressão desconhecida, Proxy, memória compartilhada e buffer detached. A origem é garantida pelo ponto de chamada do inspector, e não por esse módulo isolado.

Root passou **33/33** em Node 24.19.0 com concorrência 1, lint4 e **20/20** controles sintéticos do dispatcher. O controle unitário ACL nativo preexistente foi explicitamente excluído desse lote. A operação real posterior concluiu com sucesso pelos helpers ACL do inspector, sem apagar o histórico da falha de fixture registrada no recorte B1. Peer independente identificou uma leitura de argv fora do try; Root a moveu para dentro do limite de erro e acrescentou getter canário/Proxy revogado. O delta final foi reconferido pelo peer antes da execução.

As fontes oficiais consultadas são PostgreSQL `REL_18_4`; os quatro hashes de C/header e o hash do pg_restore 18.4 estão na evidência. O formato antes recomendado no contrato A2 agora tem uma observação própria. Isso ainda não comprova definições, owners/ACLs, histórias, fechamento do subgrafo ou igualdade com o alvo.

Próximo recorte de Root: leitor limitado do TOC e extração completa das duas histórias em RAM, cross-check da enumeração nativa, produtor de baseline do alvo e ponto único de mint posterior a esses fatos. A2 continua comparador puro conforme o [contrato](contrato-a2-inventario-restore.md). Nenhuma migration nova.
