import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import type { AnchorHTMLAttributes, ReactNode } from 'react';
const seam = vi.hoisted(() => ({ connected:true }));
vi.mock('next/navigation', () => ({ usePathname: () => '/atualizacoes' }));
vi.mock('next/link', () => ({ default: ({children,...props}: AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a> }));
vi.mock('@/lib/navigation/demo-access-provider', () => ({ useDemoAccess: () => ({ connected:seam.connected, policy:{ entitlements:{},preferences:{},isAdmin:false } }) }));
vi.mock('@/lib/demo/demo-provider', () => ({ useDemoApplication: () => ({ userId:'user-a',logout:()=>{} }) }));
vi.mock('@/components/features/capturar/quick-capture', () => ({ QuickCapture: () => <button className="shell-capture">Capturar</button> }));
vi.mock('@/components/theme/theme-toggle', () => ({ ThemeToggle: () => <button aria-label="Ativar tema escuro">Tema</button> }));
vi.mock('@/components/theme/theme-selector', () => ({ ThemeSelector: () => null }));
vi.mock('@/components/layout/command-palette', () => ({ CommandPalette: () => null }));
vi.mock('@/components/layout/calendar-meeting-reminders', () => ({ CalendarMeetingReminders: () => null }));
vi.mock('@/components/layout/connected-command-feedback', () => ({ ConnectedCommandFeedback: ({children}:{children:ReactNode}) => children }));
vi.mock('@/components/layout/account-avatar', () => ({ AccountAvatar: () => null }));
import { WorkspaceShell } from '../../src/components/layout/workspace-shell';

describe('shell conectado: navegação de atualizações', () => {
 it('identifica a página e a ação ativa, conservando Ajuda', () => {
  const html=renderToStaticMarkup(<WorkspaceShell destinations={{feedback:false,updates:true}}><h1>Atualizações</h1></WorkspaceShell>);
  expect(html).toContain('class="shell-breadcrumb-current">Atualizações</strong>');
  expect(html).toMatch(/href="\/atualizacoes"[^>]*aria-label="Atualizações"[^>]*aria-current="page"/);
  expect(html).toContain('class="shell-topbar shell-topbar--updates"');
  expect(html).toContain('href="/ajuda"'); expect(html).not.toContain('Enviar feedback');
 });
 it.each([true,false])('não altera o topo sem atualizações (connected=%s)', connected => {
  seam.connected=connected;
  const html=renderToStaticMarkup(<WorkspaceShell destinations={{feedback:false,updates:false}}>Início</WorkspaceShell>);
  expect(html).toContain('class="shell-topbar"'); expect(html).not.toContain('shell-topbar--updates');
  expect(html).not.toContain('aria-label="Atualizações"');
  seam.connected=true;
 });
 it('organiza o topo em duas linhas estreitas e não reduz os alvos', () => {
  const css=readFileSync('src/components/layout/workspace-shell.css','utf8');
  expect(css).toContain('@media (max-width: 420px)');
  expect(css).toContain('.shell-topbar--updates { flex-wrap: wrap; row-gap: 0;');
  expect(css).toContain('.shell-topbar--updates .shell-breadcrumb { flex: 1 0 100%; }');
  expect(css).toContain('.shell-topbar--updates .shell-top-actions { width: 100%; justify-content: space-between; }');
  expect(css).toContain('width: var(--target);');
 });
});
