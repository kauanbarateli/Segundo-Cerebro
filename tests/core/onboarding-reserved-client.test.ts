import {describe,expect,it} from "vitest";
import {assertOrdinaryClientId} from "../../src/core/onboarding/reserved-client";
describe("reserved coordinator namespace at ordinary entry points",()=>{
 it.each(["onb:round:project:item:v1","onb:","onb:any-prefix"])('refuses %s without granting authority to a forged UUID',value=>expect(()=>assertOrdinaryClientId(value)).toThrow());
 it.each(["onboarding-note", "7ee8841b-c469-40ba-a781-5ab2abed2568",null,undefined])('leaves ordinary IDs and shape validation to their existing domain decoder %#',value=>expect(()=>assertOrdinaryClientId(value)).not.toThrow());
});
