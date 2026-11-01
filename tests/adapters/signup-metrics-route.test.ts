import { beforeEach, describe, expect, it, vi } from 'vitest';
const fake=vi.hoisted(()=>({identity:vi.fn(),fetch:vi.fn()}));
const userId='10000000-0000-4000-8000-000000000001', sessionId='20000000-0000-4000-8000-000000000001';
vi.mock('@/lib/auth/config',()=>({readAuthConfiguration:()=>({mode:'supabase',supabaseUrl:'https://db.example.invalid',secretKey:'server-only'})}));
vi.mock('@/lib/auth/database-origin-server',()=>({isTrustedHostedDatabaseOrigin:()=>true}));
vi.mock('@/lib/auth/runtime',()=>({requestAuthServices:async()=>({gateway:{readIdentity:fake.identity}})}));
import { GET } from '../../src/app/api/signup-metrics/route';
const query='start=2026-10-01&end=2026-10-31&zone=America%2FFortaleza&bucket=month';
const request=(id=userId,qs=query)=>new Request(`https://app.example.invalid/api/signup-metrics?${qs}`,{headers:{'x-expected-user-id':id}});
const result={start:'2026-10-01',end:'2026-10-31',zone:'America/Fortaleza',bucket:'month',totalPublic:0,stock:{total:1,legacy:1,admin:0,public:0,unclassified:0},series:[{period:'2026-10-01',count:0}],distributions:{utm_source:[],utm_medium:[],utm_campaign:[],utm_term:[],utm_content:[]}};
describe('métricas privadas',()=>{
 beforeEach(()=>{vi.clearAllMocks();vi.stubGlobal('fetch',fake.fetch);fake.identity.mockResolvedValue({userId,sessionId,mustChangePassword:false,role:'master',entitlements:{}});fake.fetch.mockResolvedValue(new Response(JSON.stringify(result),{headers:{'Content-Type':'application/json'}}));});
 it('autoriza Master, usa ator da sessão e retorna somente agregados',async()=>{
  const response=await GET(request()); expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toContain('no-store');
  expect(await response.json()).toEqual({ok:true,result});
  expect(JSON.parse(fake.fetch.mock.calls[0]![1].body)).toMatchObject({p_actor:userId,p_session:sessionId,p_start:'2026-10-01'});
 });
 it('nega anônimo, usuário comum, veto e troca de conta antes de consultar',async()=>{
  fake.identity.mockResolvedValueOnce(null);expect((await GET(request())).status).toBe(401);
  fake.identity.mockResolvedValueOnce({userId,sessionId,mustChangePassword:false,role:'user',entitlements:{}});expect((await GET(request())).status).toBe(403);
  fake.identity.mockResolvedValueOnce({userId,sessionId,mustChangePassword:false,role:'master',entitlements:{admin:false}});expect((await GET(request())).status).toBe(403);
  expect((await GET(request('other'))).status).toBe(409);expect(fake.fetch).not.toHaveBeenCalled();
 });
 it('rejeita período inválido, chaves extras e resposta com dados não permitidos',async()=>{
  expect((await GET(request(userId,`${query}&email=x`))).status).toBe(400);
  expect((await GET(request(userId,'start=2025-01-01&end=2026-10-31&zone=UTC&bucket=day'))).status).toBe(400);
  fake.fetch.mockResolvedValueOnce(new Response(JSON.stringify({...result,email:'private@example.invalid'}),{headers:{'Content-Type':'application/json'}}));
  const response=await GET(request());expect(response.status).toBe(503);expect(JSON.stringify(await response.json())).not.toContain('private@example.invalid');
 });
});
