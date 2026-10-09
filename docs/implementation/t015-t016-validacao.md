# T-015/T-016 — validação integrada e retomada

Registro consolidado em 09/10/2026. A evidência aprovada abaixo foi obtida em **07/10/2026, após a versão final das fontes e antes da pausa**, e está preservada na retomada. Não representa nova execução em 09/10. O recorte reúne o [diário durável de envios](t015-journal.md), a [Atividade de Capturas/Tarefas](t016-atividade.md) e seu [contrato SQL](t016-activity-contract.md).

## Validação local confirmada em 07/10

| Verificação | Resultado preservado |
|---|---|
| `npm run check` | Exit 0; TypeScript, lint, testes, camadas, design system, pacote SQL, build e scanner de cliente aprovados |
| Vitest | 924 testes em 50 arquivos |
| Testes isolados de scripts | 35: cinco do pacote SQL Editor, um do scanner de cliente, dez de configuração Auth, dez do harness de concorrência e nove do harness Auth |
| Fronteiras de arquitetura | 206 módulos e 702 dependências, sem violação |
| Design system | 164 pares de contraste aprovados |
| Scanner de cliente | Verificação aprovada em 54 bundles públicos |
| Parser SQL local | 18 arquivos e corpos SQL/PLpgSQL aprovados; análise estática, sem executar SQL |
| Detector Impeccable | Zero achados |
| E2E de regressão em modo demo | 142 cenários aprovados, exit 0 |

Os testes isolados dos harnesses conferem os próprios scripts com testes locais; não são execução desses fluxos no serviço. Os 142 E2E exercitam a demonstração e constituem evidência distinta de um navegador conectado ao banco pessoal.

No recorte do diário, passaram **76 testes focados**: 34 do journal, 32 da aplicação conectada com ambiente injetado e dez do controller do Início. No recorte de Atividade, passaram **49 testes**: os 48 de contrato, gateway, API, reader e apresentação, mais um teste de fronteira acrescentado na integração. Essas contagens são recortes da suíte, não totais adicionais aos 924 testes. Ambientes injetados e doubles comprovam os contratos exercitados; não comprovam persistência, navegação ou limpeza no serviço real.

## Aplicação SQL real confirmada em 07/10

A migration canônica [`20261007223710_activity_page.sql`](../../supabase/migrations/20261007223710_activity_page.sql) foi aplicada de forma supervisionada no projeto pessoal autorizado pela [OP-009](decisoes-operacionais.md#op-009--conexão-pessoal-e-aplicação-supervisionada), com `success=true`. SHA-256 preservado: `565d2912e36142b1694e8728ce665d8bf92321466193bdab6621dd2256940a2c`. As quatro migrations anteriores ficaram intactas, sem reaplicação, reset ou seed.

As duas asserções de [catálogo](../../supabase/tests/activity-catalog.sql) e [comportamento](../../supabase/tests/activity-behavior.sql) passaram no banco real e terminaram em rollback. O ensaio percorreu 56 eventos sintéticos, com isolamento, restrições de acesso e paginação por microssegundos. A leitura posterior confirmou zero resíduos temporários e preservação da conta master. Esse registro é a confirmação de 07/10; não declara nova limpeza remota em 09/10.

Os tipos foram regenerados após a aplicação. O pacote SQL Editor passou a conter cinco migrations e oito scripts separados. A geração e a conferência desse pacote não executam SQL; CI, build e deploy também não aplicam schema. O [contrato de Atividade](t016-activity-contract.md#aplicação-e-verificação-supervisionadas) conserva os detalhes de aplicação e dos Advisors.

## Ensaio novo ainda não executado

O ensaio previsto para a versão final reúne **16 cenários de navegador conectado e 18 etapas via SDK**. Ele ainda não foi executado. Na retomada de 09/10, o MCP pessoal não estava anexado à sessão: a conexão genérica disponível recusou `get_project` e `execute_sql` para o projeto pessoal autorizado. A autorização da OP-009 permanece; falta acesso por uma conexão ao destino correto. BlackSheep e Sistema VOE continuam fora do escopo.

Registros e artefatos de ensaios anteriores existentes no diretório de trabalho não comprovam avanço deste recorte. Os resultados históricos de persistência permanecem no [relatório T-015](t015-persistencia.md); não são reapresentados como prova da versão final do diário e de Atividade. Não há neste registro novas screenshots conectadas, nova limpeza real nem CI do novo commit confirmado.

## Pendências de aceite

- **T-015:** executar o ensaio real do diário com reload completo, reabertura de aba, sincronização entre abas, logout e troca de conta; validar uso e atualização em aparelhos físicos; medir concorrência com sobreposição de transações no PostgreSQL; implementar e validar upload assinado com medição real de bytes e remoção de EXIF. O [documento de imagens](t015-uploads-preparation.md) continua apenas preparação: anexos conectados não foram liberados.
- **T-016:** executar o ensaio de Atividade no navegador conectado, com inspeção desktop/mobile em claro/escuro e fixtures reais; integrar Preferência real e provar por spy no adapter que blocos ocultos do Início não são consultados. O filtro de Entitlement e a asserção SQL de preferência oculta não substituem esse critério do Início.
- **Entrega integrada:** publicar o recorte validado com suas pendências e registrar o resultado efetivo do CI do commit quando houver execução confirmada no GitHub.

As issues [T-015 #22](https://github.com/kauanbarateli/Segundo-Cerebro/issues/22), [T-016 #23](https://github.com/kauanbarateli/Segundo-Cerebro/issues/23), [SPEC-03 #4](https://github.com/kauanbarateli/Segundo-Cerebro/issues/4) e [T-028 #35](https://github.com/kauanbarateli/Segundo-Cerebro/issues/35) permanecem abertas. A implementação e as validações acima permitem publicar o avanço com limites explícitos; não encerram esses critérios nem o marco M2.
