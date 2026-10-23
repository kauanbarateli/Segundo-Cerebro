# Proveniência do onboarding simplificado — 23/10/2026

A D-077 inclui o onboarding de nove telas no MVP, separadamente do checkout Asaas. Esta reconciliação recupera o planejamento visual aprovado do PR #47; não incorpora sua branch por merge e não demonstra aceite da aplicação.

- Fonte: `57a2967f34a11cf985e62827d67179335474f477`, PR #47, `codex/planejamento-layout-ds21`.
- Base de implementação: `4439c90ed29fedb85b7bf65b8f9f47d48fa42a8c`.
- Escopo recuperado: somente `docs/planejamento/15-aplicacao-layout-codex/`, com 62 paths diferentes da base. Sessenta paths reproduzem os blobs da fonte. README e manifest foram derivados para registrar a precedência da D-077 e os hashes atuais.
- O pacote contém 125 entradas verificáveis, além do próprio manifest. Capturas, relatório de comportamento e evidências do protótipo continuam sendo evidências históricas do protótipo, não testes da aplicação conectada.

Os documentos 03–05 e 07 definem integração, execução e aceite. O protótipo contém exemplos para avaliar a interface; não autoriza importar `window.App`, roteamento hash, dados demonstrativos ou `localStorage` para a arquitetura da aplicação.

Implementação e validação são entregas distintas. A frente UI escreve Core e apresentação; a frente backend escreve persistência, contratos versionados de perfil/Projeto e continuação OAuth. Migration numerada, aplicação em homologação, CI, comparação visual e aceite conectado permanecem sob coordenação de Root. Nenhum checkout, cobrança ou configuração Asaas é liberado por esta reconciliação.
