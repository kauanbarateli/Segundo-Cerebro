# Páginas legais, inventário e preparação — publicação para revisão

Preparado em 18/10, fechamento local em 19/10/2026. Este pacote sucede a [entrega local](paginas-legais-validacao-20261018.md) `e76f323`. D-074 autorizou inventário e publicação; a decisão posterior **D-075 confirma Hobby e adia o deploy**. O resultado esperado é uma PR draft no GitHub, sem merge em `main`, mudança de plano ou lançamento.

## Entregas

- `/privacidade` e `/termos-de-servico`, links na landing e em Configurações, inicialmente implementadas e validadas na entrega local; versão textual 0.2 incorpora o inventário técnico.
- [Inventário por categoria de dados](inventario-retencao-transferencias-20261018.md): comportamento encontrado no código, cópias, descarte, operadores, fontes oficiais e lacunas operacionais. Contratos e destinos não observados não foram certificados.
- [Prompt completo para outro agente](../agents/prompt-retomada-issues-paralelas-8gb-20261018.md) e [mapa das issues/PRs](mapa-issues-paralelas-20261018.md): quatro trilhos lógicos, dois codificadores no máximo e um único processo pesado na máquina de 8 GB. O envio do prompt pelo mantenedor inicia a frente futura; a geração do arquivo não executa os tickets.
- [Guia HTML detalhado](../operations/guia-lancamento-e-configuracoes-20261018.html), com [fontes e limites](../operations/guia-lancamento-fontes-20261018.md): Google Cloud, Vercel, e-mail, Play/App Store, Meta, 14 dias de conteúdo e dez roteiros. Nenhuma conta, campanha ou submissão foi criada.

## Separação entre inventário e controles efetivos

Existe capacidade de manutenção para eventos com mais de 90 dias e limitadores inativos há mais de um dia, mas a migration não instala agendamento e não houve confirmação de uma rotina externa. Recibos, auditorias, soft delete, cópias de dados e backups têm tratamentos distintos. Não foi implementado purge nem atribuída expiração às contas atuais. Nenhum banco foi consultado ou alterado nesta rodada.

As páginas mantêm a indicação de revisão das informações operacionais/contratuais. O inventário técnico terminou; a regularidade de cada transferência, região efetiva, instrumentos aplicáveis às contas e rotação de backups continuam exigindo evidência. Resend, escolhido mas não ativado por esta entrega, declara armazenamento nos EUA e recusa cláusulas LGPD/ANPD específicas em sua FAQ. Avaliar mecanismo aplicável ou alternativa antes do envio real, sem alterar a escolha ou os MX silenciosamente.

Identificação privada do fornecedor não integra código, guia, Git, capturas ou issues. Nenhuma oferta comercial foi aberta. Checkout/onboarding e lojas conservam os tickets e condições de execução próprios.

## Publicação GitHub sem deployment automático

O primeiro push desta branch deve conter `vercel.json` com `git.deploymentEnabled` falso **apenas** para `codex/paginas-legais-e-checklist-20261018`. A [documentação Vercel](https://vercel.com/docs/project-configuration/git-configuration) admite regra por branch; branches não listadas seguem habilitadas por padrão e uma regra verdadeira correspondente pode prevalecer. Não há regra sobreposta neste arquivo.

Essa medida respeita a decisão de adiar deploy; não desativa CI, não oculta erros e não modifica o serviço em produção. Não é proteção genérica de futuras branches. **Não fazer merge:** `main` não está bloqueada por essa regra e o merge pode disparar produção. O proprietário futuro deve rever plano/destino, autorização, variáveis, callbacks e a retirada/adequação dessa regra antes da liberação. Não tratar PR draft como prevenção de deploy.

Consultas autenticadas continuam indisponíveis nesta rodada: Vercel retornou 403 para o escopo pessoal e Supabase recusou permissão. Não se alteraram credenciais nem se presumiu que reautenticar resolveria. A confirmação do plano Hobby foi humana. A configuração versionada pode ser conferida no GitHub; somente metadados do serviço poderiam certificar integralmente sua aplicação remota.

## Validação e retomada

Os resultados próprios desta revisão e as URLs da PR/CI são registrados no fechamento e na conversa da PR. A validação anterior conserva seu SHA e seus limites: 56 testes unitários, 17 E2E e build locais. Nenhum desses resultados equivale à aprovação de produção ou das lojas. Falhas hospedadas, se houver, permanecem visíveis; #36 é manutenção pós-MVP por decisão do mantenedor, sem desativar a auditoria.

Validação local desta revisão, Node 24 e processos pesados sequenciais:

| Check | Resultado próprio |
|---|---|
| `npm run typecheck` e `npm run lint` | PASS, zero warnings de lint. |
| `npm run build` com `APP_MODE=demo` | PASS; nenhuma API de negócio real ou migration. |
| Playwright, `legal-pages.spec.ts`, worker único | **2/2 PASS**, incluindo leitura sem JavaScript em 320 px, teclado/âncoras e landing → termos/privacidade → Configurações. |
| `check:client-auth` | PASS, 86 bundles públicos. |
| Guia HTML em Chromium | **6 combinações PASS**: 320/390/1440 px × claro/escuro; sem overflow da página, um h1, texto ≥16 px, navegação/checklists/disclosures funcionais e controles amostrados ≥44 px. Zero requisições externas. |
| Contraste do guia | Mínimo amostrado **5,954828:1**; seis capturas de viewport conferidas pela Root. Não é certificado de pares não medidos. |
| Revisão independente do inventário e textos | Sem bloqueador material no escopo de revisão do uso atual; limites contratuais preservados. |
| Links Markdown e proteção dos dados privados | Sem links locais quebrados nos dez documentos alterados; zero ocorrências de CPF/logradouro do modelo privado. Verificação em memória, sem imprimir valores. |
| Scanner de segredos | PASS, 1.661 arquivos versionáveis na conferência anterior à adição do brief final do guia; sem valores impressos. |
| Regra de autodeploy | JSON conferido: somente a branch legal está marcada como falsa, sem regra verdadeira sobreposta. Não equivale a leitura do estado interno da Vercel. |

A primeira tentativa de E2E no sandbox ficou sem progresso antes dos casos e foi interrompida; não recebeu PASS. A execução fora da restrição local de soquete passou 2/2. Não foi atribuída uma causa funcional ao app por esse comportamento. Artefatos próprios ficam ignorados em `work/legal-publication-20261018/`; fontes e limite editorial do guia permanecem no documento vinculado. Não houve testes em aparelhos ou lojas nesta revisão.

Ao retomar, conferir o HEAD da PR, as decisões D-065–D-075, o inventário e o mapa atual do tracker. Vincular pendências de retenção/transferências à #66 e os gates de abertura à #68, sem encerrar issues por documentação. Preservar PR #69 como histórico do planejamento e evitar integrar o mesmo delta duas vezes.
