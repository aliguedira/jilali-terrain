import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Aucune page publique : réduit au minimum les en-têtes envoyés par
  // défaut, et interdit l'affichage du site dans un cadre externe.
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Empêche les moteurs de recherche d'indexer quoi que ce soit :
          // ce site ne contient que des données électorales nominatives.
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
        ],
      },
    ];
  },
};

export default nextConfig;
