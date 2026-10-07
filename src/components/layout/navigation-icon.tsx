import type { FeatureKey } from "@/core/access/resolve-access";
import { Icons } from "@/components/ui/icons";

const icons = {
  inicio: Icons.Home, capturar: Icons.Capture, tarefas: Icons.Tasks, calendario: Icons.Calendar,
  conhecimento: Icons.Book, drive: Icons.Folder, projetos: Icons.Board, habitos: Icons.Repeat,
  financeiro: Icons.Wallet, cofre: Icons.Vault, configuracoes: Icons.Settings,
  integracoes: Icons.Link, admin: Icons.User,
} satisfies Record<FeatureKey, typeof Icons.Home>;

export function NavigationIcon({ feature }: { feature: FeatureKey }) {
  const Icon = icons[feature];
  return <Icon />;
}
