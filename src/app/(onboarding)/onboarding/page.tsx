import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth/guards';
import { OnboardingWorkspace } from '@/components/features/onboarding/onboarding-workspace';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Prepare seu espaço | Segundo Cérebro', robots: { index: false, follow: false } };

export default async function OnboardingPage() {
  const identity = await requireUser();
  return <OnboardingWorkspace key={identity.userId} ownerId={identity.userId} />;
}
