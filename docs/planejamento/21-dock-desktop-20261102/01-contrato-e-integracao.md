# Contrato e integração

## 1. Requisitos confirmados

- Sidebar é o padrão inclusive para pessoas existentes, primeiro acesso, preferência ausente, inválida ou ilegível.
- Dock é alternativa exclusiva da navegação do desktop, não substituição obrigatória.
- Apenas Configurações oferece seleção/aplicação da variante. Não criar atalho no header, onboarding, dock, login, query string ou menu contextual para trocar sidebar/dock.
- O botão atual de recolher/expandir continua com essa função no modo sidebar; não passa a ativar dock.
- Celular conserva bottom navigation + drawer atual. Não portar `FloatingDockMobile`.
- A alteração aplica-se às páginas que já usam `WorkspaceShell`, não à landing, Auth ou onboarding sem shell.

## 2. Defaults técnicos RECOMENDADOS para execução

### Persistência e resolução

Preferência de apresentação do navegador, separada de Entitlements, visibilidade/ordem e estado recolhido:

```ts
type DesktopNavigationMode = "sidebar" | "dock";
// chave proposta: segundo-cerebro-desktop-navigation-v1
// atributo proposto: data-desktop-navigation (preferência, não elegibilidade)
const desktopEligible = width >= 1051 && anyPointerFine;
const effectiveNavigation = desktopEligible && savedMode === "dock"
  ? "dock" : "sidebar";
```

- Preferência local/global do navegador, sem UUID, PII, cookie ou gravação em Supabase. Não promete sincronizar contas ou dispositivos. Ao alternar conta no mesmo navegador, a apresentação pode ser mantida; rotas/identidade/permissões devem sempre ser recalculadas para a sessão atual.
- Usar parsers estritos, snapshot estável e store reutilizável em `src/lib/navigation/desktop-navigation-preference.ts` (nome proposto). Fallback de memória na aba se localStorage não funcionar; notificar que a escolha vale só durante a visita. Não mentir dizendo que persistiu.
- Não escrever ao montar a página, ao redimensionar, ao carregar preferência desconhecida ou ao migrar estado collapsed/expanded.
- Ler preferência antes da primeira pintura pelo mecanismo já existente; subscribe para mesma aba e evento `storage` para outras. Remover chave em outra aba resolve para sidebar; chave inválida não quebra bootstrap.
- `segundo-cerebro-sidebar` permanece intocada. Ao voltar à sidebar restaurar collapsed/expanded anterior, inclusive fallback responsivo se não havia escolha.
- Resize/zoom/perda de ponteiro preciso fazem fallback de apresentação, mas **não apagam** a preferência dock. Ao voltar ao desktop elegível, dock reaparece.
- Salvar variante não envia `settings.preferences.update` nem altera rascunhos de nome/tema/módulos. Não inserir campo extra no snapshot da conta: seu decoder exige chaves exatas.
- A pessoa aplica no botão separado **Aplicar navegação**; radios editam um rascunho local. Troca sem reload, navegação, remontagem de providers ou descarte de formulários. Foco continua no acionador de aplicação e mensagem é anunciada.
- Se outra aba muda o valor, o shell acompanha. Em Configurações, atualizar o rascunho apenas se não houver edição local; se houver, mostrar aviso e manter o rascunho até aplicar explicitamente.

### O que significa desktop nesta proposta

O projeto tem mobile até 600 px e sidebar compacta até 1050 px. **Recomendado:** dock somente `(min-width:1051px) and (any-pointer:fine)`. Não usar user-agent. Dispositivos híbridos com mouse podem utilizá-la; eventos touch não ampliam ícones. Tablet/touch-only mantém navegação anterior.

Esse corte é uma adaptação de integração, não valor originalmente pedido pelo mantenedor. O corte de 768 px da demonstração não é copiado. Em tela não elegível, mostrar aviso informativo em Aparência sem seletor editável: “A navegação por dock está disponível no computador. Neste dispositivo, o menu atual é mantido.” Não registrar dock por tocar nesse aviso.

### Se for exigida preferência por conta posteriormente

Tratar como alteração de escopo: desenhar extensão compatível do snapshot/decoder, schema, RPC, evento atômico, defaults legados, SSR, idempotência e isolamento. `AccountSettings.preferences` não aceita campo extra hoje. Não copiar a primeira definição histórica de `settings_commit`: houve revisões no Calendar/onboarding. Não introduzir Supabase ou migration só para cumprir este recorte local.

## 3. Mapa real de código (main c6cc006)

| Arquivo | Papel existente | Delta planejado |
|---|---|---|
| `src/components/layout/workspace-shell.tsx` | sidebar, overlay mobile, topbar, CommandPalette, conta, lembretes, links opcionais | Resolver variante, compor dock e manter uma navegação acessível por modo |
| `src/components/layout/workspace-shell.css` | grid, sidebar collapsed, bottom bar ≤600, popover/foco | Dock opt-in remove coluna lateral; reserva inferior e layering; demais modos idênticos |
| `src/lib/navigation/sidebar-preference.ts` | localStorage collapsed/expanded; cortes 600/1050 | Preservar contrato, sem sobrecarregar seu enum |
| `src/lib/theme.ts` | bootstrap síncrono de tema e sidebar | Acrescentar leitura defensiva da variante no mesmo mecanismo |
| `src/lib/security/csp.ts` | hash do bootstrap | Verificar hash atualizado, sem unsafe-inline ou script improvisado |
| `src/lib/navigation/routes.ts` | catálogo + getVisibleRoutes(policy), getMobileRoutes | Consumir catálogo vigente; não manter lista fixa do protótipo |
| `src/lib/navigation/groups.ts` | grupos sem corromper ordem customizada | Derivar separadores sem reordenar preferências |
| `src/lib/navigation/optional-destinations.ts` | Ajuda/Feedback/suporte/Atualizações | Preservar flags do servidor e destinos realmente disponíveis |
| `src/components/layout/navigation-icon.tsx` | ícones por feature | Reutilizar; não copiar window.App.icon/dangerouslySetInnerHTML |
| `src/components/features/configuracoes/settings-connected-workspace.tsx` | aparência persistida na conta e painéis independentes | Compor seletor local isolado, corrigir texto “Cada seção salva na sua conta” |
| `src/components/features/configuracoes/settings-workspace.tsx` | ramo demo | Mesmo seletor local, sem fingir escrita na conta |
| `src/components/features/configuracoes/settings.css` | composição dos painéis | Novo subgrupo em Aparência, sem reordenar demais seções |
| `src/components/theme/theme-models.tsx` | miniaturas do seletor de tema | Referência de composição, não acoplar estado de tema ao da dock |
| `src/app/(workspace)/layout.tsx`, `src/app/layout.tsx` | providers/SSR | Preservar identidade e assinatura; não remontar página ao trocar variante |

Nomes novos sugeridos: `components/layout/desktop-dock.tsx/.css`, `features/configuracoes/desktop-navigation-setting.tsx/.css`, `lib/navigation/desktop-navigation-preference.ts`. Não pôr regra de apresentação no Núcleo. Respeitar portão de dependências e evitar imports entre features. Preferir CSS externo ao style inline da referência.

## 4. Não perder funcionalidade ao remover o trilho

A sidebar abriga ações que não aparecem na dock demonstrativa. A execução precisa preservar:

1. **Busca:** tornar o botão existente da topbar visível no modo dock; mesmo CommandPalette e Ctrl/Cmd+K, sem segundo estado.
2. **Conta:** avatar da topbar hoje é link para `/configuracoes#perfil`. Em dock, torná-lo acionador de **um único** popover da conta, fora da sidebar oculta. Reutilizar conteúdo, incluir “Meu perfil” para manter destino anterior, Configurações, Atividade quando permitida, Ajuda/Feedback, suporte, Trocar senha e Sair com fluxo atual.
3. **Sidebar padrão/mobile:** conservar acionadores e contrato atuais. Não duplicar `id=shell-profile`, traps de foco, listeners de logout ou popovers no DOM.
4. **Métricas:** usar `metricsAvailable`; **Admin** usa política atual. Nunca exibir por estar no protótipo ou por localStorage.
5. **Atualizações:** manter flag/link do header. Ajuda/Feedback vêm de `optional-destinations`, não URLs inventadas.
6. **Captura rápida:** manter `QuickCapture` do header. Ícone Capturar da dock continua rota; não trocar um pelo outro.
7. **Configurações:** sempre alcançável pelo catálogo permitido e pela conta, para permitir reverter. Não criar botão “voltar para sidebar” fora de Configurações.
8. **Marca, breadcrumbs, skip-link e foco do main:** preservar acesso ao Início e identidade da marca; não apagar breadcrumb nem foco ao navegar.
9. **Catálogo:** Drive não é reintroduzido por esta tarefa; manter boundary atual. Recalcular seleção pela rota Next, não por clique local. Rota sem item visível não marca Início indevidamente.

Usar links Next reais, clique modificado/nova aba compatíveis. Estado ativo deriva de pathname e resolvedor de rota, incluindo subrotas quando existentes, sem matching ingênuo por prefixo.

## 5. SSR e manutenção

- Bootstrap deve pintar atributo antes da hidratação, porém CSS só o aplica no media query elegível. SSR/default mantém navegação utilizável com sidebar; nunca tela sem navegação aguardando chunk da dock.
- Estratégia recomendada: emitir links estáticos de ambas as variantes no SSR, com CSS de visibilidade mutuamente exclusiva; somente a variante visível participa da árvore acessível e do Tab. Carregar a animação como melhoria progressiva, sem tornar os links dependentes de Motion. Não usar o snapshot servidor `false` de useMediaQuery para omitir a dock enquanto o bootstrap já esconde a sidebar. Evitar efeitos duplicados: conteúdo de conta/popover tem uma única instância.
- Testar DOM/hidratação, não esconder warnings com suppressHydrationWarning indiscriminado. Reutilizar padrão controlado do projeto, sem depender de window no render servidor.
- Não colocar `key={mode}` no shell, layout, editor ou providers. Troca preserva rota, query, hash, scroll, edição, sessão e estado do Cofre.
- Ao alternar breakpoint, fechar tooltip/popover que perdeu âncora e restaurar foco em destino visível equivalente. Elementos ocultos não recebem Tab nem aparecem como segundo landmark acessível.
- Falha no chunk de animação conserva links estáticos da dock. Se a própria variante não puder ser apresentada, oferecer sidebar operacional sem alterar preferência salva; nunca deixar ambas invisíveis.
