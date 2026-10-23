# Correção restrita da auditoria Zod — 23/10/2026

A auditoria completa do CI da PR #113 recusou Zod 4.6.5 e seus consumidores Serwist. O [advisory oficial GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5), atualizado em 23/10, identifica 4.6.6 como versão corrigida para o consumo excessivo de memória na validação de coleções.

Foram acrescentados três overrides exatos: Zod 4.6.6 sob @serwist/next, @serwist/build e @serwist/webpack-plugin, todos na versão 9.5.13. Os overrides anteriores permanecem. O lock mudou somente versão, URL oficial e integrity do único pacote Zod; as declarações originais dos pacotes Serwist não foram reescritas.

Node24.19.0/npm11.12.1 regeneraram somente o lock com scripts e auditoria automática desabilitados. Não foi criado node_modules, nem executado audit fix, force, downgrade ou atualização global. A auditoria completa foi então executada separadamente: exit0, zero vulnerabilidades em todas as severidades, no instante registrado no recibo.

**Validado:** diferença restrita de JSON e lock, auditoria oficial, ausência de node_modules e revisão estática. **Pendente:** npm ci, tipos, unidades, scripts, build/PWA e navegador do novo SHA no GitHub. Compatibilidade com Serwist continua sujeita a esses gates; a auditoria isolada não a demonstra. A #36 permanece manutenção conforme decisão do mantenedor.

Não há mudança de schema, ambiente ou serviço. Os gates de CI, merge e deploy permanecem preservados.

