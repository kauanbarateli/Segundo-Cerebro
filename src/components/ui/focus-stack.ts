/** Native modal dialogs own modality; this registry owns scroll and focus return. */
interface DialogEntry {
  element: HTMLDialogElement;
  previous: HTMLElement | null;
  returnTarget: () => HTMLElement | null;
}

const dialogs: DialogEntry[] = [];
let restoreScroll: (() => void) | undefined;

export function isTopDialog(element: HTMLDialogElement) {
  return dialogs.at(-1)?.element === element;
}

function canReceiveFocus(element: HTMLElement | null): element is HTMLElement {
  return !!element?.isConnected && !element.closest('[inert], [hidden]') &&
    !element.matches(':disabled') && element.getClientRects().length > 0 &&
    getComputedStyle(element).visibility !== "hidden";
}

/** Native modality blocks the page; close the Tab edges before browser chrome. */
export function containDialogTab(element: HTMLDialogElement, event: { shiftKey: boolean; preventDefault: () => void }) {
  if (!isTopDialog(element)) return;
  const candidates = Array.from(element.querySelectorAll<HTMLElement>(
    'button, a[href], input, select, textarea, summary, [tabindex], [contenteditable="true"]',
  )).filter((candidate) => canReceiveFocus(candidate) &&
    (candidate.tabIndex >= 0 || (candidate.isContentEditable && !candidate.hasAttribute("tabindex"))),
  );
  // Respect native radio groups and positive tabindex without replacing navigation inside.
  const stops = candidates.filter((candidate) => {
    if (!(candidate instanceof HTMLInputElement) || candidate.type !== "radio" || !candidate.name) return true;
    const group = candidates.filter((other): other is HTMLInputElement => other instanceof HTMLInputElement && other.type === "radio" && other.name === candidate.name && other.form === candidate.form);
    return (group.find((radio) => radio.checked) ?? group[0]) === candidate;
  }).sort((first, second) => (first.tabIndex > 0 ? first.tabIndex : Infinity) - (second.tabIndex > 0 ? second.tabIndex : Infinity));
  const first = stops[0];
  const last = stops.at(-1);
  const active = element.ownerDocument.activeElement;
  if (!first || !last) {
    event.preventDefault();
    focusFallback(element.querySelector<HTMLElement>('[data-dialog-title]') ?? element);
  } else if (event.shiftKey && (active === first || !stops.includes(active as HTMLElement))) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (active === last || !element.contains(active))) {
    event.preventDefault();
    first.focus();
  }
}

function focusFallback(element: HTMLElement) {
  const previousTabIndex = element.getAttribute("tabindex");
  element.setAttribute("tabindex", "-1");
  element.focus({ preventScroll: true });
  if (previousTabIndex === null) element.removeAttribute("tabindex");
  else element.setAttribute("tabindex", previousTabIndex);
}

export function registerDialog(
  element: HTMLDialogElement,
  returnTarget: () => HTMLElement | null,
) {
  const document = element.ownerDocument;
  const active = document.activeElement;
  const entry: DialogEntry = {
    element,
    previous: active instanceof HTMLElement ? active : null,
    returnTarget,
  };

  if (!dialogs.length) {
    const body = document.body;
    const root = document.documentElement;
    const overflow = body.style.overflow;
    const rootOverflow = root.style.overflow;
    const padding = body.style.paddingRight;
    const gutter = Math.max(0, (document.defaultView?.innerWidth ?? root.clientWidth) - root.clientWidth);
    if (gutter) body.style.paddingRight = `${parseFloat(getComputedStyle(body).paddingRight) + gutter}px`;
    body.style.overflow = "hidden";
    root.style.overflow = "hidden";
    restoreScroll = () => {
      body.style.overflow = overflow;
      body.style.paddingRight = padding;
      root.style.overflow = rootOverflow;
    };
  }
  dialogs.push(entry);

  let released = false;
  return () => {
    if (released) return;
    released = true;
    const wasTop = isTopDialog(element);
    dialogs.splice(dialogs.indexOf(entry), 1);
    if (element.open) element.close();
    if (!dialogs.length) {
      restoreScroll?.();
      restoreScroll = undefined;
    }

    const top = dialogs.at(-1)?.element;
    // Closing a lower layer must never steal focus from the active modal.
    if (!wasTop && top?.contains(document.activeElement)) return;
    const target = [entry.returnTarget(), entry.previous].find((candidate) =>
      canReceiveFocus(candidate) && (!top || top.contains(candidate)),
    );
    if (target) target.focus({ preventScroll: true });
    else if (top) focusFallback(top.querySelector<HTMLElement>('[data-dialog-title]') ?? top);
    else {
      const main = document.querySelector("main");
      if (main instanceof HTMLElement) focusFallback(main);
    }
  };
}
