import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { FeedbackWorkspace } from "../../src/components/features/feedback/feedback-workspace";
import { LEGAL_SUPPORT_EMAIL } from "../../src/lib/legal/documents";

describe("histórico de feedback", () => {
  it("oferece o canal público de suporte mesmo antes do histórico carregar", () => {
    const html = renderToStaticMarkup(<FeedbackWorkspace userId="user-fixture" supportEmail={LEGAL_SUPPORT_EMAIL} />);
    expect(html).toContain('aria-labelledby="feedback-history"');
    expect(html).toContain(`href="mailto:${LEGAL_SUPPORT_EMAIL}"`);
    expect(html).toContain("Falar com o suporte");
  });
});
