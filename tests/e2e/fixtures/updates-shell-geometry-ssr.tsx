/** Server-rendered real shell; Auth, Next navigation and unrelated controls are explicit synthetic seams. */
import { renderToStaticMarkup } from 'react-dom/server';
import { WorkspaceShell } from '../../../src/components/layout/workspace-shell';
export function renderShell(updates = true) {
 return renderToStaticMarkup(<WorkspaceShell destinations={{feedback:false,updates}} displayName="Pessoa de teste"><h1>Atualizações</h1></WorkspaceShell>);
}
