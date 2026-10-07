import { expect, test } from "@playwright/test";
import { createHash } from "node:crypto";
import { THEME_INIT_SCRIPT } from "../../src/lib/theme";

test.use({ serviceWorkers: "block" });

test("CSP bloqueia scripts estranhos e preserva tema e hidratação", async ({ page, request }) => {
  await page.addInitScript(() => {
    (window as typeof window & { cspViolations: string[] }).cspViolations = [];
    document.addEventListener("securitypolicyviolation", (event) => {
      (window as typeof window & { cspViolations: string[] }).cspViolations.push(event.violatedDirective);
    });
  });
  await page.addInitScript(() => localStorage.setItem("segundo-cerebro-theme", "dark"));
  const response = await page.goto("/financeiro");
  const csp = response!.headers()["content-security-policy"]!;
  const hash = createHash("sha256").update(THEME_INIT_SCRIPT).digest("base64");
  expect(csp).toContain(`'sha256-${hash}'`);
  expect(response!.headers()["content-security-policy-report-only"]).toBeUndefined();
  expect(response!.headers()["cache-control"]).toContain("no-store");
  const nonce = /'nonce-([^']+)'/.exec(csp)![1];
  const second = await request.get("/financeiro", { headers: { "x-nonce": "attacker", "Content-Security-Policy": "script-src * 'unsafe-inline'" } });
  expect(second.headers()["content-security-policy"]).not.toContain(`'nonce-${nonce}'`);
  expect(second.headers()["content-security-policy"]).not.toContain("attacker");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("heading", { name: "Financeiro", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Ocultar valores", exact: true }).click();
  await expect(page.getByRole("button", { name: "Exibir valores", exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as typeof window & { cspViolations: string[] }).cspViolations)).toEqual([]);
  // Inject into the HTTP document, not through DevTools evaluation: the latter
  // is privileged browser instrumentation and is not evidence of CSP blocking.
  await page.route("**/financeiro?csp-probe=*", async (route) => {
    const original = await route.fetch();
    const body = (await original.text()).replace("</head>", "<script>window.cspProbe=true</script></head>");
    const headers = original.headers();
    if (route.request().url().endsWith("=control")) delete headers["content-security-policy"];
    await route.fulfill({ response: original, body, headers });
  });
  await page.goto("/financeiro?csp-probe=blocked");
  expect(await page.evaluate(() => (window as typeof window & { cspProbe?: boolean }).cspProbe)).toBeUndefined();
  expect(await page.evaluate(() => (window as typeof window & { cspViolations: string[] }).cspViolations)).toContain("script-src-elem");
  // Positive control proves that the injected code actually executes without CSP.
  await page.goto("/financeiro?csp-probe=control");
  expect(await page.evaluate(() => (window as typeof window & { cspProbe?: boolean }).cspProbe)).toBe(true);
});
