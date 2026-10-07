import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { GeistSans } from "geist/font/sans";
import tokens from "../../design-system/tokens/tokens.json";
import pwaAssets from "../../design-system/pwa-assets.json";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { ToastProvider } from "@/components/ui/toast";
import { InstallProvider } from "@/components/pwa/install-provider";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "Segundo Cérebro · Em construção",
  description: "Um espaço para capturar ideias, conectar conhecimento e organizar o dia. Acompanhe a construção do novo Segundo Cérebro.",
  robots: { index: false, follow: false },
  applicationName: "Segundo Cérebro",
  appleWebApp: { capable: true, title: "Segundo Cérebro", statusBarStyle: "default", startupImage: pwaAssets.startupImages },
  icons: { apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }] },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "light dark",
  themeColor: tokens.color.light.canvas,
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Per-request rendering lets Next apply the middleware nonce to framework scripts.
  // The theme script also has a stable SHA-256 source in the blocking policy.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="pt-BR" className={GeistSans.variable} suppressHydrationWarning>
      {/* Browsers hide the nonce attribute while preserving script.nonce; suppress only that expected difference. */}
      <head><script nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} /></head>
      <body><ThemeProvider><ToastProvider><InstallProvider>{children}</InstallProvider></ToastProvider></ThemeProvider></body>
    </html>
  );
}
