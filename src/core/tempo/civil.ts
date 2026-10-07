/** Construção UTC sem a conversão implícita de anos 0..99 para 1900..1999. */
export function utcCivil(ano: number, mes: number, dia: number, hora = 0, minuto = 0, segundo = 0): number {
  const date = new Date(0);
  date.setUTCFullYear(ano, mes - 1, dia);
  date.setUTCHours(hora, minuto, segundo, 0);
  return date.getTime();
}

export interface ParedeCivil {
  ano: number;
  mes: number;
  dia: number;
  hora: number;
  minuto: number;
  segundo: number;
}

const formatos = new Map<string, Intl.DateTimeFormat>();

export function paredeNoFuso(instante: number, fuso: string): ParedeCivil {
  let formato = formatos.get(fuso);
  if (!formato) {
    formato = new Intl.DateTimeFormat("en-US", {
      timeZone: fuso, calendar: "iso8601", numberingSystem: "latn", hourCycle: "h23",
      era: "short", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
    formatos.set(fuso, formato);
  }
  const partes = formato.formatToParts(new Date(instante));
  const campo = (tipo: string) => partes.find((parte) => parte.type === tipo)?.value ?? "";
  const ano = Number(campo("year"));
  return {
    ano: campo("era") === "BC" ? 1 - ano : ano,
    mes: Number(campo("month")), dia: Number(campo("day")),
    hora: Number(campo("hour")) % 24, minuto: Number(campo("minute")), segundo: Number(campo("second")),
  };
}

function paredeComoUtc(instante: number, fuso: string): number {
  const p = paredeNoFuso(instante, fuso);
  return utcCivil(p.ano, p.mes, p.dia, p.hora, p.minuto, p.segundo);
}

function deslocamento(instante: number, fuso: string): number {
  // Intl aqui expõe segundos; manter ambos os lados na mesma precisão.
  return paredeComoUtc(instante, fuso) - Math.floor(instante / 1_000) * 1_000;
}

/**
 * Política compatible: primeira ocorrência quando o relógio repete; avanço pela
 * duração do salto quando não existe. A janela cobre também saltos IANA de um
 * dia inteiro, sem depender do fuso do processo nem de um offset fixo.
 * Para uma data civil sem hora, inícioDoDia encontra o primeiro instante válido
 * a partir da meia-noite, mesmo quando a transição pula a própria meia-noite.
 */
export function resolverParede(p: ParedeCivil, fuso: string, inicioDoDia = false): number {
  const parede = utcCivil(p.ano, p.mes, p.dia, p.hora, p.minuto, p.segundo);
  const offsets = new Set<number>();
  const horaMs = 3_600_000;
  for (let horas = -48; horas <= 48; horas += 12) offsets.add(deslocamento(parede + horas * horaMs, fuso));
  const candidatos = [...offsets].map((offset) => {
    const instante = parede - offset;
    return { instante, local: paredeComoUtc(instante, fuso) };
  });
  const exatos = candidatos.filter((candidato) => candidato.local === parede);
  if (exatos.length) return Math.min(...exatos.map((candidato) => candidato.instante));

  const depois = candidatos.filter((candidato) => candidato.local > parede)
    .sort((a, b) => a.local - b.local || a.instante - b.instante)[0];
  const antes = candidatos.filter((candidato) => candidato.local < parede)
    .sort((a, b) => b.local - a.local || b.instante - a.instante)[0];
  if (!depois || !antes) throw new RangeError("Não foi possível resolver o horário civil neste fuso.");
  if (!inicioDoDia) return depois.instante;

  // No intervalo do salto, localizar a borda exata evita lacunas entre dias.
  let esquerda = antes.instante;
  let direita = depois.instante;
  while (direita - esquerda > 1) {
    const meio = esquerda + Math.floor((direita - esquerda) / 2);
    if (paredeComoUtc(meio, fuso) < parede) esquerda = meio;
    else direita = meio;
  }
  return direita;
}

export function chaveCivil(p: Pick<ParedeCivil, "ano" | "mes" | "dia">): string {
  return `${String(p.ano).padStart(4, "0")}-${String(p.mes).padStart(2, "0")}-${String(p.dia).padStart(2, "0")}`;
}
