import {afterEach,describe,expect,it,vi} from 'vitest';
const fake=vi.hoisted(()=>({config:vi.fn(),enabled:vi.fn()}));
vi.mock('server-only',()=>({}));
vi.mock('@/lib/auth/config',()=>({readAuthConfiguration:fake.config}));
vi.mock('@/lib/auth/signup-http',()=>({signupEnabled:fake.enabled}));
import {frontBCapabilities} from '../../src/lib/access/front-b-capabilities-server';
describe('composição de capacidades da Frente B',()=>{
 afterEach(()=>{vi.unstubAllEnvs();vi.clearAllMocks();});
 it('permanece fechada em demo ou configuração inválida',()=>{
  fake.config.mockReturnValueOnce({mode:'demo'});expect(frontBCapabilities()).toEqual({signup:false,schema:false,updates:false,feedback:false});
  fake.config.mockImplementationOnce(()=>{throw new Error('secret');});expect(frontBCapabilities()).toEqual({signup:false,schema:false,updates:false,feedback:false});
 });
 it('mostra atualizações para contas, mas só apresenta recursos de banco após o gate separado',()=>{
  fake.config.mockReturnValue({mode:'supabase'});fake.enabled.mockReturnValue(false);vi.stubEnv('SC_FRONT_B_SCHEMA_READY','false');
  expect(frontBCapabilities()).toEqual({signup:false,schema:false,updates:true,feedback:false});
  fake.enabled.mockReturnValue(true);expect(frontBCapabilities()).toEqual({signup:false,schema:false,updates:true,feedback:false});
  vi.stubEnv('SC_FRONT_B_SCHEMA_READY','true');fake.enabled.mockReturnValue(true);
  expect(frontBCapabilities()).toEqual({signup:true,schema:true,updates:true,feedback:false});
  fake.enabled.mockReturnValue(false);expect(frontBCapabilities()).toEqual({signup:false,schema:true,updates:true,feedback:false});
 });
});
