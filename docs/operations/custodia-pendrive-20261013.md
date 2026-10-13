# Custódia no pendrive: escolha sem senha — 13/10/2026

O responsável confirmou a unidade **D:** e pediu expressamente: **“Prossiga com a cópia sem a senha, é um Pendrive pessoal que mais ninguém tem acesso.”** Essa escolha substitui o roteiro KeePass/senha preparado anteriormente para esta operação.

A pasta nova `D:\SegundoCerebro-Custodia-20261013` foi criada sem listar, alterar, mover ou apagar arquivos existentes. O único destino da chave é um arquivo **novo**:

`D:\SegundoCerebro-Custodia-20261013\SC-20261012-001.key`

A cópia guarda somente a chave original, em base64, sem senha ou criptografia própria. Quem obtiver acesso ao pendrive poderá obter essa chave. Não é uma base KDBX nem uma cópia DPAPI dependente deste Windows. O archive do backup conserva sua criptografia original.

O procedimento revisado confere unidade/pasta, hash do snapshot do perfil original, ID **SC-20261012-001** e chave de 32 bytes; cria o arquivo com exclusividade e verifica seus bytes sem imprimi-los. Não usa clipboard, rede, archive, senhas de banco ou API keys. Arquivo existente causa recusa, sem sobrescrita ou exclusão.

**Execução confirmada:** o processo retornou `KEY_COPY_VERIFIED`, com 44 bytes/base64 no arquivo novo e readback igual. O perfil original foi preservado. Nenhuma senha, chave ou outro conteúdo privado foi publicado. A [evidência somente de metadados](../implementation/evidence/backup-key-usb-copy-20261013.json) mantém a cópia sem criptografia distinta de custódia cifrada, e a ejeção/guarda física ainda não foram confirmadas pelo responsável.

Depois da cópia confirmada, ejete o pendrive e guarde-o separado do computador e do disco onde estão os backups. Preserve o arquivo enquanto existirem archives desse ID. Não envie seu conteúdo pelo chat.

O [roteiro cifrado anterior](guardar-chave-backup-passo-a-passo-20261012.md) continua disponível como alternativa futura. A cópia sem senha não declara restore aprovado, recuperação após perda da máquina ensaiada ou custódia cifrada.
