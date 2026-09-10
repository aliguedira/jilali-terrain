import { notFound } from "next/navigation";

// Aucune page publique dans cette application : la page d'accueil ne
// montre jamais rien, même pas un message de bienvenue. Chaque militant
// arrive directement par son lien personnel (/t/[jeton]) ; l'équipe de
// campagne arrive par /admin.
export default function HomePage() {
  notFound();
}
