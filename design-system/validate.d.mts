export interface TokenSet {
  color: Record<"light" | "dark", Record<string, string>>;
  typography: { family: string; scale: Record<string, { fontSize: string; mobileFontSize?: string; lineHeight: string; fontWeight: string; letterSpacing: string; status: string }> };
  radius: Record<string, string>;
  spacing: Record<string, string>;
  motion: Record<string, string>;
  shadow: Record<"light" | "dark", Record<string, string>>;
  zIndex: Record<string, number>;
  control: Record<string, string>;
}
export interface ContrastMeasurement { theme: string; foreground: string; background: string; floor: number; ratio: number }
export const backgrounds: string[];
export const textColors: string[];
export function renderTokensCss(tokens: TokenSet): string;
export function contrastRatio(first: string, second: string): number;
export function measureContrasts(tokens: TokenSet): ContrastMeasurement[];
export function validateTokens(tokens: TokenSet, css: string): { failures: string[]; measurements: ContrastMeasurement[] };
export function findRawValues(source: string): string[];
export function validateRuntime(projectRoot: string): Promise<string[]>;
