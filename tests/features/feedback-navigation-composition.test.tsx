import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
const seam = vi.hoisted(() => ({ mode:'supabase', ready:false, demoFeedback:false, demoUpdates:false }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth/config', () => ({ readAuthConfiguration: () => ({ mode: seam.mode }) }));
vi.mock('@/lib/auth/signup-http', () => ({ signupEnabled: () => false }));
vi.mock('@/lib/feedback/reconciliation-gate', () => ({ feedbackReconciliationReady: () => seam.ready }));
vi.mock('@/lib/auth/guards', () => ({ requireUser: async () => ({ userId: 'user-a', entitlements:{}, role:'user' }) }));
vi.mock('@/adapters/db/account-presentation', () => ({ accountPresentation: async () => null }));
vi.mock('@/lib/files/storage-origin-server', () => ({ resolveStorageOrigin: () => ({}) }));
vi.mock('@/lib/navigation/demo-access-provider', () => ({ DemoAccessProvider: ({children}: {children: unknown}) => children }));
vi.mock('@/lib/demo/demo-provider', () => ({ DemoApplicationProvider: ({children}: {children: unknown}) => children }));
vi.mock('@/components/layout/workspace-shell', () => ({ WorkspaceShell: () => null }));
vi.mock('@/components/features/atualizacoes/updates-board', () => ({ UpdatesBoard: () => null }));
vi.mock('@/lib/navigation/optional-destinations', async (importOriginal) => {
 const original = await importOriginal<typeof import('@/lib/navigation/optional-destinations')>();
 return {...original, readOptionalDestinations: () => ({feedback:seam.demoFeedback, updates:seam.demoUpdates})};
});
import WorkspaceLayout from '../../src/app/(workspace)/layout';
import UpdatesPage from '../../src/app/(workspace)/atualizacoes/page';
import { resolveOptionalNavigation } from '../../src/lib/navigation/optional-destinations';
import { frontBCapabilities } from '../../src/lib/access/front-b-capabilities-server';

describe('composição dos destinos de feedback', () => {
 beforeEach(() => { seam.mode='supabase'; seam.ready=false; seam.demoFeedback=false; seam.demoUpdates=false; vi.stubEnv('SC_FRONT_B_SCHEMA_READY','false'); });
 afterEach(() => vi.unstubAllEnvs());
 it.each([
  [false,false,false], [false,true,false], [true,false,false], [true,true,true],
 ])('schema %s, gate %s: shell e atualizações concordam (%s)', async (schema,ready,visible) => {
  vi.stubEnv('SC_FRONT_B_SCHEMA_READY', String(schema)); seam.ready=ready;
  expect(frontBCapabilities().feedback).toBe(visible);
  const element = await WorkspaceLayout({children:null});
  const shell = element.props.children.props.children;
  expect(shell.props.destinations.feedback).toBe(visible);
  const nav = resolveOptionalNavigation(shell.props.destinations);
  expect(nav.help.kind).toBe(visible ? 'feedback' : 'help');
  expect(nav.updates?.href).toBe('/atualizacoes');
  const html=renderToStaticMarkup(await UpdatesPage());
  expect(html.includes('Enviar sugestão')).toBe(visible);
 });
 it.each([[false,false],[true,true]])('modo demo preserva contrato próprio feedback=%s', async (feedback,updates) => {
  seam.mode='demo'; seam.demoFeedback=feedback; seam.demoUpdates=updates;
  const element=await WorkspaceLayout({children:null});
  const shell=element.props.children.props.children;
  expect(shell.props.destinations).toEqual({feedback,updates});
  expect(renderToStaticMarkup(await UpdatesPage()).includes('Enviar sugestão')).toBe(feedback);
 });
});
