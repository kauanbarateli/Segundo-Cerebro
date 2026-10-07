# ADR-0005 — IA permanece fora do aplicativo

Estado: adotado no planejamento por D-019.

## Decisão

O aplicativo não embarca chatbot, agentes ou chamadas a modelos de linguagem. Uma Plataforma externa poderá agir em nome do Usuário através da API autenticada do Núcleo quando esse Canal for implementado no roadmap.

## Motivo

IA embarcada ampliaria o escopo antes de o produto principal estar funcionando e criaria dependência de provedor. Núcleo independente, Entitlement e eventos já reservam os contratos para automações futuras sem comprometer o MVP.

## Consequências

O Núcleo permanece sem prompts, formatos de ferramentas ou adapters de provedores de IA. Uma eventual revisão desta decisão exige ticket e decisão explícita. O uso de agentes de desenvolvimento para construir o software não é uma Funcionalidade de IA no produto.

Origem: ADR-0005 de `kauanbarateli/novo-segundo-cerebro`, commit `20914ce61fefa268ab06fb52d6e0c27fad7e7143`; [arquitetura de produto](../planejamento/05-arquitetura-de-produto.md), §5.
