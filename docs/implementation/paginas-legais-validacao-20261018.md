# Páginas legais e checklist — entrega local de 18/10/2026

## Entrega e escopo

Branch local `codex/paginas-legais-e-checklist-20261018`, derivada da documentação aprovada em `3433c49b9e0e59546ed564222f3c3de814e71098`. O PR documental #69 permanece sem alterações por esta entrega. D-065 autoriza apenas páginas de privacidade/termos e seus links; D-072 adia hospedagem e mantém tudo local, sem push ou deploy.

**Implementado:** `/privacidade` e `/termos-de-servico` públicas, renderizadas no servidor, com índice, versão, tema, contato e navegação entre documentos; links no rodapé de `/conheca` e em Configurações demo/conectadas, inclusive loading/erro do perfil. Middleware preserva CSP/nonce/no-store e não exige sessão nessas duas rotas. Não houve alteração dos capítulos/animação/CTA.

**Conteúdo preparado:** 14 seções de privacidade e 13 de termos, com fontes oficiais brasileiras, Google Limited Use, tratamento específico do Cofre, inventário de armazenamento local, direitos, cancelamento/arrependimento e separação explícita da contratação futura. A [matriz legal e suas fontes](paginas-legais-fontes-20261018.md) registra os limites. As páginas são versões em revisão, não certificação ou oferta aberta.

**Documentado:** D-065–D-073, [respostas do checklist](../planejamento/16-checkout-asaas-onboarding/08-respostas-e-pendencias-checklist.md), [preparação privada da identificação](../planejamento/16-checkout-asaas-onboarding/09-identificacao-privada-do-fornecedor.md) e [reconciliação visual](paginas-legais-documentacao-visual-20261018.md). Confirmados nome PF, público 18+, caixa de suporte/privacidade testada pelo mantenedor, Resend escolhido para notificações, atendimento 9h–18h e começo local dos testes futuros.

## Validação executada

Node 24, processos sequenciais. Nenhuma API autenticada de negócio, banco real, pagamento ou alteração de serviço foi usada nos testes abaixo.

| Verificação | Resultado |
|---|---|
| `npm run typecheck` | PASS após corrigir sombreamento do identificador `document` no novo E2E. |
| `npm run lint` | PASS, zero warnings. |
| `npm run check:layers` | PASS: 392 módulos, 1.497 dependências, sem violações. |
| `npm run check:design-system` | PASS: 164 pares de contraste e integridade dos tokens/marca. |
| Vitest: middleware Auth, CSP, tema e regras de Configurações | 4 arquivos, **56 testes PASS**. |
| `npm run build`, `APP_MODE=demo` | PASS; novas rotas com renderização no servidor. Não prova produção ou CI hospedado. |
| Playwright: `legal-pages.spec.ts` + `settings-sessions-matrix.spec.ts` | **17 cenários PASS**. Origem local isolada; matriz conectada usa respostas sintéticas, não Supabase. |
| Matriz de leitura | Duas páginas × 320/390/1440 px × claro/escuro = **12 combinações**, um h1, sem transbordamento horizontal, prosa 16 px, controles ≥44 px. |
| Contraste real medido | Mínimo textual observado **5,954828:1**, entre os elementos inspecionados sobre os fundos reais. Não generalizar a pares/estados não medidos. |
| Falha de Auth | Em processo local `APP_MODE=supabase`, com configuração propositalmente ausente e observabilidade externa desativada: páginas legais **200**, `/configuracoes` **503**. Documento público não abriu a área privada. |
| `git diff --check` e links Markdown locais | PASS. |
| Scanner de segredos | PASS; sem valores impressos. |
| `npm run check:client-auth` | PASS: 86 bundles públicos, sem assinaturas de SDK, tokens ou segredos do servidor. |
| Verificação de dados privados nos arquivos alterados | Zero ocorrências do CPF ou logradouro do arquivo privado; apenas resultado booleano/contagem foi emitido. |

O teste de leitura também executou sem JavaScript, com teclado/skip link/âncoras e largura de 320 px. O percurso landing → privacidade → termos → Configurações e a troca de tema passaram. Não se testaram aparelhos físicos nem sessões reais nesta rodada.

Vitest encontrou inicialmente restrição de rename no diretório temporário do sandbox; usar `TEMP`/`TMP` em `work/legal-20261018/temp` resolveu. O primeiro build teve `EPERM` ao criar uma pasta em `.next`; a execução local autorizada fora dessa restrição passou. Isso não foi ocultado como PASS da tentativa inicial nem motivou mudança da aplicação.

## Revisão independente

- Revisão textual das minutas: sem bloqueador material para revisão local; identificação/retencões/transferências continuam pendentes para a versão definitiva.
- Revisão visual fresca: **disposition: ship**, no escopo de oito capturas de viewport e código; sem material fixes. Agente genérico substituiu explicitamente o reviewer nativo não selecionável por este harness.
- Documenter independente reconciliou brief e DS sem alterar PRODUCT/DESIGN/config. Drift preexistente foi apenas registrado.
- Checklist condensado da skill React Best Practices aplicado ao delta: componentes estáticos/server, nenhuma nova busca no cliente, sem novos hooks/estado ou SDK no Núcleo, sem conteúdo privado serializado e sem importação entre features.

Artefatos locais de execução em `work/legal-20261018/`; capturas em `.impeccable/review/legal-20261018/`. São ignorados pelo Git e não contêm os valores do fornecedor. O brief versionado está em [contrato de leitura](../../.impeccable/surfaces/src-app-privacidade-page-tsx.md).

## Privacidade, pendências e retomada

O mantenedor preencheu o modelo **fora do repositório**. Conferência estrutural constatou nome/tipo compatíveis e campos de documento/endereço preenchidos, sem imprimir os valores ou certificar titularidade documental. A flag de divulgação continua falsa; D-073 autoriza uso do endereço pessoal somente quando necessário à identificação da futura oferta. Nenhum CPF/endereço real foi copiado ao app, docs, Git, capturas ou issues.

Para a versão definitiva, completar inventário/retencões por categoria, fornecedores/subprocessadores/países/mecanismos de transferência, revisão da identificação publicável e operação de atendimento. Para a etapa comercial, decidir hospedagem, configurar remetente e preparar ensaio conectado quando solicitado. O texto não substitui esses controles nem implementa idade, consentimento, limpeza ou cobrança.

Não foram feitas migrations, reset/seeds, operações de restore, configurações Asaas/Supabase/Vercel/Google/Resend, alterações de DNS/credenciais, upgrades, push, PR novo ou deploy. As consultas públicas confirmaram domínio/HTTPS e MX; consultas autenticadas de metadados ficaram indisponíveis, sem presumir plano, país ou configuração por essa ausência.

Ao retomar: ler decisões D-065–D-073, conferir esta branch local e a base do PR #69; preservar o arquivo privado e o Ensaio_restore; incorporar a entrega somente quando sua publicação estiver autorizada. As 18 issues comerciais do SPEC-07 continuam com seus aceites e bloqueadores próprios.
