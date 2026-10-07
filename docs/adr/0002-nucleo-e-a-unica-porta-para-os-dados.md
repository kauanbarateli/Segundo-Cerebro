# ADR-0002 — Regras e escritas passam pelo Núcleo

Estado: adotado no planejamento por D-019; esclarecimento operacional de leitura na fundação de 07/10/2026.

## Decisão

`src/core/` contém regras e contratos TypeScript sem dependências de Next.js, React, HTTP ou SDKs de dados. Adapters implementam os contratos de infraestrutura. Server Actions e rotas validam entrada, autenticam o Usuário, aplicam rate-limit e Entitlement, e chamam os casos de uso do Núcleo com suas dependências.

Toda escrita de domínio atravessa esse fluxo; uma Plataforma externa futura usa a API autenticada, nunca o banco diretamente. Leituras de projeções podem partir de Server Components para adapters no servidor, conforme o doc 02 §3, desde que mantenham autenticação, isolamento e Entitlement e não implementem regras de domínio fora do Núcleo. Isso esclarece a expressão histórica “única porta para os dados” à luz do fluxo de leitura aprovado.

## Motivo

O legado concentrava regras em Server Actions e dificultava reutilizá-las em outro Canal. Extrair o Núcleo permite testar comportamento sem framework e preservar uma única decisão de negócio para web e integrações futuras. Fornecer service role a uma Plataforma externa destruiria o isolamento e contornaria Entitlement e emissão de eventos.

## Consequências

O projeto permanece um monolito modular. `dependency-cruiser` deve impedir imports de framework/SDK no Núcleo, de features em primitivas UI e entre features de módulos diferentes. Adapters de banco ficam restritos às fronteiras de servidor. O CI deve executar esse contrato; sua existência no código não é evidência de uma execução aprovada.

Erros de leitura precisam aparecer na fronteira de erro, não como listas vazias silenciosas. Escritas compostas e eventos devem usar a mesma transação. A API pública é evolução de roadmap, não requisito desta fundação.

Origem: ADR-0002 de `kauanbarateli/novo-segundo-cerebro`, commit `20914ce61fefa268ab06fb52d6e0c27fad7e7143`; [arquitetura proposta](../planejamento/02-arquitetura-proposta.md), §§2–3.
