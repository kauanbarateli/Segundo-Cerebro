# Preferências de módulos e navegação imediata — 13/10/2026

Root e peer independente conciliaram o segundo critério original da #34: **reordenar módulos muda trilho/barra na hora; essencial não desligável, com recusa no servidor**. A alteração confirmada é aplicada à navegação sem recarregar o documento. Subir/Descer edita o rascunho do formulário; `Salvar módulos` confirma o comando. Não foi acrescentada uma exigência de preview antes de salvar.

## Comando confirmado e apresentação

`SettingsConnectedWorkspace.save` espera `executeDomainCommand`, depois adota o resultado e chama `applyAccountPreferences(settingsPreferences(value))`. O transporte valida `AccountSettings`, confirma o journal e invalida as leituras pertinentes antes de retornar. O provider mantém essa preferência na mesma policy lida por `WorkspaceShell`, que deriva trilho, quatro atalhos móveis e Mais. A gravação de módulos não chama `router.refresh`; a atualização do avatar é uma operação diferente.

A migration canônica de preferências recusa `visible=false` para Início, Capturar e Configurações com SQLSTATE `22023`, inclusive quando o cliente ignora o decoder do Core. O snapshot e o recibo decorrem da mesma transação dos eventos. Esta conciliação não altera migrations ou a política de entitlement.

## Prova e limites

Root leu o spec inteiro e os trechos originais de componente, provider, shell, comando e SQL; o peer conferiu independentemente o mesmo fluxo. O teste `ordem e visibilidade salvas mudam trilho e barra; SQL recusa desligar cada módulo essencial`, em [issue34-settings-sql.spec.ts](../../tests/e2e/issue34-settings-sql.spec.ts), exige a ordem do trilho logo após salvar e **antes** do reload. Confere depois persistência, barra e Mais em um contexto novo de 390 px, replay sem efeitos adicionais e três recusas por SDK direto, com `data=null` e ledger inalterado. O oracle também confere recibos, eventos e conta estrangeira intacta. O refresh da navegação é recusado explicitamente pela fixture.

Esse canal monta componentes e runtime/SDK originais com HTTP/Auth/SSR de fixture e SQL canônico PGlite descartável. Não é Next/GoTrue, escrita na conta pessoal, PostgreSQL hospedado ou aparelho físico. O guard Windows foi preservado: a tentativa local dessa suíte recusou antes dos cenários. Não foi declarado PASS local de navegador SQL.

O [CI próprio de 74907f9](https://github.com/kauanbarateli/Segundo-Cerebro/actions/runs/38423605289), job `115387064660`, concluiu suas 27 etapas com success por metadados. O workflow Ubuntu chama `npm run test:e2e`; a configuração inclui essa spec sem filtro e ela não usa skip/fixme/only. Este registro confirma o lote próprio, sem extrair uma contagem individual ou atribuir resultados antigos ao HEAD. O código examinado permanece igual ao blob dessa fonte.

A #34 permanece aberta para tema entre desktop/celular. Avatar, senha normal, painéis móveis e este critério têm provas próprias e limites separados; nenhuma ação de preferência pessoal foi executada para redigir este registro.
