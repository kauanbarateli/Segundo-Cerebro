# Alterar a cadência sem reescrever o passado

**Aceita pelo mantenedor em 21/10/2026; implementação presente na candidata, release ainda não aceito.** Uma alteração de frequência de Hábito passa a valer no dia civil da alteração e preserva a expectativa anterior. Marcações realizadas não são apagadas; elegibilidade, análise, sequências e Início consultam a mesma vigência.

O comportamento anterior recalculava todo o histórico pela frequência atual. Preservar apenas marcações manteria números inconsistentes. A migração deve estabelecer uma linha de base com a frequência conhecida desde o início do hábito, sem inventar alterações antigas não registradas; novas vigências não podem se sobrepor. Duas edições no mesmo dia têm resultado determinístico com eventos preservados. Ver [contratos e exemplos](../planejamento/17-evolucao-prototipo/03-decisoes-e-contratos.md).

## Estado em 26/10/2026

Implementação encontrada em Core/adapters/UI/migration 021 na candidata ad24; #76 técnica preservada; cadência do onboarding é delta próprio em #63. Ver [diagnóstico atual](../planejamento/18-convergencia-prototipo-20261025/01-diagnostico.md). Esta atualização não modifica a decisão nem atesta produção.
