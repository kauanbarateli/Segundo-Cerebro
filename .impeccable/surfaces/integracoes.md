# Integrações — layout Codex (D-033, #46)

Modo **Operate**, rota `/integracoes`. A página compõe pela rota (`app → feature`) a mesma gestão Google do Calendário (`CalendarAccounts`, query `agenda`, comandos e OAuth de `use-calendar-commands.ts`), sem importação entre features nem segundo estado de contas.

- Conectado: aviso de somente leitura, até duas contas, fontes por conta, Sincronizar com a janela guardada, Reconectar e Desconectar/Retomar desconexão.
- Demonstração: estado honesto, sem controle de OAuth, listando os calendários de exemplo.
- Sem permissão de Calendário: explica a situação e não consulta a agenda.
- Pendência: o retorno OAuth continua levando a `/calendario?notice=` mesmo quando a conexão começa aqui.

Relatório e desvios: `docs/implementation/layout-codex-ds21/README.md`.
