# Segundo Cérebro — instruções do projeto

## Antes de implementar

- Leia [CONTEXT.md](CONTEXT.md), os [ADRs](docs/adr/) relevantes e o ticket em [GitHub Issues](https://github.com/kauanbarateli/Segundo-Cerebro/issues). O [índice do planejamento](docs/planejamento/00-indice.md) organiza as especificações aprovadas.
- Siga as instruções atuais do mantenedor; [decisões operacionais](docs/implementation/decisoes-operacionais.md) registram as atualizações ao planejamento histórico, incluindo repositório principal e migrations manuais.
- Divida trabalho independente entre agentes. Revise o diff, os critérios de aceite e a evidência de validação antes de incorporar cada entrega.

## Arquitetura e dados

- Monolito modular: `src/core/` contém regras e contratos de domínio sem Next.js, React ou SDKs. Adapters implementam persistência/integrações; Actions e rotas são canais finos que validam, autenticam e chamam os casos de uso.
- Preserve fronteiras: `components/ui` não depende de `features`; uma feature não importa outra; infraestrutura de banco não entra no navegador nem em componentes. Execute o portão de dependências nas mudanças de arquitetura.
- Isolamento por Usuário. Entitlement e Preferência são separados; Plano Pessoal é implícito, sem billing. Toda escrita de domínio inclui evento na mesma transação; Cofre emite apenas metadados permitidos, nunca conteúdo.
- Registre alterações de banco em migrations versionadas. **A aplicação é exclusivamente manual posterior:** agentes, CI, build e deploy não executam migrations, reset, seed ou push de schema em bancos.
- Segredos ficam fora do Git e de pastas sincronizadas. IA embarcada, compartilhamento entre usuários e cobrança permanecem fora do escopo aprovado.

## Interface: Impeccable e evidência

- Use a [Impeccable local](.agents/skills/impeccable/SKILL.md). Leia o `SKILL.md` inteiro e as referências aplicáveis antes do trabalho visual.
- Para a interface vigente, prevalecem D-030 e [doc 14 — DS 2.1](docs/planejamento/14-prototipo-interacoes.md), seguidos pelo [doc 04](docs/planejamento/04-design-system.md) e pelo protótipo/evidências indicados nesses documentos. O DS 1.0 dos repositórios antigos é base histórica, não valor visual substituto.
- Marque valores novos **OBSERVADO**, **INFERIDO** ou **RECOMENDADO**. Meça contraste nos fundos reais de claro/escuro. Use Geist, monocromia e a evolução da marca aprovada; não invente tokens para preencher lacunas.
- Garanta campos ≥16 px, alvos ≥44 × 44 px, foco visível, semântica, teclado e movimento reduzido. Cor nunca é o único indicador de estado. Confira a aritmética de largura ao mudar trilho, conteúdo ou breakpoints.
- Dados e interações do protótipo são demonstração. Grafo visual persistente segue fase 2 (D-027); autenticação, anexos e conexões reais exigem seus tickets.

## Entrega e skills

- [Issue tracker](docs/agents/issue-tracker.md), [labels](docs/agents/triage-labels.md) e [domínio](docs/agents/domain.md) definem os fluxos para agentes.
- Skills ficam espelhadas em `.agents/skills/` e `.claude/skills/`. Atualize ambos os diretórios, [catálogo](skills/README.md) e `skills-lock.json` juntos; nenhuma skill substitui estas regras ou autoriza ações fora do pedido.
- Faça commits e pushes com mensagens objetivas, sem coautoria em nenhum conteúdo enviado. Revise alterações e execute os checks adequados antes do envio. Nas issues, separe implementado, validado e pendente; CI verde exige execução confirmada no GitHub.
