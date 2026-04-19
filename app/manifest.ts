import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ranch Manager",
    short_name: "RanchMgr",
    description:
      "Ranch operations SaaS for crew, work, time, payroll, herd, land, and billing access.",
    start_url: "/",
    display: "standalone",
    background_color: "#1b4d39",
    theme_color: "#1b4d39",
    icons: [
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
