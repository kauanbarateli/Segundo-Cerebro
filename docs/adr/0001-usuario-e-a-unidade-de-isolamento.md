# ADR-0001 — O Usuário é a unidade de isolamento

Estado: adotado no planejamento por D-019; preservado na fundação de 07/10/2026.

## Decisão

Todo dado pessoal pertence a exatamente um Usuário. As políticas de acesso isolam os dados pelo dono autenticado; não há workspace compartilhado, participação ou convite entre usuários no modelo do MVP.

## Motivo

O produto organiza agenda, hábitos, conhecimento, financeiro e segredos pessoais. A expressão histórica “multi-tenant” significava isolamento entre pessoas, não colaboração em uma conta. Implementar grupos e papéis por recurso agora acrescentaria complexidade sem caso de uso aprovado.

## Consequências

RLS e testes com dois usuários deverão provar o isolamento. Compartilhamento futuro exige reabrir esta decisão antes da implementação, introduzir o conceito de conta compartilhada e rever as políticas. Migrations ficam versionadas para aplicação manual, conforme a regra operacional vigente.

Origem: ADR-0001 de `kauanbarateli/novo-segundo-cerebro`, commit `20914ce61fefa268ab06fb52d6e0c27fad7e7143`; [registro de decisões](../planejamento/registro-de-decisoes.md), D-019.
