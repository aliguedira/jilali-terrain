// Page générique, volontairement sans aucune information : ni le nom de
// la campagne, ni la nature de l'application. Utilisée pour toute route
// invalide, y compris "/".
export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6 text-center">
      <p className="text-sm text-brand-ink/60">Page introuvable.</p>
    </main>
  );
}
