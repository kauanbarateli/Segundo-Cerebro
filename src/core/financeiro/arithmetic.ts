/** Internal guards: public monetary contracts remain safe integer numbers. */
export function centavosSeguros(value: number, label: string): number {
  if (!Number.isSafeInteger(value)) throw new RangeError(`${label} deve ser inteiro seguro em centavos.`);
  return value;
}

/** Check the final result, after all signed movements have been accumulated. */
export function totalExato(value: bigint, label: string): number {
  const limit = BigInt(Number.MAX_SAFE_INTEGER);
  if (value > limit || value < -limit) throw new RangeError(`${label} excede o intervalo seguro em centavos.`);
  return Number(value);
}
