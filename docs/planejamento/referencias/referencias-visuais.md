# Referências visuais — inventário e aplicação

**Conferência de 29/09/2026.** Este manifesto documenta as imagens disponíveis no diretório original e sua aplicação ao [protótipo vigente](../14-prototipo-interacoes.md). A decisão histórica D-002 menciona quatro imagens fornecidas; nesta conferência há **três arquivos locais**. A quarta não está disponível neste diretório e não foi reconstruída ou presumida.

| Arquivo disponível | Elementos observados | Aplicação no Segundo Cérebro |
|---|---|---|
| [layout-ref-01-glass-dashboard.jpg](layout-ref-01-glass-dashboard.jpg) | Dashboard financeiro claro; trilho escuro; grandes superfícies arredondadas; busca em pílula horizontal; acesso de conta à direita; listas com hierarquia título/contexto | Busca reconhecível em superfície suave, alinhada ao perfil; separação entre moldura e dados; ênfase escura reservada à próxima ação |
| [546c2fcb4ac63e7a6a5b9db1ae1bacee.jpg](546c2fcb4ac63e7a6a5b9db1ae1bacee.jpg) | Dashboard iDraft monocromático; vidro na moldura; trilho claro com item ativo escuro; composição assimétrica; busca, notificações e retrato fotográfico no topo direito | Foto circular em tons de cinza no canto direito, controles compactos, hierarquia por contraste e respiro, bordas discretas e identidade preservada |
| [a0135d6c0c2607d4cc65841255421401.jpg](a0135d6c0c2607d4cc65841255421401.jpg) | Estudo de navegação mobile com cinco itens e estado ativo destacado por ícone/rótulo | Barra inferior com quatro destinos e Mais; seleção explícita, safe-area e alcance das ações; a cor roxa e a geometria elevada da referência não foram adotadas como tokens |

A demanda de 29/09 acrescenta **Obsidian como referência de experiência**: notas que se ligam por `[[...]]`, backlinks e exploração em grafo. Não há screenshot do Obsidian nesta pasta; a referência orienta os comportamentos, sem copiar sua identidade visual.

## Decisões de aplicação

- Manter a família Geist escolhida em D-025, a marca “2”, neutros quentes e preto como acento; as fontes/cores dos exemplos não substituem decisões do projeto.
- Conservar bento no panorama Home; usar uma área ampla de escrita em Capturar, com metadados recolhidos e biblioteca subordinada.
- Concentrar busca, tema e perfil no cabeçalho, com alturas alinhadas e indicação clara da busca, sem estender o campo por toda a largura útil.
- Restringir vidro à moldura e usar superfície opaca no mobile; evitar fundos ilustrativos, rotação de cartões e decoração das referências onde competem com tarefas.
- Demonstrar relações por seleção, detalhes e lista acessível; não reduzir o grafo a ilustração decorativa.

## Imagem de perfil e fonte

O retrato ilustrativo do protótipo foi obtido da [imagem Unsplash photo-1500648767791-00dcc994a43e](https://images.unsplash.com/photo-1500648767791-00dcc994a43e), embutido como JPEG no HTML e exibido com filtro grayscale. Não é uma foto do usuário. O popover declara sua natureza ilustrativa.

A folha existente do Google Fonts carrega Geist 400/500/600 com `display=swap`, com fallback de sistema. As especificações e limitações de uso local/remoto estão no doc 14 §10. O planejamento de produção usa `next/font` self-hosted.

As imagens desta pasta são referências de direção, não evidências de validação da interface construída. Screenshots da versão atual devem ser registrados no doc 14 §11.
