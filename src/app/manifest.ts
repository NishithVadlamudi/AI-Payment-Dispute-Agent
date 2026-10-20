import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Resolve Payment Workspace",
    short_name: "Resolve",
    description:
      "Investigate fictional payments with AI and human-approved mock refunds.",
    start_url: "/payments",
    scope: "/",
    display: "standalone",
    background_color: "#f2f3f2",
    theme_color: "#118159",
    lang: "en",
    categories: ["finance", "productivity"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      { name: "Investigate a payment", url: "/demo" },
      { name: "Review refund approvals", url: "/approvals" },
    ],
  };
}
