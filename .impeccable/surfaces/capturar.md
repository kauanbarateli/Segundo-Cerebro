# Capturar — T-009

Modo **Operate**. Superfície `/capturar`, implementada em `src/components/features/capturar`, sobre a moldura T-004 e o provider único M1. Autoridade: D-030, doc 14 §§2–7, depois doc 04. A composição e as sete notas estão aprovadas; não há nova direção visual.

## Trabalho e composição

Capturar uma ideia, escrever com espaço, conectar notas e encontrar a origem de uma tarefa. O editor precede a biblioteca no DOM e no mobile. Organização fica recolhida para que os metadados não interrompam a escrita. Vínculos explícitos, sugestões wiki e backlinks funcionam na coleção de exemplo; o grafo visual recebe uma explicação da etapa futura.

- **OBSERVADO:** título, Nova nota, contexto de escrita, campo de título, Vincular nota/Anexar imagem/contagem, corpo, ajuda e sugestões, chips, anexos, organização recolhida, Salvar, backlinks e ciclo de vida. Biblioteca com Todas/Caixa de entrada/Arquivo e busca sem acento.
- **OBSERVADO:** grade `minmax(0,1fr) 280px`, gap 24px; sidebar 240px entre 1001–1119; coluna única até 1000. Linhas mínimas 76px, lista até 520px/340px. Corpo mínimo 340px/300px no mobile, Geist 16px/1.8.
- **INFERIDO:** tokens existentes substituem medidas sem token específico: superfície radius-xl 28px e título mobile h3 20px; nenhum novo valor de cor/fonte. Campos e texto permanecem nos pares neutros já validados.
- **OBSERVADO:** rodapé de salvar sticky, a 16px no desktop e acima da barra inferior no mobile. Alvos 44px, foco em duas camadas, labels programáticas, mensagens associadas, sem animação de entrada.
- **RECOMENDADO:** biblioteca filtra a consulta compartilhada; nenhuma coleção de notas é duplicada na feature. Dados salvos têm eventos; rascunhos por usuário permanecem locais e se apagam no logout demonstrativo.

## Estados e limites

Esqueleto com geometria do editor/biblioteca, erro de leitura com retry, biblioteca vazia e vazio por filtro distintos, campo inválido com foco, salvando e preparando imagem, rascunho recuperado e armazenamento indisponível. Atualizações de consulta preservam o editor montado. URL `?capture=<id>` abre uma nota; origem de tarefa aponta para ela.

Imagens escolhidas, coladas ou arrastadas passam por decodificação e canvas, com prévia dos bytes reencodados, até seis arquivos e 8 MiB por saída. O gatilho inicial é visível no mobile. O anexo nominal da nota `book` é explicitamente exemplo, sem bytes fabricados.

Sem TipTap, grafo persistente, integração, upload, sincronização ou autenticação real. O editor é texto simples; conteúdo digitado nunca é injetado como HTML. A demonstração de Conhecimento muda o destino da mesma captura. Conversão cria tarefa com origem e não oferece desfazer que apagaria essa tarefa; ações reversíveis oferecem Desfazer.

## Evidência

Inspecionadas as capturas aprovadas `02-capturar-desktop.png` e `08-capturar-escuro-mobile.png` de 29/09/2026. Contratos, helpers e 14 casos originais de regras de imagem têm testes focados. E2E cobre jornada, vínculos/renomeação, arquivo/undo, draft/logout, imagens/EXIF e 320/390/1280px. Execução no navegador e revisão visual integrada pertencem ao root e serão registradas no relatório de T-009; este brief não declara sua aprovação antecipada.
