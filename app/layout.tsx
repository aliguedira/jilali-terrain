import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Terrain",
  // Pas de description publique : cet outil ne doit jamais être indexé
  // ni donner d'indice sur son contenu à qui tombe dessus par hasard.
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className="min-h-screen bg-brand-paper text-brand-ink antialiased">
        {children}
      </body>
    </html>
  );
}
