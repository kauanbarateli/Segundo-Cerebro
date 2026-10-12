# Revisão da PR #38 — Frente A

Base da comparação: `114332344b80c8d1f95a0b60ce0767dcfcca2961`; merge-base `1f1f568010031f4cd59bd7ad39c783766e4c2071`; head recebido `22f9991f0e131c5703fb81bc5d184f740fb19e1b`. Revisão pelos dois eixos da skill local Code Review, em agentes independentes, seguida de revisão da raiz. Escopo: [handoff](handoff-duas-frentes-mvp-20261012.md) e [entrega de A](frente-a-entrega.md). Drive continua fora do MVP.

## Standards

Não foram encontrados bloqueadores de arquitetura, tokens, isolamento ou alvos introduzidos no diff. A composição original dos componentes e providers foi preservada; fixtures usam dados sintéticos e não substituem provas de serviços reais.

- P2: o retorno de foco em Sessões estava incompleto quando a nova tentativa recebia 401/409. O botão era substituído pelo link e seu ref ficava nulo. Corrigido na revisão: o foco retorna ao controle disponível, preservando o foco que a pessoa moveu para outro elemento.
- P3, julgamento não bloqueante: há duplicação pequena de montagem PostCSS/fontes/veto de URLs nas duas ferramentas de fixtures. As portas distintas permanecem explícitas; esta revisão não cria uma abstração adicional.

## Spec

O Calendário montado exercita o workspace, providers, cliente conectado e journal originais. As portas HTTP são declaradamente sintéticas. Três dias, término exclusivo, fuso, navegação e refresh estão cobertos. A extração do helper de Configurações preserva o percurso SQL e o guard Linux.

- A-02 exige teclado/foco: acrescentadas provas de erro 503 → nova tentativa por teclado → 401/409 e de preservação do foco movido para outro controle. O defeito foi reproduzido antes da correção.
- A-03 limita correções a achados observados: a raiz aprova explicitamente retirar as descrições genéricas da moldura. A duplicidade em Capturar e a menção a demonstração em conta conectada foram identificadas; os subtítulos factuais próprios dos módulos permanecem. O recorte segue o contexto factual do doc 14, sem acrescentar funcionalidade.

Resultado: nenhum bloqueador residual de Standards ou Spec após o ajuste de foco. A duplicação descrita em Standards é um julgamento de manutenção, não violação obrigatória.

## Validação da revisão

- RED: dois controles novos falharam no foco de “Entrar novamente”; o controle de foco movido passou.
- GREEN do autor: três controles passaram; TypeScript global, lint dos dois arquivos e diffcheck passaram.
- Raiz: as duas novas suites completas passaram, **19/19**, em Chromium, com duas workers e sem retries. Configuração privada mantém as portas sintéticas e não inicia servidor Next nem conecta a serviços reais.
- A primeira execução da raiz falhou antes dos casos porque o sandbox não encontrou o Chromium no seu cache. A mesma suíte foi executada no perfil real, usando o navegador já instalado; não houve instalação ou ajuste de guards.
- Peer independente leu os dois arquivos finais e os três controles: sem achados, com hashes conferidos antes e depois.

Arquivos da correção testada:

| Arquivo | Bytes | SHA-256 |
| --- | ---: | --- |
| `src/components/features/configuracoes/own-sessions-section.tsx` | 6118 | `a79dfe8aa987af9733bdc7c82cdf4ab1c46503cf973c0d8cb0882be731584e0c` |
| `tests/e2e/settings-sessions-matrix.spec.ts` | 19309 | `fd3023f28c07b4d1704a69efee4350cdb964499915805a08866f42bf96d0dc2c` |

O [CI da PR recebida](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/38307545669) concluiu com sucesso no SHA 22f9991. Esses metadados não certificam a correção posterior, contagens individuais ou aceites externos. O novo SHA deve ter seus próprios checks conferidos antes da incorporação.

Admin navegador e recuperação por e-mail apresentaram falhas no CI recebido, assim como na base 1143323. Isso permanece pendência de B; esta revisão não declara causa comum, PASS desses casos ou encerramento do MVP. OAuth/revogação, persistência em aparelhos, instalação física, leitor de tela e backup/restore mantêm seus canais de validação no handoff.
