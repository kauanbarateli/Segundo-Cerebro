# Labels de triagem

As skills usam estes cinco papéis canônicos. As strings abaixo são os nomes adotados no tracker `kauanbarateli/Segundo-Cerebro`.

| Papel / label | Significado |
|---|---|
| `needs-triage` | Precisa de avaliação do mantenedor |
| `needs-info` | Aguarda informação necessária para definir o trabalho |
| `ready-for-agent` | Tem escopo e aceite suficientes para execução por agente |
| `ready-for-human` | Requer atuação humana |
| `wontfix` | Decisão registrada de não implementar |

Inspecione `gh label list --repo kauanbarateli/Segundo-Cerebro` antes de criar labels ausentes. Este arquivo registra a convenção, não atesta a existência remota dos labels. Evite duplicar ou reescrever labels existentes sem necessidade.

Fases M0–M4 são milestones; as relações entre SPECs e tickets vêm do [doc 13](../planejamento/13-tickets.md). Labels de área podem ajudar a filtrar domínio e interface, mas não substituem dependências nem critérios de aceite.

Labels `wayfinder:map`, `wayfinder:research`, `wayfinder:prototype`, `wayfinder:grilling` e `wayfinder:task` são opcionais, exclusivos do fluxo `/wayfinder`; crie-os somente se esse fluxo for adotado.
