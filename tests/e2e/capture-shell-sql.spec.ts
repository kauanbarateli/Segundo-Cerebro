/** Current UI + WorkspaceShell + original connected client/Core/Store/SQL.
 * This is a synthetic, current-only acceptance slice, not hosted Auth/Storage,
 * a physical phone, a new product layout or an update of the historical B/P/C.
 */
import { expect, test, type BrowserContext, type Locator, type Page, type TestInfo } from "@playwright/test";
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import type { Captura } from "../../src/core/capturas";
import { inspectVisualGuards } from "./helpers/visual-guards";
import {
  prepareCaptureShellFixture, createCaptureShellSql, attachCaptureShell, startCaptureShell,
  captureShellOwner, captureShellSession, captureShellSeedSession,
} from "./helpers/capture-shell-sql";

test.describe.configure({ retries: 0 });
test.beforeAll(prepareCaptureShellFixture);

/** Observation only: no focus(), scrollIntoView(), style/CSS zoom or PM commands. */
async function controlGeometry(control: Locator) {
  return control.evaluate(async element => {
    await Promise.allSettled(document.getAnimations().filter(animation => Number.isFinite(animation.effect?.getComputedTiming().endTime ?? Infinity)).map(animation => animation.finished));
    const rect = element.getBoundingClientRect(), viewport = window.visualViewport;
    const bounds = { left: viewport?.offsetLeft ?? 0, top: viewport?.offsetTop ?? 0,
      right: (viewport?.offsetLeft ?? 0) + (viewport?.width ?? innerWidth), bottom: (viewport?.offsetTop ?? 0) + (viewport?.height ?? innerHeight) };
    const plain = (box: DOMRect) => ({ left: box.left, top: box.top, right: box.right, bottom: box.bottom, width: box.width, height: box.height });
    const modal = element.closest("dialog:modal, [role='dialog'][aria-modal='true']");
    const chrome = [...document.querySelectorAll<HTMLElement>(".shell-topbar, .shell-bottom")]
      .filter(item => !modal && !item.contains(element) && item.getClientRects().length && getComputedStyle(item).visibility !== "hidden")
      .map(item => ({ name: item.className, ...plain(item.getBoundingClientRect()) }));
    const overlap = chrome.filter(box => Math.min(box.right, rect.right) - Math.max(box.left, rect.left) > 0.5
      && Math.min(box.bottom, rect.bottom) - Math.max(box.top, rect.top) > 0.5);
    const x = rect.left + rect.width / 2, y = rect.top + rect.height / 2, hit = document.elementFromPoint(x, y);
    const style = getComputedStyle(element);
    return { rect: plain(rect), bounds, chrome, overlap, hitOwn: !!hit && (hit === element || element.contains(hit)),
      inside: rect.left >= bounds.left - 0.5 && rect.right <= bounds.right + 0.5 && rect.top >= bounds.top - 0.5 && rect.bottom <= bounds.bottom + 0.5,
      focused: document.hasFocus() && document.activeElement === element, focusVisible: element.matches(":focus-visible"),
      outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth, boxShadow: style.boxShadow,
      field: element.matches('input, select, textarea, [contenteditable="true"]'), fontSize: parseFloat(style.fontSize),
      inert: !!element.closest("[inert], [hidden]"), scrollY };
  });
}
type Geometry = Awaited<ReturnType<typeof controlGeometry>>;
function assertReachable(value: Geometry) {
  expect(value.inert).toBe(false); expect(value.inside).toBe(true); expect(value.overlap).toEqual([]); expect(value.hitOwn).toBe(true);
  expect(value.rect.width).toBeGreaterThanOrEqual(44); expect(value.rect.height).toBeGreaterThanOrEqual(44);
  if (value.field) expect(value.fontSize).toBeGreaterThanOrEqual(16);
}

/** Wheel is a deliberate human action. A bounded failure remains a failure;
 * it does not hide bars, move focus, scroll a DOM node or change page styles. */
async function wheelTo(page: Page, control: Locator) {
  for (let step = 0; step < 12; step++) {
    const value = await controlGeometry(control);
    if (value.inside && !value.overlap.length && value.hitOwn) { assertReachable(value); return value; }
    const middle = (value.rect.top + value.rect.bottom) / 2, desired = (value.bounds.top + value.bounds.bottom) / 2;
    const delta = (middle >= desired ? 1 : -1) * Math.min(420, Math.max(100, Math.abs(middle - desired)));
    const before = await page.evaluate(() => scrollY);
    await page.mouse.move(Math.max(1, value.bounds.right - 24), desired); await page.mouse.wheel(0, delta);
    await expect.poll(() => page.evaluate(() => scrollY)).not.toBe(before);
  }
  assertReachable(await controlGeometry(control));
  throw new Error("Control was not reachable through the bounded wheel journey.");
}
async function tabTo(page: Page, control: Locator) {
  for (let step = 0; step < 48; step++) {
    if (await control.evaluate(element => document.activeElement === element)) {
      const value = await controlGeometry(control); assertReachable(value); expect(value.focused).toBe(true); expect(value.focusVisible).toBe(true);
      expect(value.outlineStyle !== "none" && parseFloat(value.outlineWidth) > 0 || value.boxShadow !== "none").toBe(true);
      return value;
    }
    await page.keyboard.press("Tab");
  }
  await expect(control).toBeFocused();
  throw new Error("Principal control was not reached by the bounded native Tab journey.");
}
interface SelectionObservation {
  focused: boolean; ownText: boolean; anchorOffset: number | undefined; focusOffset: number | undefined; collapsed: boolean | undefined;
  range: { top: number; bottom: number; left: number; right: number } | null;
}
async function selectionOf(editor: Locator): Promise<SelectionObservation> {
  return editor.evaluate(element => new Promise<SelectionObservation>(resolve => requestAnimationFrame(() => {
    const current = document.getSelection(), anchor = current?.anchorNode, focus = current?.focusNode;
    const range = current?.rangeCount ? current.getRangeAt(0).getBoundingClientRect() : null;
    resolve({ focused: document.hasFocus() && document.activeElement === element,
      ownText: !!anchor && anchor === focus && anchor.nodeType === Node.TEXT_NODE && element.contains(anchor) && anchor.textContent === "Antes depois",
      anchorOffset: current?.anchorOffset, focusOffset: current?.focusOffset, collapsed: current?.isCollapsed,
      range: range ? { top: range.top, bottom: range.bottom, left: range.left, right: range.right } : null });
  })));
}
function assertSelectionVisible(selection: SelectionObservation, geometry: Geometry) {
  expect(selection.focused).toBe(true); expect(selection.range).not.toBeNull();
  if (!selection.range) throw new Error("The real editor selection has no rendered range.");
  const range = selection.range;
  expect(range.bottom).toBeGreaterThan(range.top); expect(range.left).toBeGreaterThanOrEqual(geometry.bounds.left);
  expect(range.right).toBeLessThanOrEqual(geometry.bounds.right); expect(range.top).toBeGreaterThanOrEqual(geometry.bounds.top);
  expect(range.bottom).toBeLessThanOrEqual(geometry.bounds.bottom);
  expect(geometry.chrome.filter(box => range.left >= box.left && range.left <= box.right
    && Math.min(range.bottom, box.bottom) - Math.max(range.top, box.top) > 0.5)).toEqual([]);
}
async function evidence(page: Page, info: TestInfo, name: string, observations: unknown) {
  const image = await page.screenshot({ fullPage: false, caret: "initial" });
  const path = info.outputPath(name + ".png"); await writeFile(path, image); await info.attach(name, { path, contentType: "image/png" });
  return { name: name + ".png", bytes: image.length, sha256: createHash("sha256").update(image).digest("hex"), observations };
}

for (const width of [320, 390, 768]) for (const theme of ["light", "dark"] as const) for (const selectionLength of [0, 3]) {
  test("Capture shell " + width + " " + theme + " — keyboard, selection " + selectionLength + ", two references and SQL", async ({ browser }, info) => {
    const fixture = await createCaptureShellSql();
    const height = width === 320 ? 720 : width === 390 ? 844 : 900;
    const reducedMotion = width === 768 ? "no-preference" : "reduce";
    let context: BrowserContext | undefined;
    try {
      context = await browser.newContext({ viewport: { width, height }, colorScheme: theme, reducedMotion, timezoneId: "UTC", locale: "pt-BR" });
      await context.addInitScript(value => localStorage.setItem("segundo-cerebro-theme", value), theme);
      const destination = await fixture.command({ command: "capture.create", input: { client_id: "shell-related", type: "note", title: "Destino SQL", content: "Destino de teste", category_id: null, project_id: null } }, captureShellSeedSession) as Captura;
      const next = await fixture.command({ command: "capture.create", input: { client_id: "shell-related-next", type: "note", title: "Segundo SQL", content: "Outro destino", category_id: null, project_id: null } }, captureShellSeedSession) as Captura;
      const trace = await attachCaptureShell(context, fixture, captureShellSession), page = await context.newPage();
      await startCaptureShell(page); await page.bringToFront();
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await expect(page.locator(".workspace-shell")).toBeVisible(); await expect(page.locator("main")).toHaveCount(1);
      if (width < 601) await expect(page.getByRole("navigation", { name: "Navegação no celular", exact: true })).toBeVisible();
      else await expect(page.locator(".shell-sidebar")).toBeVisible();
      const artifacts: Awaited<ReturnType<typeof evidence>>[] = [];
      if (width < 601) {
        const opener = page.getByRole("button", { name: "Abrir navegação", exact: true }); assertReachable(await controlGeometry(opener));
        await opener.click(); const navigation = page.getByRole("dialog", { name: "Menu de navegação", exact: true });
        await expect(navigation).toBeVisible(); await expect(page.locator(".shell-workspace")).toHaveJSProperty("inert", true);
        const close = navigation.getByRole("button", { name: "Fechar navegação", exact: true }); await expect(close).toBeFocused();
        await page.keyboard.press("Tab"); expect(await navigation.evaluate(element => element.contains(document.activeElement))).toBe(true);
        if (selectionLength === 0) artifacts.push(await evidence(page, info, "shell-menu", { close: await controlGeometry(close) }));
        await page.keyboard.press("Escape"); await expect(opener).toBeFocused(); await expect(page.locator(".shell-workspace")).toHaveJSProperty("inert", false);
        assertReachable(await controlGeometry(opener));
      }
      const title = page.getByLabel("Título da nota", { exact: true }), editor = page.getByRole("textbox", { name: "Sua anotação", exact: true });
      const linkButton = page.getByRole("button", { name: "Vincular nota", exact: true });
      await wheelTo(page, title);
      // Material negative for the new hit-test, then exact removal before any
      // action/evidence. The test never patches product CSS or detector results.
      if (width === 320 && theme === "light" && selectionLength === 0) {
        await title.evaluate(element => {
          const box = element.getBoundingClientRect(), cover = document.createElement("div"); cover.id = "shell-test-cover";
          Object.assign(cover.style, { position: "fixed", left: box.left + "px", top: box.top + "px", width: box.width + "px", height: box.height + "px", zIndex: "2147483647", pointerEvents: "auto" }); document.body.append(cover);
        });
        try { expect((await controlGeometry(title)).hitOwn).toBe(false); }
        finally { await page.locator("#shell-test-cover").evaluate(element => element.remove()); }
        assertReachable(await controlGeometry(title));
      }
      await page.bringToFront(); await title.click(); await page.keyboard.type("Nota do shell");
      const linkKeyboard = await tabTo(page, linkButton); await page.keyboard.press("Enter");
      const dialog = page.getByRole("dialog", { name: "Vincular a outra nota", exact: true });
      const search = dialog.getByRole("searchbox", { name: "Buscar nota para vincular", exact: true });
      await expect(search).toBeFocused(); assertReachable(await controlGeometry(search));
      const firstCandidate = dialog.getByRole("button", { name: destination.title!, exact: true }); await tabTo(page, firstCandidate);
      artifacts.push(await evidence(page, info, "modal-keyboard", { linkKeyboard, search: await controlGeometry(search), candidate: await controlGeometry(firstCandidate) }));
      await page.keyboard.press("Escape"); await expect(dialog).toHaveCount(0); await expect(linkButton).toBeFocused();
      assertReachable(await controlGeometry(linkButton));

      await wheelTo(page, editor); await page.bringToFront(); await editor.click(); await expect(editor).toBeFocused();
      await page.keyboard.press("ControlOrMeta+k"); const address = page.getByRole("textbox", { name: "Endereço do link", exact: true });
      await expect(address).toBeFocused(); assertReachable(await controlGeometry(address)); await expect(page.getByRole("dialog")).toHaveCount(0);
      await page.keyboard.press("Escape"); await expect(address).toHaveCount(0); await expect(editor).toBeFocused();
      await expect(editor).toHaveText(""); await editor.pressSequentially("Antes depois");
      await expect(editor).toHaveText("Antes depois"); await expect(page.locator(".capture-toolbar > span")).toHaveText("2 palavras · 0 conexões");
      const at = (anchorOffset: number, focusOffset = anchorOffset) => ({ focused: true, ownText: true, anchorOffset, focusOffset, collapsed: anchorOffset === focusOffset });
      await expect.poll(selectionOf.bind(null, editor)).toMatchObject(at(12));
      for (let count = 0; count < 6; count++) { await page.keyboard.press("ArrowLeft"); await expect.poll(selectionOf.bind(null, editor)).toMatchObject(at(11 - count)); }
      for (let count = 0; count < selectionLength; count++) { await page.keyboard.press("Shift+ArrowRight"); await expect.poll(selectionOf.bind(null, editor)).toMatchObject(at(6, 7 + count)); }
      const selected = await selectionOf(editor);
      const editorGeometry = await controlGeometry(editor); assertSelectionVisible(selected, editorGeometry);
      artifacts.push(await evidence(page, info, "editor-selection", { geometry: editorGeometry, selection: selected }));
      for (const target of [destination, next]) {
        await wheelTo(page, linkButton); await linkButton.click(); await expect(search).toBeFocused(); assertReachable(await controlGeometry(search));
        const candidate = dialog.getByRole("button", { name: target.title!, exact: true }); assertReachable(await controlGeometry(candidate)); await candidate.click(); await expect(dialog).toHaveCount(0);
        await expect(editor.locator('a[data-capture-link="' + target.id + '"]')).toHaveText(target.title!);
        await expect(editor).toBeFocused();
      }
      const suffix = "depois".slice(selectionLength);
      await expect(editor).toHaveText("Antes Destino SQLSegundo SQL" + suffix);
      // Real Tab lets the browser scroll the focused save action. Do not wheel
      // or force focus afterward: a covered keyboard target fails this gate.
      const save = page.getByRole("button", { name: "Salvar nota", exact: true }); const saveKeyboard = await tabTo(page, save);
      artifacts.push(await evidence(page, info, "save-keyboard", { saveKeyboard })); await page.keyboard.press("Enter");
      await expect(page.getByText("Salva na sua conta", { exact: true })).toBeVisible();
      const rows = (await fixture.db.query<{ payload: Captura }>("select payload from public.captures where user_id=$1 and payload->>'title'=$2", [captureShellOwner, "Nota do shell"])).rows;
      expect(rows).toHaveLength(1); const saved = rows[0]!.payload;
      expect(saved.document_version).toBe(1); expect(saved.linked_capture_ids).toEqual([destination.id, next.id]);
      expect(saved.document?.content[0]?.content).toEqual([{ type: "text", text: "Antes " }, { type: "captureLink", attrs: { target_id: destination.id, alias: destination.title } }, { type: "captureLink", attrs: { target_id: next.id, alias: next.title } }, { type: "text", text: suffix }]);
      expect((await fixture.db.query("select entity_id,action,before,after from public.domain_events where user_id=$1 and entity_type='capture' and entity_id=$2", [captureShellOwner, saved.id])).rows)
        .toEqual([{ entity_id: saved.id, action: "created", before: null, after: saved }]);
      expect((await fixture.db.query("select result from app_private.command_receipts where user_id=$1 and command='capture.create' and client_id=$2", [captureShellOwner, saved.client_id])).rows).toEqual([{ result: saved }]);
      const committed = await fixture.ledger(); await startCaptureShell(page, null);
      await expect(page.getByLabel("Título da nota", { exact: true })).toHaveValue("Nota do shell");
      await expect(page.getByRole("textbox", { name: "Sua anotação", exact: true })).toHaveText("Antes Destino SQLSegundo SQL" + suffix);
      expect(await fixture.ledger()).toEqual(committed);
      expect(trace.writes).toHaveLength(1); expect(trace.unexpected).toEqual([]); expect(trace.pageErrors).toEqual([]);
      const guards = await inspectVisualGuards(page); expect(guards.overflow).toEqual([]); expect(guards.fields).toEqual([]);
      const report = { schemaVersion: 1, scenario: "capture-shell-synthetic", acceptance: false, sourceSha: process.env.GITHUB_SHA ?? null,
        browser: browser.version(), viewport: { width, height }, theme, reducedMotion, selectionLength, artifacts, guards,
        sql: { savedId: saved.id, documentVersion: saved.document_version, writes: trace.writes.length, reloadPreservedFullLedger: true },
        limitations: ["Synthetic Auth/policy/Next/HTTP seams; no hosted or physical-device acceptance.", "No Storage, promotion, production HTTPS/cookies, virtual keyboard or zoom200 acceptance.", "Historical B/P/C fixtures and original CAS/replay oracles remain unchanged."] };
      const reportPath = info.outputPath("capture-shell-report.json"); await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n");
      await info.attach("capture-shell-report", { path: reportPath, contentType: "application/json" });
    } finally { try { await context?.close(); } finally { await fixture.db.close(); } }
  });
}
