# Identificação do fornecedor — preparação privada

Orientação solicitada na Q9, em 18/10/2026. O nome público **Kauan Sousa Barateli**, pessoa física, e o e-mail de suporte já foram confirmados. O objetivo é completar a identificação exigível para a oferta sem colocar documentos pessoais em chat, issue ou commit.

## 1. Onde está o modelo

**Atualização:** o mantenedor informou o preenchimento e foi possível conferir a estrutura sem imprimir valores. O arquivo contém nome/tipo de pessoa compatíveis e campos de documento/endereço preenchidos; isso não é verificação de titularidade documental. A flag de publicação continua falsa. O endereço informado é pessoal, autorizado condicionalmente apenas quando necessário à identificação da oferta (D-073). Não é preciso preencher ou enviar novamente.

O arquivo privado está em:

```text
C:\Users\Kauan Sousa Barateli\Documents\Codex\SegundoCerebro-Private\legal\fornecedor-privado.json
```

Esse diretório fica fora do repositório e foi conferido como não pertencente a um checkout Git. Não é pasta OneDrive. Não copie o arquivo preenchido para o projeto, para pastas sincronizadas, anexos de issues ou capturas. O arquivo não é cifrado por ser JSON; mantenha-o sob a proteção da sua conta Windows e do disco. Se usar armazenamento seguro adicional, preserve a versão privada sem publicar seu conteúdo.

## 2. Como preencher

1. Abra o Explorador, cole o caminho acima na barra de endereço e abra o arquivo em um editor local de texto.
2. Preserve aspas, vírgulas e a estrutura JSON. Não precisa executar PowerShell, API ou SQL.
3. Confira `nome_publico` e `tipo_pessoa`. Estão preenchidos com os dados confirmados, sem substituir sua revisão.
4. Em `cpf_para_identificacao_publica`, informe somente o documento que identifica o fornecedor escolhido, quando estiver pronto para revisar a divulgação legal. Não informe senha, chave de API, cartão, token ou documento de outra pessoa.
5. Preencha `endereco_profissional_publicavel` com endereço real e adequado à identificação do fornecedor: logradouro, número, complemento quando houver, bairro, cidade, UF, CEP e país. Não invente endereço ou use um local de terceiro sem fundamento. A norma exige endereço físico do fornecedor, sem exigir especificamente escritório. O mantenedor escolheu manter o endereço pessoal privado e autorizou seu uso apenas se necessário à oferta. Não envie esse endereço no chat; a exibição futura será pública e precisa respeitar esse alcance.
6. Confira o e-mail público `suporte@segundocerebroapp.com.br`. Ele foi escolhido também para dados, privacidade, cancelamento e reembolso.
7. Deixe `autorizo_publicacao_destes_dados` como **false** enquanto revisar. Salvar o arquivo ou informar seu caminho não é autorização para publicar os valores.
8. Salve localmente. Não é necessário enviar o arquivo; informe apenas “modelo preenchido” ou o caminho privado, sem colar o conteúdo.

## 3. O que será conferido antes de divulgar

- Se o responsável e o documento correspondem à operação PF aprovada.
- Se o endereço é adequado e foi aprovado para divulgação; pendência não deve ser substituída por valor fictício.
- Quais campos precisam efetivamente aparecer na identificação da oferta e onde serão exibidos.
- Seu aceite explícito para os valores destinados à publicação e o canal de implantação. Um dado exigido na oferta pública deixa de ser confidencial quando é exibido: isso precisa ser compreendido antes da autorização.
- O modo de configuração que preserve esses dados fora do Git. O modelo não configura automaticamente a aplicação nem o hosting.

Não serão solicitadas cópias de RG, comprovante residencial ou senhas para redigir as páginas por padrão. A análise de exigências específicas deve usar canal privado e coleta mínima, quando realmente necessária.

## 4. Limite das páginas preparadas

A LGPD exige informação clara sobre o responsável, as finalidades e o contato. Para oferta eletrônica ao consumidor, o Decreto 7.962/2013 exige identificação e endereços do fornecedor. Uma página de termos não substitui essas informações, atendimento efetivo ou mecanismos de exercício de direitos.

As páginas desta entrega permanecem como versão em revisão até completar as lacunas pertinentes, inclusive retenções e tratamento internacional. Seu preenchimento não abre vendas, não configura Asaas, não faz deploy e não autoriza aplicar migrations. A hospedagem ficou adiada e o trabalho permanece local (D-072).

Fontes: [LGPD, especialmente art. 9º](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm), [Decreto 7.962/2013, especialmente art. 2º](https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2013/decreto/d7962.htm).
