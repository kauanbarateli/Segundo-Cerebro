import { beforeEach, describe, expect, it, vi } from 'vitest';
const seam = vi.hoisted(() => ({ mode: 'demo', identity: vi.fn(), account: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth/config', () => ({ readAuthConfiguration: () => ({ mode: seam.mode }) }));
vi.mock('@/lib/auth/guards', () => ({ requireUser: seam.identity }));
vi.mock('@/adapters/db/account-presentation', () => ({ accountPresentation: seam.account }));
vi.mock('@/lib/files/storage-origin-server', () => ({ resolveStorageOrigin: () => ({}) }));
vi.mock('@/lib/navigation/demo-access-provider', () => ({ DemoAccessProvider: () => null }));
vi.mock('@/lib/demo/demo-provider', () => ({ DemoApplicationProvider: () => null }));
vi.mock('@/components/layout/workspace-shell', () => ({ WorkspaceShell: () => null }));
import WorkspaceLayout from '../../src/app/(workspace)/layout';
import { resolveOptionalNavigation } from '../../src/lib/navigation/optional-destinations';

describe('integração independente das atualizações ao shell da Frente A', () => {
 beforeEach(() => { seam.mode='demo'; seam.identity.mockReset(); seam.account.mockReset(); });
 it('esconde atualizações e mantém Ajuda no demo', async () => {
  const element=await WorkspaceLayout({children:null}), shell=element.props.children.props.children;
  const nav=resolveOptionalNavigation(shell.props.destinations);
  expect(nav.updates).toBeNull(); expect(nav.help.kind).toBe('help');
  expect(seam.identity).not.toHaveBeenCalled();
 });
 it('oferece atualizações só depois de verificar usuário, preservando Ajuda', async () => {
  seam.mode='supabase'; seam.identity.mockResolvedValue({userId:'user-a',entitlements:{},role:'user'}); seam.account.mockResolvedValue(null);
  const element=await WorkspaceLayout({children:null}), shell=element.props.children.props.children;
  const nav=resolveOptionalNavigation(shell.props.destinations);
  expect(nav.updates?.href).toBe('/atualizacoes'); expect(nav.help.kind).toBe('help');
  expect(seam.identity).toHaveBeenCalledOnce();
 });
 it('não compõe o shell se a autenticação for recusada', async () => {
  seam.mode='supabase'; seam.identity.mockRejectedValue(new Error('redirect:/entrar'));
  await expect(WorkspaceLayout({children:null})).rejects.toThrow('redirect:/entrar');
  expect(seam.account).not.toHaveBeenCalled();
 });
});
