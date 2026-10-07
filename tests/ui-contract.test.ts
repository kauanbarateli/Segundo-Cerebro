import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const lint = new ESLint();
const forbidden = async (code: string, filePath = "src/components/features/example.tsx") => {
  const result = await lint.lintText(code, { filePath });
  return result.flatMap((file) => file.messages).filter((message) => message.ruleId === "no-restricted-syntax");
};

describe("contrato do campo compartilhado", () => {
  it.each(["input", "textarea", "select"])("recusa %s nativo fora do Field", async (tag) => {
    expect(await forbidden(`export function Example() { return <${tag} aria-label="Exemplo" />; }`)).toHaveLength(1);
  });
  it("recusa a constante paralela inputCls do legado", async () => {
    expect(await forbidden('export const inputCls = "campo-paralelo";')).toHaveLength(1);
  });
  it("permite compor uma tela com o Field", async () => {
    expect(await forbidden('import { Field } from "@/components/ui/field"; export function Example() { return <Field label="Título" />; }')).toEqual([]);
  });
  it("permite elementos nativos dentro da implementação única do Field", async () => {
    expect(await forbidden('export function Field() { return <input aria-label="Título" />; }', "src/components/ui/field.tsx")).toEqual([]);
  });
});
