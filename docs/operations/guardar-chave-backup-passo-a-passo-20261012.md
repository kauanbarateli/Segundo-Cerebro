# Guardar a chave do backup — passo a passo específico

**Situação em 12/10/2026:** o responsável adiou a cópia externa porque não possui pendrive no momento. Conforme a [OP-021](../implementation/decisoes-operacionais.md#op-021--ensaio-com-custódia-externa-adiada), o ensaio pode prosseguir com a chave original no perfil DPAPI local. Este guia fica para execução posterior; a recuperação após perda da máquina/identidade Windows continua sem comprovação.

**Atualização de 13/10:** o pendrive está disponível e o responsável autorizou a custódia preservando seus dados. Depois pediu expressamente cópia sem senha; o [procedimento específico do pendrive](custodia-pendrive-20261013.md) e OP-024 prevalecem para essa operação. Este roteiro KeePass cifrado permanece como alternativa, sem substituir a chave original ou declarar a escolha sem senha como custódia cifrada.

**Objetivo:** guardar a chave já criada em uma base KeePass cifrada, num pendrive ou outro meio físico separado deste computador e do disco de backup. Você fará a cópia no seu terminal; o agente não executará o bloco nem lerá a área de transferência.

A chave do backup é diferente da senha PostgreSQL, da API key Supabase e da senha/kit do Cofre do aplicativo. **Não crie uma nova chave:** precisamos preservar a original, de ID **SC-20261012-001**. O perfil Restore reutiliza essa mesma chave. Copiar somente o XML DPAPI não atende à recuperação após perda da máquina/identidade Windows.

## 1. Preparar um lugar cifrado fora do computador

1. Conecte um pendrive ou disco externo que ficará guardado separado do computador e do disco onde estão os archives.
2. Se ainda não possui KeePass 2, obtenha-o na [página oficial de download](https://keepass.info/download.html). A edição portátil também está disponível; abra-a você mesmo.
3. No KeePass, escolha **File → New**. Salve **Recuperacao-Segundo-Cerebro.kdbx diretamente no pendrive**. Escolha a letra real da unidade pelo seletor; não use OneDrive, Downloads ou a pasta do repositório.
4. Defina e confirme uma senha mestra exclusiva e longa para essa base. Guarde-a de forma independente, por exemplo num registro físico protegido. Não use a senha do banco nem a mesma senha do aplicativo.
5. Para este procedimento, proteja a base pela senha mestra; deixe **Windows user account** desmarcado, para não depender desta identidade Windows. Não selecione um arquivo-chave que só exista neste computador.
6. Conclua a criação. As instruções de criar a base/entrada estão no [tutorial oficial](https://keepass.info/help/base/firststeps.html); a dependência do Windows é explicada no [guia de chave mestra](https://keepass.info/help/base/keys.html).

Se ainda não tem um meio externo, deixe esta etapa pendente e informe isso. Guardar a base só neste C: não conclui a custódia independente. Nada será formatado pelo agente.

## 2. Preparar a entrada antes de copiar a chave

1. No KeePass, selecione **Add Entry** / adicionar entrada.
2. Preencha **Title/Título:** `Segundo Cérebro — chave de backup SC-20261012-001`.
3. Preencha **User name/Usuário:** `SC-20261012-001`.
4. Em **Notes/Observações**, escreva: `Chave original do backup pessoal. Origem rishenjoikgmfubmnfiu. Criada em 12/10/2026. Manter enquanto existirem archives deste ID.`
5. Deixe a janela da entrada aberta. A chave irá no campo **Password/Senha**, e também no campo de confirmação quando presente. Esse campo armazena a chave do backup; ele não troca a senha mestra da base KeePass.

## 3. Desativar a persistência da área de transferência

Antes de copiar:

1. Abra **Configurações do Windows → Sistema → Área de transferência**.
2. Desative **Histórico da área de transferência** e **Sincronizar entre dispositivos**. Se os nomes variarem, use a busca de Configurações por “Área de transferência”.
3. Feche outros gerenciadores de clipboard que guardem histórico ou enviem conteúdo para outros dispositivos. Se uma política impedir desativar a persistência, pare e informe isso.
4. Use o console **PowerShell 7** privado, sem transcript. Não use o terminal gravado/compartilhado, VS Code para abrir o XML ou o chat para copiar a chave.

Essas opções e o histórico por Windows+V são descritos pela [Microsoft](https://support.microsoft.com/pt-BR/Windows/Apps/using-the-clipboard). Este procedimento não altera políticas nem configurações do VOE automaticamente.

## 4. Copiar somente a chave original para o KeePass

No console PowerShell 7 que já está aberto, copie **todo** o bloco abaixo e pressione Enter. Ele é completo: não depende de ter executado os comandos anteriores do outro documento.

O código lê um snapshot do perfil cifrado, confere o hash/ID, abre o DPAPI sob sua identidade e copia somente a chave para o clipboard local. Não imprime chave ou senhas, não abre rede e não faz backup/restore. Os buffers e SecureStrings são descartados ao final; strings temporárias do .NET não têm promessa de apagamento físico.

```powershell
$scCustodyPath = 'C:\Users\Kauan Sousa Barateli\SegundoCerebro-Operations\profiles\backup-source-pg18-20261012-v1.xml'
$scCustodyExpected = '5d9c83138241dbbf3ea94722e46bf4a67ea52b2ef22d72f7f05055bbc214f32c'
$scCustodyBytes = $null
$scCustodyProfile = $null
$scCustodyPointer = [IntPtr]::Zero
try {
    $scCustodyBytes = [IO.File]::ReadAllBytes($scCustodyPath)
    $scCustodyHasher = [Security.Cryptography.SHA256]::Create()
    try {
        $scCustodyHash = [BitConverter]::ToString(
            $scCustodyHasher.ComputeHash($scCustodyBytes)
        ).Replace('-', '').ToLowerInvariant()
    } finally {
        $scCustodyHasher.Dispose()
    }
    if ($scCustodyHash -cne $scCustodyExpected) {
        throw 'PROFILE_CHANGED'
    }
    $scCustodyXml = [Text.UTF8Encoding]::new($false, $true).GetString($scCustodyBytes)
    $scCustodyProfile = [Management.Automation.PSSerializer]::Deserialize($scCustodyXml)
    if ($scCustodyProfile.SC_BACKUP_KEY_ID -cne 'SC-20261012-001' -or
        $scCustodyProfile.SC_BACKUP_ENCRYPTION_KEY -isnot [Security.SecureString]) {
        throw 'KEY_REFUSED'
    }
    $scCustodyPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR(
        $scCustodyProfile.SC_BACKUP_ENCRYPTION_KEY
    )
    Set-Clipboard -Value (
        [Runtime.InteropServices.Marshal]::PtrToStringBSTR($scCustodyPointer)
    )
    Write-Host 'Chave copiada. Cole SOMENTE no campo Senha da entrada KeePass.'
} finally {
    if ($scCustodyPointer -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($scCustodyPointer)
    }
    if ($scCustodyProfile -is [Collections.IDictionary]) {
        foreach ($scCustodyValue in $scCustodyProfile.Values) {
            if ($scCustodyValue -is [Security.SecureString]) {
                $scCustodyValue.Dispose()
            }
        }
        $scCustodyProfile.Clear()
    }
    if ($scCustodyBytes) {
        [Array]::Clear($scCustodyBytes, 0, $scCustodyBytes.Length)
    }
    $scCustodyXml = $null
}
```

Se aparecer `PROFILE_CHANGED`, `KEY_REFUSED` ou qualquer erro, **pare**. Informe somente o código, sem imprimir o objeto do perfil ou seus campos. Não tente extrair a chave de outro XML.

Depois da mensagem “Chave copiada”:

1. Vá para a janela da entrada KeePass.
2. No campo **Password/Senha**, use Ctrl+A e Ctrl+V para substituir qualquer senha gerada automaticamente pela chave original.
3. Faça o mesmo no campo **Repeat/Confirmar**, se houver.
4. Confirme a entrada e pressione **Ctrl+S** para salvar a base no pendrive.
5. Volte ao PowerShell e execute:

```powershell
Set-Clipboard -Value ''
```

Não cole a chave em bloco de notas, navegador, OneDrive ou conversa. Não imprima `$scCustodyProfile` ou o valor da chave.

## 5. Conferir que a cópia pode ser recuperada

1. Feche a base KeePass.
2. Abra novamente o arquivo `Recuperacao-Segundo-Cerebro.kdbx` pelo pendrive.
3. Digite a senha mestra escolhida para a base.
4. Confirme que a entrada **SC-20261012-001** está lá. Confira você mesmo que o campo Password contém a chave que acabou de guardar; não compartilhe captura de tela ou conteúdo.
5. Feche o KeePass, ejete o pendrive e guarde-o separado do computador/disco dos backups. Mantenha a senha mestra acessível a você por um meio independente.
6. Preserve essa chave/ID enquanto existirem backups correspondentes; uma rotação futura terá outro ID.

**Para confirmar pelo chat, basta escrever:** “Chave SC-20261012-001 guardada em base cifrada no meio externo; consegui reabrir a base.”

Não envie chave, senha mestra, senha PostgreSQL, API key, XML ou arquivo KDBX. Essa confirmação conclui a preparação da custódia; o ensaio real ainda precisa de janela sem escritores, criação/verificação do archive e restore no alvo vazio.
