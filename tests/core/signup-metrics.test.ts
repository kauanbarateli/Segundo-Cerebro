import { describe, expect, it } from "vitest";
import { prepareOriginDistribution } from "../../src/core/acquisition/signup-metrics";

describe("distribuição agregada de origens", () => {
  it("mantém a população completa e reúne grupos pequenos sem expor valores", () => {
    expect(prepareOriginDistribution(17, [{ value: "busca", count: 7 }, { value: null, count: 5 }, { value: "campanha privada", count: 3 }, { value: "outra", count: 2 }])).toEqual([
      { kind: "value", value: "busca", count: 7 }, { kind: "not-informed", value: null, count: 5 }, { kind: "other", value: null, count: 5 },
    ]);
  });
  it("não confunde origem não informada com tráfego direto ou um valor chamado Outros", () => {
    expect(prepareOriginDistribution(10, [{ value: null, count: 5 }, { value: "Outros", count: 5 }])).toEqual([{ kind: "not-informed", value: null, count: 5 }, { kind: "value", value: "Outros", count: 5 }]);
    expect(prepareOriginDistribution(0, [])).toEqual([]);
  });
  it("recusa populações incompletas, duplicadas ou com contagens inválidas", () => {
    expect(prepareOriginDistribution(6, [{ value: "a", count: 5 }])).toBeNull();
    expect(prepareOriginDistribution(4, [{ value: "a", count: 5 }])).toBeNull();
    expect(prepareOriginDistribution(10, [{ value: "a", count: 5 }, { value: "a", count: 5 }])).toBeNull();
    expect(prepareOriginDistribution(1, [{ value: "a", count: -1 }])).toBeNull();
    expect(prepareOriginDistribution(5, [{ value: "<script>", count: 5 }])).toBeNull();
  });
  it("recusa cardinalidade ilimitada e não supõe anonimato", () => {
    expect(prepareOriginDistribution(501, Array.from({ length: 501 }, (_, index) => ({ value: String(index), count: 1 })))).toBeNull();
    expect(prepareOriginDistribution(Number.MAX_SAFE_INTEGER + 1, [])).toBeNull();
  });
});
