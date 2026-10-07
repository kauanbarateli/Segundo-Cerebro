import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import tokens from "../../design-system/tokens/tokens.json";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { ToastProvider } from "@/components/ui/toast";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "Segundo Cérebro · Em construção",
  description: "Um espaço para capturar ideias, conectar conhecimento e organizar o dia. Acompanhe a construção do novo Segundo Cérebro.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "light dark",
  themeColor: tokens.color.light.canvas,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={GeistSans.variable} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} /></head>
      <body><ThemeProvider><ToastProvider>{children}</ToastProvider></ThemeProvider></body>
    </html>
  );
}
