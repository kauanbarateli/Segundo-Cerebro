import {afterEach,expect,it,vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
const seam=vi.hoisted(()=>({readConfig:vi.fn(()=>{throw Error('gate must stay closed');})}));
vi.mock('server-only',()=>({}));
vi.mock('@/lib/auth/guards',()=>({requireUser:async()=>({userId:'10000000-0000-4000-8000-000000000001'})}));
vi.mock('@/lib/auth/config',()=>({readAuthConfiguration:seam.readConfig}));
import FeedbackPage from '../../src/app/(workspace)/feedback/page';
import {feedbackReconciliationReady} from '../../src/lib/feedback/reconciliation-gate';
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});
it('em SSR, compõe página com gate real fechado e sem acessar storage',async()=>{
 const getItem=vi.fn(()=>{throw Error('unexpected read');}),setItem=vi.fn(()=>{throw Error('unexpected write');});
 vi.stubGlobal('sessionStorage',{getItem,setItem});expect(feedbackReconciliationReady()).toBe(false);
 const html=renderToStaticMarkup(await FeedbackPage());
 expect(html).toContain('O envio está temporariamente indisponível');expect(html).toContain('Suas mensagens');
 expect(html).not.toContain('<form');expect(html).not.toContain('Enviar mensagem</button>');
 expect(seam.readConfig).not.toHaveBeenCalled();expect(getItem).not.toHaveBeenCalled();expect(setItem).not.toHaveBeenCalled();
});
