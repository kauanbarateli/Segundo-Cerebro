# ADR-0004 — Toda escrita de domínio emite evento

Estado: adotado com a conciliação D-019 para o Cofre.

## Decisão

Toda escrita do Núcleo persiste um Evento de domínio na mesma transação da alteração, mesmo sem consumidor externo. O evento registra Usuário, instante, Canal e estados anterior/posterior permitidos. O orquestrador fornece o significado e o Canal; a persistência garante atomicidade.

**Cofre registra somente metadados de uma lista permitida**, como identificador do item, operação e instante. Nunca registra conteúdo secreto ou cifrado, senha mestra, material de chave, kit de recuperação ou campos livres que possam contê-los. A mesma restrição vale para logs, métricas e payloads de observabilidade.

## Motivo

A trilha de atividade já é requisito do produto. Gravar eventos desde o início preserva a origem das operações e cria um ponto de integração futuro, evitando reabrir todas as escritas para adicionar essa informação. Duplicar conteúdo sensível do Cofre na auditoria violaria seu propósito e sua retenção.

## Consequências

Uma escrita ou seu evento falhando deve reverter ambos. Eventos são append-only para o Usuário; ele consulta apenas os próprios registros. O Admin lê agregados sem conteúdo pessoal, e métricas usam enum fechado. A retenção prevista é de 90 dias, com rotina privilegiada explícita de limpeza; isso não dá ao Usuário permissão de apagar auditoria.

Os contratos, migrations e testes deverão provar atomicidade, isolamento e ausência de segredos. Registrar esta decisão não significa que a tabela, a rotina ou o consumidor já existem. A aplicação de migrations continua manual.

Origem: ADR-0004 de `kauanbarateli/novo-segundo-cerebro`, commit `20914ce61fefa268ab06fb52d6e0c27fad7e7143`; [D-019 e D-022](../planejamento/registro-de-decisoes.md); [arquitetura proposta](../planejamento/02-arquitetura-proposta.md), §2.3.
