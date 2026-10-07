import type { Page } from "@playwright/test";

export interface VisualFinding {
  selector: string;
  reason: string;
  width?: number;
  height?: number;
  fontSize?: number;
}

export interface VisualReport {
  url: string;
  viewportWidth: number;
  documentWidth: number;
  inspectedTargets: number;
  inspectedFields: number;
  overflow: VisualFinding[];
  targets: VisualFinding[];
  fields: VisualFinding[];
}

/** Measures rendered CSS pixels. It is intentionally independent of UI class names. */
export async function inspectVisualGuards(page: Page): Promise<VisualReport> {
  return page.evaluate(() => {
    const tolerance = 0.01; // floating-point noise only, never a smaller target token
    const viewportWidth = document.documentElement.clientWidth;
    const documentWidth = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
    const modals = [...document.querySelectorAll<HTMLDialogElement>("dialog:modal")];
    const modal = modals.at(-1);
    const findings = { overflow: [] as VisualFinding[], targets: [] as VisualFinding[], fields: [] as VisualFinding[] };
    const rounded = (value: number) => Math.round(value * 100) / 100;

    function selector(element: Element): string {
      if (element.id) return `#${CSS.escape(element.id)}`;
      const testId = element.getAttribute("data-testid");
      if (testId) return `[data-testid="${CSS.escape(testId)}"]`;
      const parts: string[] = [];
      let current: Element | null = element;
      while (current && parts.length < 5) {
        if (current.id) { parts.unshift(`#${CSS.escape(current.id)}`); break; }
        const tag = current.tagName.toLowerCase();
        const siblings: Element[] = current.parentElement ? [...current.parentElement.children].filter((item) => item.tagName === current!.tagName) : [];
        parts.unshift(`${tag}${siblings.length > 1 ? `:nth-of-type(${siblings.indexOf(current) + 1})` : ""}`);
        current = current.parentElement;
      }
      return parts.join(" > ");
    }

    function rendered(element: HTMLElement): boolean {
      if (element.closest('[hidden], [inert], dialog:not([open])')) return false;
      if (modal && !modal.contains(element)) return false;
      const rect = element.getBoundingClientRect();
      if (!rect.width || !rect.height || !element.getClientRects().length) return false;
      // A skip link above the canvas is measured when focused, not while parked.
      if (rect.bottom <= 0 || rect.right <= 0) return false;
      for (let current: HTMLElement | null = element; current; current = current.parentElement) {
        const style = getComputedStyle(current);
        if (style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse" || Number(style.opacity) === 0) return false;
        if (current.hasAttribute("popover") && !current.matches(":popover-open")) return false;
      }
      return true;
    }

    function isInternallyContained(element: HTMLElement): boolean {
      for (let parent = element.parentElement; parent && parent !== document.body && parent !== document.documentElement; parent = parent.parentElement) {
        const style = getComputedStyle(parent);
        const rect = parent.getBoundingClientRect();
        if (["auto", "scroll", "hidden", "clip"].includes(style.overflowX)
          && rect.left >= -tolerance && rect.right <= viewportWidth + tolerance) return true;
      }
      return false;
    }

    // A locked modal may suppress body scroll legitimately. No other state may hide it.
    if (!modal) {
      for (const element of [document.documentElement, document.body]) {
        if (["hidden", "clip"].includes(getComputedStyle(element).overflowX)) {
          findings.overflow.push({ selector: selector(element), reason: "overflow-x global esconde possíveis regressões" });
        }
      }
    }

    const elements = [...document.querySelectorAll<HTMLElement>("body *")].filter(rendered);
    for (const element of elements) {
      const rect = element.getBoundingClientRect();
      if ((rect.right > viewportWidth + tolerance || rect.left < -tolerance) && !isInternallyContained(element)) {
        findings.overflow.push({
          selector: selector(element), width: rounded(rect.width),
          reason: `limites horizontais ${rounded(rect.left)}…${rounded(rect.right)}px fora de 0…${viewportWidth}px`,
        });
      }
    }
    if (documentWidth > viewportWidth + tolerance && findings.overflow.length === 0) {
      findings.overflow.push({ selector: "html", width: documentWidth, reason: "documento mais largo que a viewport; verifique conteúdo de texto ou pseudo-elementos" });
    }

    type HitRect = { left: number; top: number; right: number; bottom: number; width: number; height: number };
    function hitArea(element: HTMLElement): { rect: HitRect; extended: boolean } {
      const bounds = element.getBoundingClientRect();
      let rect: HitRect = { left: bounds.left, top: bounds.top, right: bounds.right, bottom: bounds.bottom, width: bounds.width, height: bounds.height };
      let extended = false;
      for (const pseudo of ["::before", "::after"]) {
        const style = getComputedStyle(element, pseudo);
        if (style.content === "none" || style.content === "normal" || style.display === "none" || style.visibility === "hidden"
          || style.pointerEvents === "none" || style.position !== "absolute") continue;
        const width = parseFloat(style.width);
        const height = parseFloat(style.height);
        const left = parseFloat(style.left);
        const top = parseFloat(style.top);
        if (![width, height, left, top].every(Number.isFinite)) continue;
        const transform = new DOMMatrixReadOnly(style.transform === "none" ? undefined : style.transform);
        // Rotated or skewed artwork is not assumed to enlarge an actionable rectangle.
        if (transform.b !== 0 || transform.c !== 0 || transform.a <= 0 || transform.d <= 0) continue;
        const extraWidth = style.boxSizing === "border-box" ? 0 : parseFloat(style.paddingLeft) + parseFloat(style.paddingRight) + parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth);
        const extraHeight = style.boxSizing === "border-box" ? 0 : parseFloat(style.paddingTop) + parseFloat(style.paddingBottom) + parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
        const pseudoLeft = bounds.left + element.clientLeft + left + transform.e;
        const pseudoTop = bounds.top + element.clientTop + top + transform.f;
        let candidate = { left: pseudoLeft, top: pseudoTop, right: pseudoLeft + (width + extraWidth) * transform.a, bottom: pseudoTop + (height + extraHeight) * transform.d };
        // An expanded pseudo target cannot extend through a clipping ancestor.
        for (let parent: HTMLElement | null = element; parent && parent !== document.body; parent = parent.parentElement) {
          const parentStyle = getComputedStyle(parent);
          const clip = parent.getBoundingClientRect();
          if (["hidden", "clip"].includes(parentStyle.overflowX)) candidate = { ...candidate, left: Math.max(candidate.left, clip.left), right: Math.min(candidate.right, clip.right) };
          if (["hidden", "clip"].includes(parentStyle.overflowY)) candidate = { ...candidate, top: Math.max(candidate.top, clip.top), bottom: Math.min(candidate.bottom, clip.bottom) };
        }
        const next = {
          left: Math.min(rect.left, candidate.left), top: Math.min(rect.top, candidate.top),
          right: Math.max(rect.right, candidate.right), bottom: Math.max(rect.bottom, candidate.bottom),
        };
        extended ||= next.left !== rect.left || next.top !== rect.top || next.right !== rect.right || next.bottom !== rect.bottom;
        rect = { ...next, width: next.right - next.left, height: next.bottom - next.top };
      }
      return { rect, extended };
    }

    const targetSelector = 'a[href], button, input:not([type="hidden"]), select, textarea, summary, [role="button"], [role="link"], [role="switch"], [role="checkbox"], [role="radio"], [role="tab"], [contenteditable="true"], [tabindex]';
    const targets = elements.filter((element) => element.matches(targetSelector) &&
      (!element.hasAttribute("tabindex") || element.tabIndex >= 0 || element.matches('button, input, select, textarea, a[href], [contenteditable="true"]')));
    const measured = targets.map((element) => ({ element, ...hitArea(element) }));
    for (const { element, rect } of measured) {
      if (rect.width + tolerance < 44 || rect.height + tolerance < 44) {
        findings.targets.push({ selector: selector(element), width: rounded(rect.width), height: rounded(rect.height), reason: "área acionável abaixo de 44 × 44px" });
      }
    }
    for (let index = 0; index < measured.length; index += 1) {
      const first = measured[index]!;
      if (!first.extended) continue;
      for (const second of measured) {
        if (first.element === second.element || first.element.contains(second.element) || second.element.contains(first.element)) continue;
        if (Math.min(first.rect.right, second.rect.right) - Math.max(first.rect.left, second.rect.left) > tolerance
          && Math.min(first.rect.bottom, second.rect.bottom) - Math.max(first.rect.top, second.rect.top) > tolerance) {
          findings.targets.push({ selector: selector(first.element), reason: `alvo ampliado invade ${selector(second.element)}` });
        }
      }
    }

    const fields = elements.filter((element) => element.matches('input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]), select, textarea, [contenteditable="true"]'));
    for (const element of fields) {
      const fontSize = parseFloat(getComputedStyle(element).fontSize);
      if (fontSize < 16) findings.fields.push({ selector: selector(element), fontSize, reason: "campo abaixo de 16px; risco de zoom involuntário no iOS" });
    }
    return { url: location.href, viewportWidth, documentWidth, inspectedTargets: targets.length, inspectedFields: fields.length, ...findings };
  });
}

export function describeVisualFailures(report: VisualReport, gate: "overflow" | "targets" | "fields"): string {
  return `${report.url} (${report.viewportWidth}px), portão ${gate}:\n${JSON.stringify(report[gate], null, 2)}`;
}
