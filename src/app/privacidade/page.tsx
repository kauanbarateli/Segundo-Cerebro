import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/legal-document";
import { LEGAL_DOCUMENTS } from "@/lib/legal/documents";

const document = LEGAL_DOCUMENTS.privacidade;
export const metadata: Metadata = { title: `${document.title} · Segundo Cérebro`, description: document.summary };

export default function PrivacyPage() {
  return <LegalDocument document={document} />;
}
