# Alterar a cadência sem reescrever o passado

**Aceita pelo mantenedor em 21/10/2026; implementação pendente.** Uma alteração de frequência de Hábito passa a valer no dia civil da alteração e preserva a expectativa anterior. Marcações realizadas não são apagadas; elegibilidade, análise, sequências e Início consultam a mesma vigência.

O comportamento anterior recalculava todo o histórico pela frequência atual. Preservar apenas marcações manteria números inconsistentes. A migração deve estabelecer uma linha de base com a frequência conhecida desde o início do hábito, sem inventar alterações antigas não registradas; novas vigências não podem se sobrepor. Duas edições no mesmo dia têm resultado determinístico com eventos preservados. Ver [contratos e exemplos](../planejamento/17-evolucao-prototipo/03-decisoes-e-contratos.md).
