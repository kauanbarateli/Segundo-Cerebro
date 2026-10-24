import { describe, expect, it } from "vitest";
import { parseGoalJson } from "../../src/lib/finance-goals-json";

describe("pure Goals JSON text scan", () => {
  it("preserves native JSON values and escaping without normalization", () => {
    for (const value of [null, true, 123, [1, false, null], { name: 'ç e\u0301 😀 { [ \\ " \n\u0000\ud800', nested: { value: -1.5e3 } }]) {
      const text = JSON.stringify(value); expect(parseGoalJson(text, { maxDepth: 6, maxProperties: 64 })).toEqual(JSON.parse(text));
    }
  });
  it.each(['{"binding":1,"binding":2}', '{"binding":1,"\\u0062inding":2}', '{"result":{"version":1,"\\u0076ersion":2}}', '{"a":[{"client_id":1,"client\\u005fid":2}]}', '{"__proto__":1,"\\u005f_proto__":2}'])
    ("refuses duplicate decoded property names: %s", text => expect(() => parseGoalJson(text, { maxDepth: 6, maxProperties: 64 })).toThrow("GOAL_JSON_REFUSED"));
  it("counts properties across objects, with separate explicit V1 and terminal limits", () => {
    const fields = (count: number) => JSON.stringify(Object.fromEntries(Array.from({ length: count }, (_, index) => ["p" + index, index])));
    expect(() => parseGoalJson(fields(32), { maxDepth: 4, maxProperties: 32 })).not.toThrow();
    expect(() => parseGoalJson(fields(33), { maxDepth: 4, maxProperties: 32 })).toThrow();
    expect(() => parseGoalJson(fields(64), { maxDepth: 6, maxProperties: 64 })).not.toThrow();
    expect(() => parseGoalJson(fields(65), { maxDepth: 6, maxProperties: 64 })).toThrow();
    expect(() => parseGoalJson('{"a":{"b":0},"c":{"d":0}}', { maxDepth: 3, maxProperties: 3 })).toThrow();
  });
  it("bounds container depth without mistaking brackets in a string for structure", () => {
    const nested = (count: number) => "[".repeat(count) + '"[[[[{"' + "]".repeat(count);
    expect(() => parseGoalJson(nested(4), { maxDepth: 4, maxProperties: 32 })).not.toThrow();
    expect(() => parseGoalJson(nested(5), { maxDepth: 4, maxProperties: 32 })).toThrow();
    expect(() => parseGoalJson(nested(6), { maxDepth: 6, maxProperties: 64 })).not.toThrow();
    expect(() => parseGoalJson(nested(7), { maxDepth: 6, maxProperties: 64 })).toThrow();
  });
  it.each(["", " ", "{", "[1,]", "null false", '{"x":NaN}', '{"x":"\\u00xz"}'])
    ("leaves syntax to native JSON but never echoes invalid content", text => expect(() => parseGoalJson(text, { maxDepth: 6, maxProperties: 64 })).toThrow("GOAL_JSON_REFUSED"));
  it.each([{ maxDepth: 0, maxProperties: 64 }, { maxDepth: 65, maxProperties: 64 }, { maxDepth: 6, maxProperties: 0 }, { maxDepth: 6, maxProperties: 4097 }, { maxDepth: 1.5, maxProperties: 64 }])
    ("refuses unusable scanner bounds", limits => expect(() => parseGoalJson("{}", limits)).toThrow());
});
