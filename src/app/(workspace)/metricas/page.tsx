import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { WorkspacePage } from '@/components/layout/workspace-page';
import { SignupMetricsWorkspace } from '@/components/features/metricas/signup-metrics-workspace';
import { requireMaster } from '@/lib/auth/guards';
import { AuthGuardError } from '@/lib/auth/types';

export const metadata: Metadata={title:'Métricas · Segundo Cérebro'};
export default async function MetricsPage() {
 let identity;
 try { identity=await requireMaster(); }
 catch(error) { if(error instanceof AuthGuardError && ['forbidden','demo'].includes(error.code)) notFound(); throw error; }
 return <WorkspacePage feature="admin" title="Métricas" subtitle="Cadastros e origens informadas no período."><SignupMetricsWorkspace userId={identity.userId}/></WorkspacePage>;
}
