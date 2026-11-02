import {describe,expect,it} from 'vitest';
import {signupOriginFromSearch,signupOriginQuery} from '../../src/core/acquisition/signup-origin-transport';

describe('transporte de origem até o cadastro',()=>{
 it('transporta somente as cinco UTMs e codifica o texto como parâmetro',()=>{
  const query=signupOriginQuery({utm_source:'busca',utm_campaign:'verão & sol',utm_medium:'social',utm_term:'organização',utm_content:'post',referrer:'privado',email:'private@example.invalid'});
  const values=new URLSearchParams(query);
  expect([...values.keys()]).toEqual(['utm_source','utm_medium','utm_campaign','utm_term','utm_content']);
  expect(values.get('utm_campaign')).toBe('verão & sol');expect(query).not.toContain('private');
 });
 it('rejeita duplicatas, entradas perigosas e excesso sem impedir o cadastro',()=>{
  expect(signupOriginQuery({utm_source:['a','b'],utm_medium:'<script>',utm_campaign:'x'.repeat(201)})).toBe('');
  expect(signupOriginQuery({utm_source:'\u0000',utm_term:'\ud800'})).toBe('');
  const query=signupOriginQuery({utm_source:'a'.repeat(200),utm_medium:'b'.repeat(200),utm_campaign:'c'.repeat(200),utm_term:'d'.repeat(200),utm_content:'e'.repeat(200)});
  expect(new TextEncoder().encode(JSON.stringify(Object.fromEntries(new URLSearchParams(query)))).length).toBeLessThanOrEqual(1000);
 });
 it('rejeita campos duplicados também no acesso direto ao cadastro',()=>{
  expect(signupOriginFromSearch(new URLSearchParams('utm_source=a&utm_source=b&utm_medium=email'))).toEqual({utm_medium:'email'});
  expect(signupOriginFromSearch(new URLSearchParams('utm_source=a&utm_source=b'))).toBeNull();
 });
});
