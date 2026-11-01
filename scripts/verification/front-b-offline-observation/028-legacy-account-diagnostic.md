# Diagnóstico sintético de conta legada e troca de senha

Este diagnóstico opt-in tenta reproduzir, em PGlite descartável, o possível ciclo entre admissão pendente e troca de senha obrigatória para uma identidade sintética anterior à candidata 028. Inclui controle antes da candidata e um segundo cenário que deve ser recusado pelo preflight. O resultado esperado é uma hipótese até a execução; não há dados reais nem acesso remoto.

```sh
SC_FRONT_B_LEGACY_DIAGNOSTIC=1 node scripts/verification/front-b-offline-observation/028-legacy-account-diagnostic.mjs --execute
```

Sem opt-in não abre banco, e o processo recusa se `os.freemem()` informar menos de 1 GiB; esse indicador não substitui limites do ambiente. O script não integra o glob de testes nem é gate de liberação. Mesmo se a hipótese for reproduzida, será evidência da fixture, não de GoTrue, PostgreSQL concorrente, QA ou da existência dessa coorte em produção.
