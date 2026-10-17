# Fontes públicas dos preparos — arquivo de retomada

Este diretório preserva os bytes dos preparos, controles e helpers públicos que antes existiam somente em `work/`. O `manifest.json` registra SHA-256, tamanho e posição relativa original. `.gitattributes` impede conversão de fim de linha neste arquivo histórico, necessária para recuperar os pins exatos.

**Não executar estes arquivos daqui, não ativar gates e não repetir operações encerradas.** Criação8084, verify8084, target inventory51495ec, ActiveClose8084 e inspeção combinada61d03 estão CLOSED. Seus resultados são próprios e não mudam com o código posterior da PR. Os templates possuem gates falsos/bindings nulos, mas não constituem autorização para uma nova operação.

Na retomada, ler o [handoff central](../../handoff-retomada-20261017.md), a issue da frente e o código atual. Quando necessário, recuperar somente o helper público revisado para seu caminho original, verificar seu hash e preparar **um arquivo novo** com o SHA/pins/contrato finais, QA e revisão própria. O helper de saída privada vinha do checkout de revisão PR39; sua cópia aqui permite recuperar o fonte sem depender daquele checkout. As importações e caminhos históricos dos leitores precisam ser revistos em um novo preparo.

As QA AST e RAM arquivadas descrevem os bytes históricos; podem ser recuperadas para um diretório público de trabalho com suas dependências corretas e executadas isoladamente. Não certificam ambiente hospedado, archive, banco ou restore. Não executar o corpo dos wrappers para testar um preparo.

Este pacote não contém perfis XML, `.env`, tokens, senha PostgreSQL, conteúdo de archive, SQL emitido, capturas/logs privados, operativos com gates ativos, kit do Cofre ou chave do backup. As referências a caminhos/ref/hash/key ID são metadados públicos da operação, sem o material de chave. Os arquivos privados permanecem no computador autorizado; obter segredos por procedimento privado, nunca pelo chat.
