import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth/guards';
import { OnboardingWorkspace } from '@/components/features/onboarding/onboarding-workspace';
import { parseOnboardingOAuthNotice } from '@/components/features/onboarding/oauth-notice';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Prepare seu espaço | Segundo Cérebro', robots: { index: false, follow: false } };

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ notice?: string | string[] }> }) {
  const identity = await requireUser();
  const notice = parseOnboardingOAuthNotice((await searchParams).notice);
  return <OnboardingWorkspace key={identity.userId} ownerId={identity.userId} notice={notice} />;
}
