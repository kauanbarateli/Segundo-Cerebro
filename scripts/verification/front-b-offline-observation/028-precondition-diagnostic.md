# Diagnóstico sintético da constraint anterior à candidata 028

Este diagnóstico opt-in usa três instâncias PGlite descartáveis e sequenciais. Ele procura demonstrar se a candidata de admissão preserva uma constraint `CHECK (true)` preexistente e compara o resultado com uma guarda experimental inserida em memória imediatamente antes da leitura, após a configuração de timeout e os locks anteriores da candidata. Os bytes do catálogo 027 e da candidata são fixados; o arquivo da candidata não é alterado.

Sem `--execute` e `SC_FRONT_B_028_DIAGNOSTIC=1` não inicia banco. O processo recusa quando `os.freemem()` informa menos de 1 GiB, medida aproximada que não substitui a verificação dos limites do ambiente. Não integra `test:scripts` nem é um gate de liberação.

```sh
SC_FRONT_B_028_DIAGNOSTIC=1 node scripts/verification/front-b-offline-observation/028-precondition-diagnostic.mjs --execute
```

Mesmo que passe, o resultado vale apenas para a fixture PGlite: não valida a migration, o catálogo 030, o lock em PostgreSQL nativo ou a concorrência entre sessões e não acessa ambientes hospedados. A guarda também precisa de análise de proprietário, catálogo e pós-condições em PostgreSQL 17 antes de qualquer promoção. Para locks, o runner nativo requer transporte assíncrono que prove identidades, bloqueio, cancelamento, encerramento e limpeza em container isolado; encerrar apenas `docker exec` não demonstra encerramento do backend.
