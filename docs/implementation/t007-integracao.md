# T-007 — integração do núcleo

Revisão integrada de 07/10/2026. O núcleo é independente de React, Next.js, SDKs e banco. A memória de referência fornece uma fronteira comum para as próximas telas e para adapters persistentes posteriores.

- [Tempo, hábitos e dinheiro](t007-tempo-habitos.md): 85 casos, incluindo calendário civil, DST, pausas e precisão decimal.
- [Financeiro](t007-financeiro.md): 192 casos, preservando 147 testes originais e acrescentando o modelo fundido e regressões da revisão.
- [Contratos e memória](t007-contratos.md): 42 casos de isolamento, eventos atômicos, idempotência, concorrência, origem e falhas.

A integração executou **413 testes em UTC e os mesmos 413 em America/Sao_Paulo**: 319 do núcleo e 94 da fundação. `npm run test:timezones` usa processos com TZ explícito, inclusive no Windows; o CI executa o mesmo comando. Tipos, lint e contrato de camadas passaram; o portão percorreu 107 módulos e 220 dependências sem violação.

As entregas paralelas foram lidas antes da incorporação. A revisão encontrou e corrigiu lacunas de horário de verão, primeira semana de hábito, arredondamento financeiro, somas dependentes da ordem, datas impossíveis e perda de conteúdo em conversão. Cada relatório registra exemplos e limites. A interface existente permanece desacoplada desse núcleo até a composição compartilhada de M1.

O resultado remoto de build, detector e E2E será registrado na issue #14 após o push. Não há migrations nesta entrega nem conexão de banco. A suíte em memória não comprova RLS ou transações de um serviço externo.
