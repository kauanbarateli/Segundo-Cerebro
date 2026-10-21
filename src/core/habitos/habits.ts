/** Portado de segundo_cerebro@ffdf06435a5b8dcd047574172cddf1cc772dfd09. */
/**
 * A ARITMÉTICA DOS HÁBITOS — pura, sem banco e sem `server-only`.
 *
 * ⚠️ A ausência de `server-only` é a razão de este arquivo existir separado.
 * Ele é importado pela TELA (Server Component e cliente) e pela ROTA DE CRON do
 * e-mail semanal. Duas implementações do mesmo número são a garantia de que um
 * dia a tela diz 18, o e-mail diz 19, e ninguém sabe qual está certo.
 *
 * É o mesmo padrão de `finance.ts` e `credit.ts`.
 *
 * ============================================================================
 * TUDO AQUI TRABALHA COM "AAAA-MM-DD", NUNCA COM `Date`
 * ============================================================================
 * O dia de um hábito é um dia CIVIL. `Date` carrega instante e fuso, e toda
 * conta que envolve os dois num servidor que roda em UTC erra em algum momento
 * do dia — este projeto já sofreu essa classe de defeito e a documentou em
 * `dayRangeInTimeZone`.
 *
 * Chaves de dia são strings comparáveis por `<`, somáveis por `somarDias`, e
 * não têm hora para dar errado. Quem precisa saber "que dia é hoje" pergunta a
 * `dayRangeInTimeZone().dayKey` UMA vez, na borda, e passa a chave para cá.
 */

import type { Habito, PausaHabito } from "./model";
export type { Habito, PausaHabito, CadenciaHabito } from "./model";
import { diaDaSemana, somarDias, domingoDaSemana } from "./calendar";
export { diaDaSemana, somarDias, segundaDaSemana, diferencaEmDias } from "./calendar";
import { estaPausado } from "./pauses";
export { estaPausado } from "./pauses";
import { estadoDaFrequenciaDe, frequenciaDoDia } from "./frequency-state";
import { resumoDaSequencia } from "./sequences";
import { conferirPeriodoDoDesempenho, desempenhoDoHabito } from "./performance";

/**
 * O hábito era ESPERADO neste dia?
 *
 * ⚠️ `weekly_target` devolve SEMPRE `false` aqui, e não é esquecimento: um
 * hábito de "3× por semana" não é esperado em nenhum dia específico. Perguntar
 * "era esperado na terça?" não tem resposta — a unidade dele é a semana, e quem
 * o avalia é o desempenho agrupado por semana, não esta função.
 *
 * Antes de `started_on` nada é esperado: a regra não valia ainda.
 */
export function eraEsperado(
  habito: Habito,
  dia: string,
  pausas: PausaHabito[] = [],
): boolean {
  if (dia < habito.started_on) return false;
  if (estaPausado(habito.id, dia, pausas)) return false;

  const frequency = frequenciaDoDia(habito, estadoDaFrequenciaDe(habito), dia);
  switch (frequency?.schedule_kind) {
    case "daily":
      return true;
    case "weekdays":
      return frequency.weekdays.includes(diaDaSemana(dia));
    case "weekly_target":
      return false;
    default: return false;
  }
}

/** Eligibility for a NEW entry; a preserved existing entry is handled before this guard. */
export function podeMarcarDia(habit: Habito, day: string, today: string, pauses: PausaHabito[] = []): boolean {
  if (habit.archived_at !== null || day < habit.started_on || day > today || estaPausado(habit.id, day, pauses)) return false;
  const cadence = frequenciaDoDia(habit, estadoDaFrequenciaDe(habit), day);
  return cadence?.schedule_kind === "weekly_target" || eraEsperado(habit, day, pauses);
}

/* ------------------------------------------------------- sequência ------ */

/**
 * ⚠️ A UNIDADE DA SEQUÊNCIA DEPENDE DA CADÊNCIA.
 *
 * Para `daily` e `weekdays` a unidade é o DIA ELEGÍVEL: a caminhada para trás
 * PULA os dias que não eram esperados. Sem isso, um hábito de segunda/quarta/
 * sexta zeraria toda terça-feira — a sequência mediria o calendário em vez do
 * hábito.
 *
 * Para `weekly_target` a unidade é a SEMANA. Contar dias ali diria "sequência
 * de 1" para quem correu três vezes na semana, o que é pior que não mostrar.
 *
 * ============================================================================
 * ⚠️ E O DIA DE HOJE NÃO ZERA A SEQUÊNCIA DE MANHÃ
 * ============================================================================
 * Se hoje é elegível e ainda não foi marcado, a caminhada COMEÇA ONTEM. Sem
 * isso, a sequência de 40 dias apareceria como zero toda manhã até a pessoa
 * marcar — e um número que despenca sozinho todo dia não é usado por ninguém.
 */
export function sequenciaAtual(habito: Habito, feitos: Set<string>, hoje: string, pausas: PausaHabito[] = []): number {
  return resumoDaSequencia(habito, feitos, hoje, pausas).atual;
}

/**
 * Quantas vezes o hábito foi cumprido na semana que começa em `segunda`.
 *
 * ⚠️ ESTÁ EXPORTADA, e a razão é a regra do cabeçalho deste arquivo: a tela de
 * Hábitos precisa deste MESMO número para escrever "2 de 3 esta semana", e
 * enquanto ela não podia importá-lo a conta vivia copiada em `Leitura.tsx`. Duas
 * implementações concordam no dia em que nascem e divergem na primeira correção
 * — exatamente o defeito que este módulo existe para impedir.
 *
 * O primeiro parâmetro é `{ started_on }` e não `Habito` inteiro de propósito:
 * a conta só precisa saber a partir de quando o hábito existe, e pedir o objeto
 * completo obrigaria quem só tem a data a fabricar um hábito falso para chamar.
 *
 * As três regras que ela decide, e que qualquer chamador herda:
 *   1. a semana são os SETE dias a partir de `segunda` (ver `segundaDaSemana`);
 *   2. dia anterior a `started_on` NÃO conta, mesmo que exista marcação;
 *   3. dias futuros dentro da semana entram — eles só não têm marcação ainda.
 */
export function contarNaSemana(
  habito: { started_on: string },
  feitos: Set<string>,
  segunda: string,
): number {
  let n = 0;
  for (let i = 0; i < 7; i++) {
    const dia = somarDias(segunda, i);
    if (dia >= habito.started_on && feitos.has(dia)) n++;
  }
  return n;
}

/* --------------------------------------------------------- resumo ------- */

export interface ResumoDeHabito {
  habito: Habito;
  /** Práticas previstas no recorte; a sequência identifica sua própria unidade. */
  esperados: number;
  cumpridos: number;
  /**
   * ⚠️ EXATO, e é o número que justifica o registro esparso: sai da regra e do
   * que foi marcado, sem depender de nenhum processo ter rodado.
   *
   * Não conta HOJE como falha: o dia ainda não acabou.
   */
  falhas: number;
  /** 0..100, arredondado. `null` quando nada era esperado no período. */
  taxa: number | null;
  sequenciaAtual: number;
  melhorSequencia: number;
  /** Já cumprido hoje? `null` quando hoje não era esperado. */
  hojeFeito: boolean | null;
}

/**
 * O resumo de um hábito num intervalo fechado [de, ate].
 *
 * `ate` costuma ser hoje. O intervalo é fechado dos dois lados porque quem lê
 * "de 01/07 a 31/07" espera os dois dias dentro.
 */
export function resumirHabito(
  habito: Habito,
  feitos: Set<string>,
  de: string,
  ate: string,
  hoje: string,
  pausas: PausaHabito[] = [],
): ResumoDeHabito {
  const state = estadoDaFrequenciaDe(habito);
  const performance = desempenhoDoHabito(habito, feitos, de, ate, hoje, pausas);
  const { esperados, cumpridos } = performance;
  const past = de >= hoje ? { grupos: [] } : desempenhoDoHabito(habito, feitos, de, ate < hoje ? ate : somarDias(hoje, -1), hoje, pausas);
  const falhas = past.grupos.reduce((count, group) => {
    const next = state?.changes.find(row => row.effective_from > group.effective_from);
    const closed = group.schedule_kind !== "weekly_target" || domingoDaSemana(group.week) < hoje || !!next && next.effective_from <= hoje;
    return count + (closed ? group.esperados - group.cumpridos : 0);
  }, 0);
  const sequence = resumoDaSequencia(habito, feitos, hoje, pausas);
  const hojeEsperado = podeMarcarDia(habito, hoje, hoje, pausas);
  return {
    habito,
    esperados,
    cumpridos,
    falhas,
    taxa: esperados === 0 ? null : Math.round((cumpridos / esperados) * 100),
    sequenciaAtual: sequence.atual,
    melhorSequencia: sequence.melhores[sequence.unidade],
    hojeFeito: hojeEsperado ? feitos.has(hoje) : null,
  };
}

/**
 * A maior sequência já alcançada.
 *
 * Percorre de `started_on` até hoje aplicando a mesma regra de elegibilidade —
 * é caro em teoria (um hábito de cinco anos são ~1.800 iterações) e barato na
 * prática, porque roda uma vez por render sobre um array já em memória. Guardar
 * o valor no banco custaria invalidação em todos os gestos desta tela.
 */
export function melhorSequencia(habito: Habito, feitos: Set<string>, hoje: string, pausas: PausaHabito[] = []): number {
  const result = resumoDaSequencia(habito, feitos, hoje, pausas);
  return result.melhores[result.unidade];
}

/* ---------------------------------------------------- mapa de calor ----- */

export interface CelulaDoCalendario {
  dia: string;
  esperado: boolean;
  feito: boolean;
  pausado: boolean;
  futuro: boolean;
}

/**
 * As células dos últimos N dias, para o mapa de calor.
 *
 * Devolve TODOS os dias, inclusive os não esperados — o mapa precisa dos
 * buracos para as colunas ficarem alinhadas por dia da semana. Quem desenha
 * decide o que fazer com `esperado: false`.
 */
export function celulasDoPeriodo(
  habito: Habito,
  feitos: Set<string>,
  hoje: string,
  dias: number,
  pausas: PausaHabito[] = [],
): CelulaDoCalendario[] {
  const celulas: CelulaDoCalendario[] = [];
  for (let i = dias - 1; i >= 0; i--) {
    const dia = somarDias(hoje, -i);
    celulas.push({
      dia,
      esperado: eraEsperado(habito, dia, pausas),
      feito: feitos.has(dia),
      pausado: estaPausado(habito.id, dia, pausas),
      futuro: dia > hoje,
    });
  }
  return celulas;
}

/* ------------------------------------------------- resumo do conjunto --- */

export interface ResumoDosHabitos {
  /** Quantos hábitos eram esperados hoje e já foram cumpridos. */
  hojeFeitos: number;
  hojeEsperados: number;
  /** Soma no período. */
  cumpridos: number;
  esperados: number;
  falhas: number;
  taxa: number | null;
  porHabito: ResumoDeHabito[];
}

/**
 * O resumo do conjunto — é o que a tela e o E-MAIL consomem.
 *
 * `feitosPorHabito` chega como Map de Sets para a busca ser O(1): a alternativa
 * (`array.some()` por dia) faria um hábito de cinco anos custar milhões de
 * comparações no render.
 */
export function resumirHabitos(
  habitos: Habito[],
  feitosPorHabito: Map<string, Set<string>>,
  de: string,
  ate: string,
  hoje: string,
  pausas: PausaHabito[] = [],
): ResumoDosHabitos {
  conferirPeriodoDoDesempenho(de, ate, hoje);
  const porHabito = habitos
    .filter((h) => h.archived_at === null)
    .map((h) => resumirHabito(h, feitosPorHabito.get(h.id) ?? new Set(), de, ate, hoje, pausas));

  let hojeFeitos = 0;
  let hojeEsperados = 0;
  let falhas = 0;

  for (const r of porHabito) {
    if (r.hojeFeito !== null) {
      hojeEsperados++;
      if (r.hojeFeito) hojeFeitos++;
    }
    falhas += r.falhas;
  }
  const cumpridos = porHabito.reduce((n, row) => n + row.cumpridos, 0), esperados = porHabito.reduce((n, row) => n + row.esperados, 0);

  return {
    hojeFeitos,
    hojeEsperados,
    cumpridos,
    esperados,
    falhas,
    taxa: esperados === 0 ? null : Math.round((cumpridos / esperados) * 100),
    porHabito,
  };
}
