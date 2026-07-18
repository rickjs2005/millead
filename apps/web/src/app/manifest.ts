import type { MetadataRoute } from "next";

/** Manifest do PWA -- permite instalar o MilLead como app no celular. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MilLead — CRM",
    short_name: "MilLead",
    description: "CRM e prospecção de leads da MilWeb.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#0b0f1a",
    theme_color: "#12a3e0",
    lang: "pt-BR",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
