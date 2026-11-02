# Prompt para a frente executora

Copie o bloco abaixo para o agente. Este pacote é planejamento; os fontes da pasta referencia são fixtures visuais, não componentes prontos de produção.

---

Implemente a navegação desktop opcional por dock no repositório https://github.com/kauanbarateli/Segundo-Cerebro.

Plano canônico:
https://github.com/kauanbarateli/Segundo-Cerebro/tree/codex/plano-dock-desktop-20261102/docs/planejamento/21-dock-desktop-20261102

Leia o README e os documentos 01-contrato-e-integracao.md, 02-layout-e-interacoes.md e 03-execucao-e-aceite.md integralmente. A pasta referencia contém fontes exatos do protótipo refinado, capturas claro/escuro, hashes e como reconstituir a demonstração. Não dependa do localhost do autor.

Regras do mantenedor:
- Sidebar continua padrão. Dock somente por escolha explícita em Configurações → Aparência.
- Celular mantém a navegação atual. NÃO implementar FloatingDockMobile da referência.
- Somente Configurações permite trocar variante; recolher sidebar continua independente.
- Preservar visual aprovado da dock e o DS/Impeccable, sem redesenhar páginas dos módulos.
- Manter merge e deploy bloqueados; entregar PR em rascunho com validações. Sem coautoria.

Antes de alterar:
1. Leia AGENTS.md, CONTEXT.md, docs/planejamento/00-indice.md, docs/planejamento/20-entrega-inicial-20261031/README.md, decisões operacionais e .agents/skills/impeccable/SKILL.md + referências aplicáveis.
2. Fetch main e registre SHA. A análise deste pacote observou c6cc0065a9e1b70d84b27ca7f82848611ce61ac1. PR120 foi merged; não usar a branch antiga como base. #129 e #132 estavam fechadas: conferir código atual e não reabrir trabalho realizado.
3. Crie codex/dock-desktop-opt-in da main reconferida, coordene sobreposição com shell/tema/Configurações e proteja deploy automático da branch antes de publicar.
4. Use como defaults técnicos recomendados neste plano: preferência local “neste navegador”, sem sync de conta nem migration; key independente da sidebar; dock elegível a partir de 1051 CSS px com any-pointer:fine. Esses defaults são recomendações, não respostas humanas inventadas. Se surgir requisito de sincronização por conta, registre a divergência antes de ampliar API/banco.

Implementação:
- Fonte única de variante em lib/navigation; sidebar fallback para ausente/inválido/falha. Bootstrap pré-hidratação no mecanismo THEME_INIT_SCRIPT/CSP já existente, sem unsafe-inline.
- Guardar collapsed/expanded anterior e restaurá-lo ao voltar. Resize/zoom usa fallback sem apagar escolha.
- Criar componente desktop desacoplado da feature Configurações. Consumir getVisibleRoutes(policy), NavigationIcon, grupos e optional-destinations; nenhuma lista fixa das 11 opções demo, nenhum window.App.
- Reaproveitar busca e único menu de conta na topbar quando sidebar estiver oculta. Manter logout/senha/perfil, Ajuda/Feedback/suporte, Atualizações, Admin/Métricas condicionais e QuickCapture. Não duplicar IDs/popovers.
- Configurações: subgrupo Navegação no computador em Aparência, duas miniaturas/radios “Menu lateral — Padrão” e “Dock inferior”, texto de persistência local, Aplicar navegação separado do tema. Não perder rascunhos nem fazer POST de conta. Mobile mostra apenas aviso; não permite mudar essa opção.
- Seguir medidas, material, ativo, tooltip e magnificação do documento 02; sem dock mobile. Overflow acessível, safe-area, último conteúdo visível, modais acima. Preferência por Motion exige pin/lockfile/auditoria na execução; não copiar bundle ou deps da demo.
- Não remonte página/providers ao mudar variante, não altere temas/catálogo/acesso existentes e não reintroduza Drive.
- Execute os critérios N01–N16. Capture produto real, ambos temas e Configurações. PASS da demonstração não é aceite da aplicação.

Distribuição: A preferência/SSR; B dock/shell; C Configurações; D revisão/testes. Defina contrato primeiro; integrador único para conflitos. Máquina 8 GB: paralelismo de leitura/autoria, apenas um processo pesado local; build e E2Es amplos no GitHub. Revise cada entrega antes de incorporar.

Entregue PR draft com SHA, screenshots comparáveis, testes negativos, links CI e lista implementado/validado/pendente. Não altere serviços, secrets, migrations, produção ou configurações do VOE/BlackSheep. Não use antigos PASS como evidência do novo SHA.

---
