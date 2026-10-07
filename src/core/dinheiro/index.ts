/** Portado de segundo_cerebro@ffdf064, src/lib/utils.ts; sem dependências. */

function monetaryParts(cents: number) {
  if (!Number.isSafeInteger(cents)) throw new RangeError("Valor monetário deve ser um inteiro seguro em centavos.");
  const negative = cents < 0;
  const absolute = BigInt(negative ? -cents : cents);
  return { negative, whole: absolute / 100n, fraction: String(absolute % 100n).padStart(2, "0") };
}

/** Valores de domínio trafegam como inteiros seguros em centavos. */
export function formatBRL(cents: number, opts?: { hidden?: boolean }): string {
  if (opts?.hidden) return "R$ ••••";
  const { negative, whole, fraction } = monetaryParts(cents);
  const signedWhole = negative ? whole === 0n ? -0 : -whole : whole;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
    .formatToParts(signedWhole)
    .map((part) => part.type === "fraction" ? fraction : part.value)
    .join("");
}

export function formatCentsPlain(cents: number): string {
  const { negative, whole, fraction } = monetaryParts(cents);
  return `${negative ? "-" : ""}${whole},${fraction}`;
}

/**
 * Aceita os formatos pt-BR/decimal do legado e devolve centavos inteiros seguros.
 * O último separador decide os decimais. Casas extras arredondam ao centavo mais
 * próximo, com empates em direção a +infinito (mesmo contrato de Math.round).
 * A conversão textual usa inteiros: "1,005" não perde centavo por ponto flutuante.
 */
export function parseBRLToCents(input: string): number | null {
  const cleaned = input.replace(/[^\d,.-]/g, "").trim();
  if (!cleaned) return null;

  let normalized = cleaned;
  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  if (lastComma > lastDot) normalized = cleaned.replace(/\./g, "").replace(",", ".");
  else if (lastDot > lastComma) normalized = cleaned.replace(/,/g, "");

  const match = /^(-?)(\d*)(?:\.(\d*))?$/.exec(normalized);
  if (!match || !/\d/.test(normalized)) return null;
  const negative = match[1] === "-";
  const whole = (match[2] || "0").replace(/^0+(?=\d)/, "");
  const fraction = match[3] ?? "";
  if (whole.length > 14) return null;

  let cents = BigInt(whole) * 100n + BigInt(fraction.slice(0, 2).padEnd(2, "0"));
  const nextDigit = fraction[2] ?? "0";
  const roundMagnitudeUp = negative
    ? nextDigit > "5" || (nextDigit === "5" && /[1-9]/.test(fraction.slice(3)))
    : nextDigit >= "5";
  if (roundMagnitudeUp) cents += 1n;
  if (cents > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  if (cents === 0n) return 0;
  return Number(negative ? -cents : cents);
}
