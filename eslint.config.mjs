import { FlatCompat } from "@eslint/eslintrc";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const config = [
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts", "docs/**", ".agents/**", ".claude/**", "tests/fixtures/**", "playwright-report/**", "test-results/**", "public/sw.js", "public/swe-worker*.js"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/components/ui/field.tsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        { selector: "JSXOpeningElement[name.name=/^(input|textarea|select)$/]", message: "Use o Field compartilhado para manter label, erro, tipografia e estados consistentes." },
        { selector: "VariableDeclarator[id.name=/^(inputCls|textareaCls|selectCls)$/]", message: "Não duplique estilos de campo; componha o Field compartilhado." },
      ],
    },
  },
];

export default config;
