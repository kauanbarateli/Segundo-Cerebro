import {describe,expect,it,vi} from 'vitest';
const fake=vi.hoisted(()=>({redirect:vi.fn((target:string):never=>{throw new Error(target);})}));
vi.mock('next/navigation',()=>({redirect:fake.redirect}));
import SignupEntry from '../../src/app/(auth)/criar-conta/page';
describe('entrada de cadastro da landing',()=>{
 it('encaminha ao formulário com apenas parâmetros permitidos',async()=>{
  await expect(SignupEntry({searchParams:Promise.resolve({utm_source:'busca',utm_campaign:'verão',referrer:'private'})})).rejects.toThrow();
  const url=new URL(fake.redirect.mock.calls[0]![0],'https://example.invalid');
  expect(url.pathname).toBe('/cadastro');expect(url.searchParams.get('utm_source')).toBe('busca');expect(url.searchParams.get('utm_campaign')).toBe('verão');expect(url.searchParams.has('referrer')).toBe(false);
 });
});
