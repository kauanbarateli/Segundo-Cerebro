# T-004 e T-006 — navegação e componentes de operação

Implementação em 07/10/2026 conforme D-030, doc 14, DS 2.1, ADR-0003 e os tickets #11/#13. Três agentes dividiram shell, superfícies/foco e dados. O integrador revisou código e critérios, executou os testes e inspecionou os renders em desktop/mobile nos dois temas antes do envio.

## Entregue

- Catálogo único das 13 áreas, rotas com títulos, skip-link, trilho recolhível, cabeçalho, busca de atalhos por botão e Ctrl/Cmd+K, perfil ilustrativo e navegação inferior com Mais/Ajuda/Sair.
- Entitlement separado de Preferência. Esconder um módulo preserva sua rota; veto de acesso impede sua apresentação. Admin exige privilégio demonstrativo explícito. Configurações mantém os controles de simulação identificados; não existe autenticação ou autorização de servidor nesta entrega.
- Diálogo nativo compartilhado por confirmação, drawer e bottom sheet. Pilha de foco, bordas Tab/Shift+Tab, Escape no topo, restauração do acionador, trava de rolagem e loading/erro de confirmação.
- Avisos dispensáveis, pausa por hover/foco/aba oculta e ação Desfazer persistente por padrão. Tooltip usa a camada superior e permanece dentro do diálogo ancestral quando houver modalidade.
- DataTable e cartões renderizam o mesmo array processado, com busca sem acentos, ordenação estável e paginação. Switch, resumo acessível de gráfico, progresso, seção recolhível e navegação interna completam a galeria.

## Revisão e validação

`npm run check` passou: tipos, lint, **92 testes de unidade/contrato**, camadas (70 módulos/147 dependências), tokens (164 pares de contraste) e build de produção sem credenciais. **59 testes de navegador** passaram na rodada final integrada. O resultado do CI remoto consta na atualização de entrega das duas issues; execução local não é apresentada como sucesso remoto.

O detector da skill local Impeccable (engine 0.1.6) retornou `[]` em `detect src --json`. A instalação usou cache externo ao repositório, com SHA-256 verificado pelo launcher. A mudança de largura animada do progresso foi substituída por `transform`.

Correções encontradas na revisão: foco nativo podia escapar para o documento ao atingir a borda; tooltip fora do diálogo sofria inertness; datas e booleanos eram pesquisados em formato diferente do texto visível; o rótulo Calendário perdia uma letra para a segunda linha em 320px. Os respectivos contratos e/ou medidas foram corrigidos antes da publicação.

O navegador verifica todas as rotas em 320/768/1280px, a diferença exata de 162px ao recolher, preferências/vetos/Admin, storage indisponível, teclado, temas, diálogos aninhados, drawer de 560px/tela cheia, avisos, dados e recuperação de estados. As capturas estão no artefato `browser-evidence` do CI; amostras selecionadas acompanham este registro em `evidence/t004-t006/`.

## Limites e sequência

Nenhum banco, migration ou serviço externo foi alterado. Foto de perfil é a imagem ilustrativa já embutida no protótipo aprovado; sua origem está no brief do shell. O resolvedor em memória não deve ser reutilizado como mecanismo de segurança de produção. O provider de demonstração será substituído na etapa de identidade.

PWA, instalação em aparelhos reais, busca no conteúdo e módulos funcionais continuam nos tickets correspondentes. O próximo núcleo funcional começa em T-007; o CI visual/PWA continua em T-005.
