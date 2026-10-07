# Segundo Cérebro

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js 15 (App Router), React 19, TypeScript estrito e Tailwind CSS 4. O planejamento aprovado prevê Supabase em projeto novo e Vercel Hobby. A fundação T-001 inicia sem serviços externos ou variáveis de ambiente.

## Users

Kauan e pessoas próximas, em uso pessoal e sem cobrança. O produto deve acompanhar o trabalho no computador e o registro rápido no celular. Cada usuário é uma unidade isolada; não há workspace compartilhado.

## Product Purpose

Reunir informações pessoais em um sistema no qual capturar, conectar e reencontrar o que importa exige pouco esforço. O Início deve responder o que importa no dia, usando as mesmas informações dos módulos.

## Operating Context

Captura é a porta de entrada. Vínculos conectam informações sem duplicá-las. O Dia reúne tarefas, agenda, hábitos e dinheiro. A taxonomia aprovada inclui Início, Capturar, Conhecimento, Tarefas, Calendário, Drive, Projetos, Hábitos, Financeiro, Cofre, Configurações, Integrações e Admin.

## Capabilities and Constraints

- A construção segue M0 (fundação visual), M1 (funcional com exemplos), M2 (identidade e primeiras persistências), M3 (módulos persistentes) e M4 (fecho do MVP).
- T-001 entrega uma página provisória e a fundação de engenharia. Não oferece login, cadastro, dados pessoais, captura ou navegação de módulos.
- T-002 entrega tokens DS 2.1, página `/design-system` e tema claro/escuro/sistema persistido no navegador.
- T-003 oferece os componentes básicos compartilhados, com demonstrações locais de botões, campos, cartões, rótulos, marca e ícones.
- T-004 oferece navegação pelas 13 áreas, busca de atalhos e preferências demonstrativas; não fornece autenticação ou operações de domínio. Preferência de visibilidade não revoga acesso, enquanto o veto simulado bloqueia a apresentação da rota.
- T-006 acrescenta diálogos, painéis, avisos e controles de dados compartilhados, demonstrados em `/design-system`.
- O banco novo nasce sem migração de dados antigos. Alterações serão registradas em migrations para aplicação manual posterior, conforme instrução de 07/10/2026.
- Entitlement e preferência de exibição são conceitos distintos. O Plano Pessoal é implícito; não existe billing no MVP.
- O Cofre mantém criptografia ponta a ponta e kit de recuperação. O admin consulta metadados e agregados, nunca conteúdo pessoal.
- Wiki-links, backlinks e Relacionado pertencem ao MVP. Grafo visual de vizinhança pertence à fase 2; grafo global à fase 3.
- IA embutida, colaboração e escrita no Google Calendar estão fora do MVP.

## Brand Commitments

Preservar o nome Segundo Cérebro, a marca “2” com dois nós e a direção visual aprovada nos docs 04/14. Texto em português brasileiro, direto e calmo. A interface deve distinguir o que existe do que ainda está planejado, sem simular disponibilidade.

## Evidence on Hand

- `docs/planejamento/registro-de-decisoes.md`: decisões D-001–D-031 e atualizações operacionais.
- `docs/planejamento/05-arquitetura-de-produto.md`: mapa e jornadas do produto.
- `docs/planejamento/13-tickets.md`: seis specs e 28 tickets aprovados.
- `docs/planejamento/14-prototipo-interacoes.md` e `docs/prototipo/prototipo-segundo-cerebro.html`: demonstração visual de 29/09/2026; não comprovam persistência, autenticação ou integrações.
- Marca portada de `kauanbarateli/novo-segundo-cerebro`, `design-system/brand/assets/favicon.svg` e geometria do componente `Logotipo`.

## Product Principles

1. Capturar com facilidade, organizar depois, reencontrar com contexto.
2. Uma informação conserva sua identidade ao mudar de lugar ou ganhar vínculos.
3. A mesma pergunta deve produzir o mesmo resultado em todos os módulos.
4. Segurança e isolamento pertencem à fundação.
5. Cada entrega declara seus limites e deixa um estado utilizável.

## Accessibility & Inclusion

Piso responsivo de 320px; controles de pelo menos 44px; uso por teclado e leitor de tela; contraste AA; respeito às preferências de movimento e transparência. A ordem do DOM acompanha a prioridade do mobile, sem esconder transbordo global.

## Open Decisions

Não há questão de produto bloqueante. ClickUp permanece reversível até sua fase; a escala tipográfica segue a evidência vigente registrada no JSON de tokens. Recursos futuros não devem aparecer como operações disponíveis em T-001.
