# Rolldown 1.2.12 — dynamicImports apontando o próprio chunk

**Conclusão estática:** a implementação pinada permite metadata self mesmo quando o import interno foi inlined e o nó emitido não contém import(). Isso explica o resultado relatado; não prova a ausência de imports no bundle concreto nem autoriza ignorar metadata desconhecida.

A tag v1.2.12 aponta para o commit **45e407b177f5885d04a9795f37f8be71d91f6f17**. O [package.json desse commit](https://github.com/rolldown/rolldown/blob/45e407b177f5885d04a9795f37f8be71d91f6f17/packages/rolldown/package.json) declara exatamente 1.2.12. Todos os links abaixo são dessa revisão, não do HEAD de desenvolvimento.

## Cadeia primária verificável

1. **Opção efetiva.** [bindingifyCodeSplitting, linhas273–294](https://github.com/rolldown/rolldown/blob/45e407b177f5885d04a9795f37f8be71d91f6f17/packages/rolldown/src/utils/bindingify-output-options.ts#L273) converte codeSplitting:false em inlineDynamicImports:true. O [normalizador Rust484–490](https://github.com/rolldown/rolldown/blob/45e407b177f5885d04a9795f37f8be71d91f6f17/crates/rolldown_binding/src/utils/normalize_binding_options.rs#L484) gera Bool(false), cujo [is_disabled](https://github.com/rolldown/rolldown/blob/45e407b177f5885d04a9795f37f8be71d91f6f17/crates/rolldown_common/src/inner_bundler_options/types/code_splitting_mode.rs#L42) significa inline.

2. **Metadata deriva do grafo.** [collect_dynamic_chunk_import595–622](https://github.com/rolldown/rolldown/blob/45e407b177f5885d04a9795f37f8be71d91f6f17/crates/rolldown/src/stages/generate_stage/compute_cross_chunk_links.rs#L595) percorre imports dinâmicos resolvidos/incluídos, escolhe o chunk da entrada ou o hosting chunk e insere seu índice. Não compara esse índice ao chunk importador para excluir self. Se os dois módulos residem na mesma saída, o índice pode ser o próprio chunk.

3. **O índice vira filename, não uma análise do JS final.** [finalize_chunks215–226](https://github.com/rolldown/rolldown/blob/45e407b177f5885d04a9795f37f8be71d91f6f17/crates/rolldown/src/utils/chunk/finalize_chunks.rs#L215) mapeia cross_chunk_dynamic_imports para filenames e acrescenta externos. [render_chunk_to_assets117](https://github.com/rolldown/rolldown/blob/45e407b177f5885d04a9795f37f8be71d91f6f17/crates/rolldown/src/stages/generate_stage/render_chunk_to_assets.rs#L117) move o vetor para OutputChunk. O [binding101–103](https://github.com/rolldown/rolldown/blob/45e407b177f5885d04a9795f37f8be71d91f6f17/crates/rolldown_binding/src/types/binding_output_chunk.rs#L101) e o [getter TypeScript71–73](https://github.com/rolldown/rolldown/blob/45e407b177f5885d04a9795f37f8be71d91f6f17/packages/rolldown/src/types/output-chunk-impl.ts#L71) o repassam. Esse caminho não parseia code nem remove a aresta depois de inlining. O comentário “External modules” da interface TS não é prova mais forte que essa implementação.

4. **Emissão independente da metadata.** O [visitor553](https://github.com/rolldown/rolldown/blob/45e407b177f5885d04a9795f37f8be71d91f6f17/crates/rolldown/src/module_finalizers/impl_visit_mut.rs#L553) aplica try_rewrite_inline_dynamic_import_expr antes da reescrita geral. No [ramo1877–1958](https://github.com/rolldown/rolldown/blob/45e407b177f5885d04a9795f37f8be71d91f6f17/crates/rolldown/src/module_finalizers/mod.rs#L1877), splitting desabilitado + módulo interno ESM sem TLA gera Promise.resolve().then(() => (init_module(), module_exports)). Não é apenas comentário: [new_promise_resolve_then116–145](https://github.com/rolldown/rolldown/blob/45e407b177f5885d04a9795f37f8be71d91f6f17/crates/rolldown_ecmascript_utils/src/ast_factory.rs#L116) constrói explicitamente o AST Promise→resolve→then, sem ImportExpression nesse replacement.

**Limites do ramo:** ESM com TLA usa init_module().then(...); CJS interno usa wrapper local com Promise; módulo externo não é reescrito nesse ramo. Imports não resolvidos e plugins possuem outros caminhos. O import literal relatado em goal-image-host-binding.ts é compatível com o caso normal, mas não examinei o output real para provar resolução interna, ausência de TLA, versão do binding nativo ou alterações posteriores por plugins. Uma transformação local também não prova o restante do chunk.

## Decisão e controles mínimos

Se o contrato da guarda é “bundle autocontido, sem carregamento de módulos externos”, um refinamento revisável deve manter um único chunk JS, imports vazio e todos os checks/regex existentes. Metadata dynamicImports pode ser somente vazia ou conter UMA referência exatamente igual ao filename de saída já validado, **sem filtrar/mutar o vetor**, e somente com comprovação independente do AST final.

Esse AST precisa parsear sem diagnóstico e recusar import estático, export-from, ImportExpression literal/computado e import.meta, preservando os controles atuais. O filename/versão/configuração também devem ser fechados. Se a política pretendida proíbe qualquer aresta dinâmica de fonte, o novo import deve continuar recusado: a pesquisa não altera essa decisão.

Negativos mínimos: self+import real; metadata vazia+import real; computed import; outro chunk/URL; self duplicado ou acompanhado de externo; filename diferente; parse inválido; configuração/versão divergente. O positivo é código final autocontido com selfmetadata explicado pela fonte pinada. Não remover a guarda pela ocorrência observada, nem aceitar qualquer dynamicImports por codeSplitting:false.

## Evidência e alcance

Quinze fontes públicos completos foram preservados em EV/rolldown-self-dynamic-imports-1.2.12-20261024/raw/. Seu manifesto contém bytes/SHA256, Git blob e URLs imutáveis. Cada Git blob foi refeito a partir dos raw e conferido contra o retorno oficial. Inclui package, normalização, grafo, finalização/AST e bindings, para revisão offline.

Não executei Node, bundle, Rust, SDK, npm, testes, renderer ou navegador; não alterei Root/guardas e não consultei rede privada, banco ou Actions. A prova é de código-fonte, não de identidade do binário carregado nem aceite do E2E. A próxima verificação deve atuar no artefato concreto e nos negativos, sob revisão Root.
