import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "miboliche.cl",
    short_name: "Mi Boliche",
    description: "Ventas e inventario de tu almacén, siempre claros.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f7f6",
    theme_color: "#063d35",
    icons: [
      {
        src: "/miboliche-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
