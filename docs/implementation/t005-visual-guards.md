# T-005 — portões visuais e auditoria técnica

Data: 07/10/2026. Escopo: doc 08 §§1/6, doc 14 §2 e T-005. Esta auditoria aplica a referência `audit.md` da Impeccable 4.4.0 local; o detector executável é o engine **0.1.6**. São versões de artefatos diferentes.

## Implementação

`tests/e2e/visual-guards.spec.ts` percorre as treze rotas de `WORKSPACE_ROUTES`, `/ajuda`, `/sair`, `/design-system`, `/offline` e `/compartilhar`: **18 rotas × 320/390/768px × claro/escuro = 108 observações de página**. O privilégio Admin é fixture explícita, restrita ao armazenamento da demonstração. Não cria contas nem dados persistentes.

Cada observação aplica os três portões ao DOM renderizado, após carregar fonte e sair do estado de preparação:

1. **Transbordo:** compara a largura do documento e os limites dos elementos com a viewport. O relatório identifica o seletor CSS e as dimensões dos culpados. Descendentes de um contêiner de rolagem/recorte horizontal que cabe na viewport não são tratados como transbordo da página. `overflow-x: hidden/clip` em html/body reprova; bloqueio de rolagem durante um diálogo modal aberto é a exceção funcional.
2. **Alvo mínimo:** examina links, botões, campos, summary, controles ARIA e elementos focalizáveis renderizados, inclusive abaixo da dobra. O piso é 44 × 44 CSS px. Elementos sem caixa, ocultos por ancestral, diálogos fechados, popovers fechados e conteúdo inerte ficam fora. O skip-link estacionado acima da tela é medido quando focalizado pelos testes de teclado existentes. Um `::before`/`::after` absoluto que participa do hit test pode ampliar o alvo; o cálculo considera dimensões, translação e recorte. Alvos ampliados que invadem outro controle são denunciados. Pseudo-elementos decorativos com `pointer-events:none` não contam.
3. **Campo legível:** input textual, select, textarea e contenteditable visíveis usam fonte computada de pelo menos 16px. Checkbox/radio não são campos de digitação e seguem o portão de alvo.

Busca, perfil, Mais e as três variantes de superfície (diálogo, drawer, painel inferior) são também inspecionados abertos em 320/768px. A suíte existente continua responsável por Tab, foco inicial/retorno, armadilha de foco aninhada, Escape, skip-link e temas. Não se usa CSS zoom como substituto de zoom real do navegador.

Todos os relatórios, inclusive em falha, são anexados ao resultado Playwright como `visual-guards.json`; o artefato do CI reúne esses resultados e os traces. São 11 testes novos: seis varreduras, duas varreduras de superfícies abertas e três provas negativas.

## Provas contra falso verde

As falhas de demonstração são criadas apenas por `page.setContent`/`page.evaluate` no navegador de teste, nunca em `src` ou em commits sabotados:

- Uma div `#visual-overflow-probe` mais larga que a viewport reprova com esse seletor; removê-la recupera o estado válido. Uma área com rolagem interna permanece permitida.
- Um botão 32 × 32 e um campo com fonte 15px são apontados. Um botão visual 32 × 32 com pseudo-alvo real 44 × 44 é aceito; elementos display:none e diálogos fechados não entram na contagem.
- Um pseudo-alvo cortado por ancestral continua reprovado. A ocultação global de overflow também é identificada, evitando mascarar a regressão.

O helper usa tolerância de 0,01px apenas para ruído de ponto flutuante nos limites e caixas, sem trocar os tokens de piso do produto. A medida é em CSS pixels; não comprova ergonomia em aparelho físico ou o comportamento de Safari.

## Detector fixado e CI

`npm run check:impeccable` chama `scripts/check-impeccable.mjs`, que:

- exige `scripts/VERSION` igual a 0.1.6 e confirma a resposta `impeccable-engine 0.1.6`;
- usa o launcher espelhado existente: `.cmd` no Windows e `sh` com o script local no Linux;
- prefere o cache versionado em `IMPECCABLE_HOME`; o padrão local fica em `work/impeccable-cache`, e o CI usa `runner.temp`;
- executa `detect src --json`, preservando todas as regras e todos os advisories;
- reprova achados primários (exit 2), falha de análise/download/versão ou JSON inválido; não converte erro operacional em aprovação;
- grava `work/impeccable-reports/detect-src.json`. O launcher existente verifica SHA-256 ao baixar; nenhum mirror ou download paralelo foi adicionado.

O CI usa `ubuntu-24.04`, Node 24 de `.nvmrc`, cache do engine por sistema/arquitetura/VERSION e os testes E2E completos. Releases consultadas pela API oficial do GitHub em 07/10/2026 e manifests conferidos com runtime `node24`:

| Action adotada | Release oficial observada | Evidência do runtime |
|---|---|---|
| `actions/checkout@v7` | [v7.0.1](https://github.com/actions/checkout/releases/tag/v7.0.1) | [action.yml v7](https://github.com/actions/checkout/blob/v7/action.yml) |
| `actions/setup-node@v7` | [v7.0.0](https://github.com/actions/setup-node/releases/tag/v7.0.0) | [action.yml v7](https://github.com/actions/setup-node/blob/v7/action.yml) |
| `actions/upload-artifact@v7` | [v7.0.1](https://github.com/actions/upload-artifact/releases/tag/v7.0.1) | [action.yml v7](https://github.com/actions/upload-artifact/blob/v7/action.yml) |
| `actions/cache@v6` | [v6.1.0](https://github.com/actions/cache/releases/tag/v6.1.0) | [action.yml v6](https://github.com/actions/cache/blob/v6/action.yml) |

## Auditoria Impeccable: evidência e limites

**Integridade da implementação: aprovada na análise estática executada.** `detect src --json` retornou `[]` com engine 0.1.6, inclusive através do novo wrapper Windows. Nenhuma regra foi suprimida e nenhuma skill espelhada foi alterada. O detector estático não substitui inspeção visual ou leitura assistiva.

| Dimensão | Nota / 4 | Evidência e limite |
|---|---:|---|
| Acessibilidade | 3 | Componentes compartilham foco, nomes e campos; suíte T-004/T-006 validou navegação e superfícies. Leitor de tela e aparelhos reais ainda não exercitados. |
| Performance | 2 | Fonte local, avatar local e ausência de animação de entrada; análise de código não inclui perfil de CPU, rede ou orçamento de bundle. |
| Responsividade | 3 | 108 observações em 320/390/768px e superfícies abertas aprovadas; capturas PWA em 390/1280px inspecionadas. Dispositivos físicos ainda pendentes. |
| Tema | 4 | Fonte única de tokens e 164 pares de contraste validados; troca de tema e persistência já cobertas. A nota se refere aos contratos existentes, não a combinações arbitrárias. |
| Integridade | 4 | Catálogo único de rotas, primitivas compartilhadas, demo explícita e detector sem achados primários ou advisories nesta execução. |
| **Total** | **16/20** | **Bom — auditoria de engenharia, não certificação WCAG.** |

Na execução integrada, o portão encontrou o link Raios do catálogo com largura de 40,45px. O alvo recebeu o mínimo de 44px e a suíte completa confirmou a correção. Os casos negativos acima são fixtures. Limitações de cobertura não são declaradas como falhas de produto sem evidência.

Verificação integrada local: typecheck, lint, camadas, contraste, detector Impeccable e build aprovados; **94 testes unitários/contratos da fundação e 74 E2E passaram**, incluindo os 11 novos portões visuais e quatro testes PWA. As capturas de orientação offline e compartilhamento foram inspecionadas em claro/escuro e desktop/mobile, em `evidence/t005/`. O resultado do workflow Linux será registrado na issue após o push.

Instalação física Android/iOS, Safari, VoiceOver/TalkBack, zoom real e desempenho em aparelho continuam validações manuais. Os portões aqui não afirmam comprovar instalação PWA ou cache offline, que têm testes próprios. Não há migrations, acesso a banco, dados pessoais ou execução de autenticação nesta entrega.
