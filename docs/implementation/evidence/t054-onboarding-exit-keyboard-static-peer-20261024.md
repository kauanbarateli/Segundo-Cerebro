# Onboarding exit/teclado — peer estático (24/10/2026)

Favorável estático, sem novo bloqueador objetivo nos quatro payloads. Não executei Node, testes, browser, lint, SQL, rede, serviço ou Git; nenhuma fonte foi alterada.

## Identidade

Manifesto EV/onboarding-exit-keyboard-freeze-v1-20261024/manifest.json: 5.603 bytes, SHA256 e46e62d698b266dc7f6300462dbc13bc3ffcbba2360f8770f736c94a9540c2be. Conferi quatro after/quatro before e patch de 11.082 bytes, SHA256 5dc7d6b67a2479dd777c9c1756fb82dcff0af94ab8c3ca5fe6ffe6707f35986c.

Os dez protegidos declarados conferem por hash, incluindo Home real, Core/decoder, HTTP port/lifetime, backend, package e Vercel. A Home continua SHA256 5824cad838d1b7d1eb4db696f220e09ff2962b44cb46a76e2ff20217cf492827. Não há nova regra de coorte, redirect global, migração ou expansão comercial.

## Saída e gates

Workspace:61 troca somente o link de Explorar pelo Button que chama state.exit(), o mesmo caminho já usado por Fazer depois/marca. O componente Button tem type=button e respeita disabled. A chamada fica indisponível em busy/hold; act() também mantém o lock síncrono via refs e lifetime.

Hook:156–171 só inicia uma rodada vazia se ela não existir E eligibility.canStart. Com rodada inexistente e conta inelegível, save() retorna sem RPC e pause não é chamado; a navegação só ocorre no commit do lifetime atual. Com conta elegível, o start reconhece a oferta, preserva draft vazio e pause. Com edição existente, save/CAS e pause precedem a saída; conflitos/resultado incerto/sessão recusam antes do router.push.

Nenhum confirm/advance, efeito de módulo ou descarte de escolha foi adicionado. A inversão apenas do novo &&canStart reproduz integralmente o hook before; os demais gates e corpos são byteiguais. O Home original ainda exige kind new_explicit + offerPending + canStart depois de authorize/requireUser, e não bloqueia conta existente em erro opcional.

## Teclado

Progress:118–124 usa o details nativo. O handler só consome Escape ainda não consumido e com menu aberto; fecha open, interrompe essa propagação e devolve foco ao próprio summary. Não adiciona trap/document listener, não altera a navegação das etapas e não chama save/navigate. Escape em menu fechado ou já tratado por descendente continua intacto.

## Testes efetivos e limites

Os três novos casos de browser exercitam o workspace/hook reais sobre a API sintética persistente já existente:
1. Enter no CTA, um start/um pause, oferta reconhecida, draft vazio, reload; depois nome/foco salvos na mesma rodada e novo reload, sem confirm/advance/efeitos.
2. Sem elegibilidade e sem rodada: nenhuma ação de comando, snapshot integral preservado e saída capturada.
3. details por Enter/Tab/Escape, foco de volta ao gatilho e snapshot/comandos/efeitos byteiguais.

A API existente conserva o snapshot no processo do teste durante page.reload, decodifica o DTO e rastreia comandos; seu start já limpa offerPending e usa step profile. Não foi alterada para acomodar o novo teste. O teste de Home importa e chama a Page real três vezes com Auth/load mockados e respostas novas do estado persistido, em vez de copiar o predicado ou apenas conferir href. Ele verifica oferta pendente, adiada e inelegível, com authorize/requireUser/load em cada entrada.

Remover somente os três novos blocos E2E e o único it de Home reproduz integralmente os respectivos arquivos anteriores. As suítes antigas permanecem byteiguais. Isso ainda não prova navegação Next/Auth/SQL ou persistência hospedada; browser e unitários novos estão somente escritos.

Li o launch focal do autor: 3.618 bytes, SHA256 af9ad63276a69152a5888246b9d382b1fcd7a3fa47421eee2bb07092f34c09d9, quatro arquivos/exit0, hashes before/after iguais. O aviso de react detect sem React local é ambiental. Esse lint não é Typecheck, Vitest, render ou CI próprio e não foi reexecutado por mim.

## Hashes after

- onboarding-workspace.tsx: 21.223 bytes, SHA256 22a0fcac7790a411dc634cd1c3417e524287603cf63b2d3289b32136a4f48e79.
- use-onboarding.ts: 16.968 bytes, SHA256 9a8c7280950e48ac55a19faf71b17a3f6db3f80878cdcda2c18fb144a6a47a28.
- onboarding-workspace.spec.ts: 43.658 bytes, SHA256 c94402a7b655e8c5186170c9d00215e7a4d559aa74bacb6abd9d25d4e3aaff1a.
- onboarding-home.test.ts: 4.466 bytes, SHA256 365b94c6b0c7c0008c3028586b1f7bb82b5dc09ac561e25cf5c095c9baf7eab3.

Pendente: reconciliação Root, Typecheck e CI próprio do candidato, execução das suítes/teclado e aceites conectados. Nenhum schema, flag, merge, produção, inspeção ou restore é autorizado por este parecer.
