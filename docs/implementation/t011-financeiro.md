# T-011 — Financeiro em cinco telas

## Entrega

`/financeiro` oferece Painel, Lançamentos, Contas, Categorias e Orçamentos sobre a query e os comandos financeiros do provider demonstrativo único. A rota mantém Suspense dentro de `WorkspacePage`; a query só monta na área permitida. Datas usam `app.today()` e dias civis do contrato, sem relógio ou IDs de seed na UI.

O brief `.impeccable/surfaces/financeiro.md` registra as referências de D-030, docs 05/06/09/13, DS2.1 e as decisões de adaptação. Orçamentos é a quinta aba observada no HTML, apesar de o resumo textual de T-011 enumerar quatro telas.

## Comportamento

- URL conserva `tab`, `month`, busca, tipo, conta, categoria, estado, página e ordenação. Parâmetros têm allowlist e defaults; mês explícito conserva o recorte ao compartilhar/recarregar. Busca usa a integração de History do Next sem viagem ao servidor por tecla. Voltar/avançar recompõe a tela.
- DataTable recebeu `state` e `onStateChange` opcionais. Seus consumidores anteriores permanecem não controlados. Busca, ordenação e paginação continuam num pipeline único; tabela e cartões usam exatamente as mesmas linhas.
- Painel e resumo da lista usam os mesmos filtros/busca antes de paginar e chamam `totaisFinanceiros`. Transferências não viram receita/despesa; planejados, pendentes, cancelados e excluídos não entram no realizado. Patrimônio/saldos são atuais; faturas a pagar usam vencimento, identificado separadamente da competência.
- Contas mostra saldos, dívida, limite/disponível e ciclo fechamento→vencimento. Fatura e seus cinco estados vêm do núcleo. Alterar o ciclo não reclassifica a competência histórica de uma compra.
- Categorias vêm do adapter e têm criação/edição. Orçamentos fazem upsert por categoria/mês, mostram consumo líquido de estornos e as faixas do núcleo. Nenhum gráfico usa biblioteca externa ou histórico inventado.
- Quatro Drawers usam parsers monetários centesimais, validação por campo, patch esparso, foco inicial/retorno e `client_id` estável no reenvio da mesma operação. Tipo de conta/categoria não muda na edição. Uma compra no cartão não envia um pagamento derivado antigo ao editar valor.
- Soft delete independente pede confirmação e oferece Desfazer/restaurar. Transferências e séries de exemplo não oferecem edição/exclusão isolada. Leitura com falha tem retry; formulário com falha conserva os campos.
- Máscara compartilhada com Início: `R$ ••••` tem comprimento fixo e não indica sinal. Gráficos/barras, percentuais e atributos ARIA monetários não expõem os valores ocultos. A ordenação da rosca vira alfabética sob máscara. Formulários monetários só montam depois de uma ação explícita de exibir; a preferência permanece fora da URL.

## Arquivos

Feature: `src/components/features/financeiro/{finance-workspace.tsx,finance-editors.tsx,finance-panels.tsx,finance-form.ts,finance-model.ts,finance-route.ts,finance.css}`. Rota: `src/app/(workspace)/financeiro/page.tsx`. Primitiva ampliada: `src/components/ui/data-table.tsx`.

Casos de uso, wrappers públicos, fachada/provider, preferência e fixtures foram integrados pela frente de Núcleo. Esta feature não cria adapter, armazenamento financeiro próprio, migração ou serviço externo.

## Validação

- **49 testes focados aprovados** em `TZ=UTC`, nos arquivos `finance-form.test.ts` e `finance-route.test.ts`. Cobrem também a ordem original na URL, cinco estados da fatura com datas manipuladas e coerência da massa comum.
- Typecheck completo com `--incremental false` e lint da feature, rota, DataTable e testes passaram na rodada final.
- Sete E2E preparados em `tests/e2e/finance.spec.ts`: CRUD dos quatro formulários em 320/1280; máscara/foco em 320/1280; URL/reload/layout; coerência/ciclo/transferências; erro de leitura e cenário vazio reais.
- Execução E2E, build, portões visuais e inspeção browser pertencem à rodada integrada do root; não foram executados por esta frente.

O cenário continua em memória e reinicia ao recarregar. Pagamento de fatura, transferências e séries operacionais permanecem no M3.
