# Orientações públicas da PWA

Routes: `/offline`, `/compartilhar`, instalação em `/configuracoes`. Mode: **Operate**. Extensão precisa do DS 2.1, conforme T-005 e doc 07; sem mudança de mundo visual.

Uma coluna de leitura, marca original, título operacional e texto que explica o estado antes da ação. Offline oferece tentar conectar; compartilhamento informa que nada foi salvo e aponta para Capturar/Início. Configurações recebe convite discreto de instalação, sem abertura automática de modal. Tipografia, cores, espaçamento e controles usam os tokens existentes, com safe areas e piso de 320px.

Os ícones e splash são renderizações reproduzíveis da geometria histórica da marca com cores do JSON de tokens. `design-system/pwa-assets.json` registra dimensões, hashes e gerador; não são imagens geradas por IA. A escolha claro/escuro da splash acompanha a preferência do sistema. O tema escolhido dentro do aplicativo assume após abertura; o manifest tem fundo inicial claro estável.

Verificação automatizada mede 18 rotas em três larguras e dois temas. Validação e limitações físicas estão em `docs/implementation/t005-pwa.md` e na issue #12.
