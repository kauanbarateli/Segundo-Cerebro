---
target: Protótipo Segundo Cérebro — diagnóstico da versão anterior
total_score: 25
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 4
target_identity: "file:C:\\Users\\Kauan Sousa Barateli\\Documents\\Codex\\2026-10-17\\construa-um-prot-tipo-naveg-vel\\work\\baseline-v1\\index.html"
target_fingerprint: "sha256:3e3be9b602eb01ea5c31db6d568b031abd5113d9b2cd4596373ae0c4a960d2f7"
target_path: "C:\\Users\\Kauan Sousa Barateli\\Documents\\Codex\\2026-10-17\\construa-um-prot-tipo-naveg-vel\\work\\baseline-v1\\index.html"
timestamp: 2026-10-17T14-23-32Z
slug: work-baseline-v1-index-html
---
# Diagnóstico e correções — refinamento v2

17/10/2026. Avaliação da versão anterior, seguida de correções e revisão final.

## Direção

A base já conectava tarefas, agenda, conhecimento e vida pessoal. O principal problema era a informação operacional pequena dentro de superfícies grandes, somada à navegação lateral rígida. O refinamento dá mais presença ao conteúdo, preserva a marca “2” e utiliza contraste e alinhamento para organizar a leitura.

A referência escura tem aparência cinza/carvão apesar de rótulos hexadecimais quentes. Sua aparência visual orientou a atualização: fundos neutros escuros, superfícies distinguíveis e rosa suave concentrado em ações e seleções.

## Prioridades e resolução

| Prioridade | Problema anterior | Correção implementada |
|---|---|---|
| P1 | Texto operacional frequentemente entre 8–11 px | Escala compartilhada: corpo 14 px, apoio 12 px, campos 16 px; títulos e eventos com hierarquia própria. Exceções auxiliares documentadas. |
| P1 | Trilho ocultava os textos que forneciam nomes acessíveis | Rótulos permanentes e dicas por ponteiro/teclado, dispensáveis com Escape. |
| P1 | Foco desaparecia sobre o painel escuro no tema claro | Contorno inverso específico para a superfície de destaque. |
| P1 | Datas de outros meses perdiam contraste pela opacidade | Texto secundário legível, sem reduzir a opacidade de todo o controle. |
| P2 | Sidebar mudava somente por breakpoint | Controle manual persistente, 232/76 px e painel móvel independente. |
| P2 | Laterais comprimiam eventos e diminuíam fontes | Grade priorizada; filtros cedem espaço; lista móvel e detalhes preservados. |
| P2 | Resumos disputavam atenção com a próxima ação | Tarefa prioritária com fonte maior, resumo mais compacto e densidade ajustada. |
| P2 | Bordas de controles confundidas com divisores | Token próprio de borda interativa, preservando divisórias discretas. |

No polish foram corrigidos ainda: ações abaixo do texto das capturas móveis; fontes em linha própria na agenda móvel; truncamento de eventos por linhas inteiras; contorno dos hábitos habilitados não marcados.

## Evidência IMPECCABLE

Foram lidas as instruções de critique, audit, animate, craft-floor e polish da versão local disponível (4.4). Duas avaliações precederam a implementação: A, crítica manual; B, detector e inspeção focal, sem acesso ao relatório A desta rodada. O revisor B já conhecia a primeira entrega: a independência é entre avaliações desta rodada, não ausência de histórico do produto.

O detector estático foi executado uma vez sobre a cópia imutável da versão anterior: **109 registros, sendo 5 warnings e 104 advisories**. Foram 79 registros de tamanho, 21 de raio, quatro de cor, quatro de fonte recorrente e um de família fora do sistema. As regras podem se sobrepor por ocorrência; não são 109 defeitos visuais independentes.

Geist foi mantida por pertencer à identidade do projeto. Escala, raios e sobreposições receberam documentação compatível com o código final. Não houve overlay injetado: a ferramenta de navegador permite avaliação DOM somente leitura. Capturas, código e medições explícitas forneceram evidência, sem alegar execução de detector visual.

### Heurísticas da versão anterior

| Heurística | Nota / 4 |
|---|---:|
| Estado do sistema | 3 |
| Linguagem do mundo real | 3 |
| Controle e liberdade | 2 |
| Consistência | 2 |
| Prevenção de erro | 3 |
| Reconhecimento | 2 |
| Eficiência | 2 |
| Estética e minimalismo | 2 |
| Recuperação | 3 |
| Ajuda e contexto | 3 |
| **Total anterior** | **25/40** |

A nota é um diagnóstico heurístico anterior, não uma medição automática ou nota da versão final. Não se calculou melhoria numérica sem avaliação equivalente.

Para novos usuários, rótulos e dicas reduzem a dependência de memorizar ícones. Para quem alterna tarefas e agenda, lateral controlável e rascunhos preservados evitam interrupções. Em telas pequenas, a organização muda antes de reduzir o texto.

As prioridades já estavam autorizadas no pedido; não foi necessário repetir perguntas de escopo. O polish final foi aprovado, com os quatro últimos achados resolvidos. Consulte `VALIDACAO.md` para cobertura e limites, e `DESIGN.md` para as instruções originais das quatro coleções de skills.
