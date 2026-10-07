# T-007 — porte de tempo, dinheiro e hábitos

Origem verificada: `kauanbarateli/segundo_cerebro`, revisão `ffdf06435a5b8dcd047574172cddf1cc772dfd09`. Este recorte porta regras puras; não entrega persistência, integração, tela funcional ou aplicação de migrations. ADR-0002 mantém os módulos independentes de framework, SDK e infraestrutura.

## Módulos e contratos

| Destino | Origem | Contrato público |
|---|---|---|
| `src/core/tempo/tempo.ts` | `src/lib/tempo.ts` | `FUSO_DO_APP`, `SO_DATA`, `HORARIO_INGENUO`, `instanteDe`, `paraCampoLocal`, `diaCivilDe` |
| `src/core/tempo/day-range.ts` | recorte de `src/lib/utils.ts` | `DayRange`, `dayRangeInTimeZone` |
| `src/core/dinheiro/index.ts` | três funções de `src/lib/utils.ts` | `formatBRL`, `formatCentsPlain`, `parseBRLToCents` |
| `src/core/habitos/habits.ts` | `src/lib/habits.ts` | `CadenciaHabito`, `Habito`, `PausaHabito`, resumos/células e todas as funções de cálculo originais |

Os `index.ts` de tempo e hábitos reexportam seus contratos. Hábitos mantém tipos próprios, sem schema de banco: cadência diária, dias escolhidos ou alvo semanal; pausa individual ou geral; marcações esparsas em conjuntos de dias civis. Os cálculos recebem as datas e coleções do chamador, sem ler relógio, rede ou armazenamento.

`FUSO_DO_APP = "America/Sao_Paulo"` tem uma definição. É a regra explícita herdada do produto, não o fuso do processo ou do navegador. `dayRangeInTimeZone` recebe um instante de referência e retorna o dia civil, início inclusivo e fim exclusivo; aceita fuso explícito e considera dias de duração diferente de 24 horas em transições de horário de verão. O valor de preferência de fuso de usuário continua fora desse contrato, como no legado.

Dinheiro trafega em inteiros seguros de centavos. Entrada preserva os formatos decimais aceitos pelo legado, incluindo símbolo monetário, negativos, separadores brasileiro/decimal e arredondamento de casas adicionais. Empates arredondam em direção a +infinito, conforme o `Math.round` original: `1,255 → 126` e `-1,255 → -125`. Valores não representáveis em inteiro seguro retornam `null`; formatação com centavos fracionários, não finitos ou inseguros lança `RangeError`, em vez de apresentar um valor incorreto. O modo oculto continua retornando `R$ ••••`.

## Inventário dos testes originais

Todos os testes abaixo foram mantidos, com adaptação de imports. Nenhum caso original foi removido ou teve sua expectativa alterada.

| Suíte original | Grupos preservados | Casos |
|---|---|---:|
| `tempo.test.ts` | `instanteDe` (11), `paraCampoLocal` (5), `FUSO_DO_APP` (1) | 17 |
| `utils.test.ts`, recorte de tempo | `dayRangeInTimeZone` | 6 |
| `habits.test.ts` | dias civis (5), elegibilidade (4), pausas (3), sequência diária (7), sequência semanal (4), melhor sequência (2), resumo individual (6), células (3), conjunto (3) | 37 |
| `utils.test.ts`, recorte monetário | soma exata de centavos e ocultação de valor | 2 |
| **Total original portado neste recorte** | | **62** |

O teste de `dayRangeInTimeZone` que demonstra a divergência do antigo `startOfDay` conserva a comparação, mas cria o cálculo local dentro do próprio teste. O helper inseguro não foi incorporado ao Núcleo. Os testes monetários adicionais de `finance.test.ts` pertencem ao recorte de financeiro, não a esta contagem.

## Correções pontuais e cobertura nova

1. **Conversão decimal:** `Number(texto) * 100` podia produzir `100.499…` para `1,005`, perdendo um centavo no arredondamento. O parser calcula magnitude inteira com `BigInt` e converte apenas após conferir o limite seguro. Preserva a regra de empate e os formatos de entrada.
2. **Formatação monetária:** dividir centavos por 100 antes de formatar perdia precisão no limite seguro; `9007199254740990` saía como `90071992547409,91`. Os formatadores agora separam inteiros e fração, com agrupamento/símbolo de `Intl`, conservando `90071992547409,90` e valores negativos menores que um real.
3. **Período semanal sem oportunidade:** um hábito semanal iniciado depois de `ate` ainda contava uma semana quando ambas as datas pertenciam à mesma semana. A condição de intervalo válido é aplicada antes de contar; também cobre intervalos invertidos.
4. **Semana corrente inteiramente pausada:** a sequência atual somava essa semana quando havia marcações anteriores à pausa, enquanto resumo e melhor sequência a ignoravam. A sequência atual agora aplica a mesma regra de pausa integral.
5. **Transições de fuso:** a segunda passada legada podia devolver o dia anterior para uma meia-noite inexistente e deixar lacunas entre faixas consecutivas. Conversões e faixas compartilham agora a mesma resolução IANA, via Intl. Datas civis usam o primeiro instante válido a partir da meia-noite; se um fuso suprimiu um dia inteiro (Apia em 2011), a borda é o início do próximo dia existente. Para datetime, a política explícita compatible avança pela duração do salto quando o horário não existe e escolhe a ocorrência anterior quando se repete. Os minutos são preservados, inclusive em saltos de 30 minutos. Nenhuma decisão depende do fuso do processo.
6. **Anos ISO abaixo de 100:** o construtor UTC usa setUTCFullYear, eliminando a interpretação automática 1900–1999 de Date.UTC. Formatação, faixas de dias e aritmética de hábitos preservam anos 0001–0099.
7. **Pausa na primeira semana:** dias anteriores a started_on não são oportunidades e não interrompem uma pausa integral. Uma semana iniciada na quarta e pausada de quarta a domingo não registra falha nem soma marcações à sequência.

Cobertura adicional: sete casos monetários (formato de campo, formatos legados/negativos, arredondamento exato, inválidos, limite seguro, ida e volta da formatação, rejeição de centavos inválidos) e três de hábitos (início futuro no mesmo ciclo, intervalo invertido, pausa integral corrente). A revisão independente acrescentou nove casos de tempo (gaps/folds, fronteiras contíguas, transição de 30 minutos, dia suprimido e anos antigos) e quatro de hábitos (pausas na primeira semana, alvo parcial preservado e anos antigos). Total: **85 casos** neste recorte, sendo 32 de tempo, 44 de hábitos e 9 de dinheiro.

## Compatibilidade e limites mantidos

- Semana de hábito começa na segunda e fecha no domingo. Semana corrente ainda aberta não quebra sequência nem conta como falha; dia corrente aberto também não conta como falha.
- Semanas parcialmente pausadas conservam o alvo integral. Resumos de alvo semanal contam semanas, não dias, e mantêm a agregação por semana completa do legado.
- Funções de dias civis esperam chaves válidas `AAAA-MM-DD`; validação de entradas externas pertence à borda. Os limites de caminhada originais (3.660 dias / 520 semanas) foram preservados.
- O porte de `tempo.ts` conserva a precisão original em segundos: a expressão de horário ingênuo aceita fração, mas `instanteDe` a descarta. As correções de transições e anos antigos estão explicitadas acima; não alteram a regra fixa America/Sao_Paulo nem introduzem dependências.
- O parser monetário mantém a limpeza permissiva do legado (remove símbolos e texto, depois interpreta o último separador). Ele não substitui validação de formulário nem define limites comerciais.

## Evidência executada em 07/10/2026

- `TZ=UTC`: 3 arquivos, **85/85 testes aprovados**.
- `TZ=America/Sao_Paulo`: 3 arquivos, **85/85 testes aprovados**.
- ESLint dos três módulos e suas suítes: aprovado, sem avisos.
- `typecheck`: aprovado durante a integração local. Após a revisão, checagem TypeScript focada em tempo/hábitos e suas suítes também aprovada (strict + noUncheckedIndexedAccess).
- `depcruise src/core --config .dependency-cruiser.cjs`: aprovado no porte original. Após a revisão, `depcruise src/core/tempo src/core/habitos --config .dependency-cruiser.cjs`: aprovado, sem violações (6 módulos / 7 dependências).

Não foram executados build, servidor, banco, commit ou push por este recorte. Essas evidências são locais; não afirmam CI remoto verde nem encerramento integral da T-007.
