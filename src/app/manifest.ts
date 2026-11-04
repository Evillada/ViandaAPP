import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Vianda — Nutrición clínica",
    short_name: "Vianda",
    start_url: "/start",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#2A9D8F",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
