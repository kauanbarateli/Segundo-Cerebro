import type { MetadataRoute } from "next";
import tokens from "../../design-system/tokens/tokens.json";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/", name: "Segundo Cérebro", short_name: "2º Cérebro", lang: "pt-BR",
    description: "Capture ideias, conecte conhecimento e organize o dia.",
    start_url: "/", scope: "/", display: "standalone",
    background_color: tokens.color.light.canvas, theme_color: tokens.color.light.canvas,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Capturar", url: "/capturar", description: "Abra a caixa de entrada" },
      { name: "Tarefas", url: "/tarefas", description: "Veja as próximas ações" },
      { name: "Financeiro", url: "/financeiro", description: "Abra seu panorama financeiro" },
    ],
    share_target: {
      action: "/compartilhar/receber", method: "POST", enctype: "multipart/form-data",
      params: { title: "title", text: "text", url: "url", files: [{ name: "images", accept: ["image/*"] }] },
    },
    launch_handler: { client_mode: "focus-existing" },
  };
}
