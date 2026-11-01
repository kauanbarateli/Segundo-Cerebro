import { createRoot } from "react-dom/client";
import { FeedbackWorkspace } from "../../../src/components/features/feedback/feedback-workspace";

// The component is real. Authentication, network responses and any database
// are supplied only by the Playwright route fixture.
Object.assign(globalThis, { __startFeedbackSession(userId: string) {
  const root = document.getElementById("feedback-session");
  if (!root) throw new Error("Fixture root missing");
  createRoot(root).render(<FeedbackWorkspace userId={userId} supportEmail="fixture@example.invalid" />);
} });
