import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Trustora", short_name: "Trustora", description: "Book verified artisans near you.",
    start_url: "/", display: "standalone", background_color: "#FAFAF8", theme_color: "#1E2A5E",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
