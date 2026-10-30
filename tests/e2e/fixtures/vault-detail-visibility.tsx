/** Public examples only. This fixture tests presentation, not Auth or crypto. */
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { VaultSecretField } from "@/components/features/cofre/vault-secret-field";

function Surface() {
  const [owner, setOwner] = useState(1), [item, setItem] = useState(1), [allowed, setAllowed] = useState(true);
  return <main>
    <VaultSecretField key={`${owner}:${item}`} value={item === 1 ? "Exemplo público A" : "Exemplo público B"} label="Senha" title={`Item ${item}`} enabled={allowed} isCurrent={() => allowed} />
    <button onClick={() => setItem(item === 1 ? 2 : 1)}>Trocar item</button>
    <button onClick={() => setOwner(owner + 1)}>Trocar identidade</button>
    <button onClick={() => setAllowed(!allowed)}>{allowed ? "Revogar acesso" : "Autorizar acesso"}</button>
  </main>;
}
createRoot(document.getElementById("vault-detail-fixture")!).render(<Surface />);
