"use client";

import { useState } from "react";

export interface Militant {
  id: string;
  prenom: string;
  jeton: string;
  actif: boolean;
  cree_le: string;
  revoque_le: string | null;
  nombre_tournees: number;
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Africa/Casablanca",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(iso));
}

/** Copie un texte dans le presse-papier, avec un message de confirmation bref. */
function useCopyFeedback() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  async function copy(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 2000);
    } catch {
      // Presse-papier indisponible (rare) : on ne bloque pas l'utilisateur.
    }
  }
  return { copiedKey, copy };
}

export default function MilitantsManager({ initialMilitants }: { initialMilitants: Militant[] }) {
  const [militants, setMilitants] = useState(initialMilitants);
  const [prenom, setPrenom] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);
  const { copiedKey, copy } = useCopyFeedback();

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  function lienDe(m: Militant) {
    return `${origin}/t/${m.jeton}`;
  }

  function messageWhatsApp(m: Militant) {
    return `Bonjour ${m.prenom}, voici ton lien personnel pour le porte-à-porte : ${lienDe(m)}\nGarde-le pour toi, ne le partage à personne d'autre.`;
  }

  async function creerMilitant(e: React.FormEvent) {
    e.preventDefault();
    if (!prenom.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/admin/militants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prenom: prenom.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCreateError(data.error === "prenom_requis" ? "Le prénom est obligatoire." : "Échec de la création.");
        return;
      }
      setMilitants((prev) => [{ ...data.militant, nombre_tournees: 0 }, ...prev]);
      setPrenom("");
    } catch {
      setCreateError("Échec de la création (réseau).");
    } finally {
      setCreating(false);
    }
  }

  async function revoquer(id: string) {
    if (!confirm("Couper l'accès de ce militant ? Il ne pourra plus ouvrir son lien.")) return;
    setRevokingId(id);
    try {
      const res = await fetch(`/api/admin/militants/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "revoquer" }),
      });
      if (res.ok) {
        setMilitants((prev) => prev.map((m) => (m.id === id ? { ...m, actif: false } : m)));
      }
    } finally {
      setRevokingId(null);
    }
  }

  async function revoquerTous() {
    if (
      !confirm(
        "Couper l'accès de TOUS les militants d'un coup ? Utilisez ce bouton uniquement le soir du 22 septembre. Cette action concerne tous les jetons actifs.",
      )
    )
      return;
    setRevokingAll(true);
    try {
      const res = await fetch("/api/admin/militants/revoke-all", { method: "POST" });
      if (res.ok) {
        setMilitants((prev) => prev.map((m) => (m.actif ? { ...m, actif: false } : m)));
      }
    } finally {
      setRevokingAll(false);
    }
  }

  const actifsCount = militants.filter((m) => m.actif).length;

  return (
    <div>
      <form onSubmit={creerMilitant} className="mb-6 flex flex-wrap items-end gap-3 rounded-lg border border-brand-line bg-white p-4">
        <div className="flex-1 min-w-[200px]">
          <label className="mb-1 block text-sm font-medium text-brand-ink" htmlFor="prenom-militant">
            Prénom du nouveau militant
          </label>
          <input
            id="prenom-militant"
            value={prenom}
            onChange={(e) => setPrenom(e.target.value)}
            className="w-full rounded border border-brand-line px-3 py-2 text-sm"
            placeholder="Ex. Yassine"
          />
        </div>
        <button
          type="submit"
          disabled={creating || !prenom.trim()}
          className="rounded-lg bg-brand-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {creating ? "Création..." : "Créer et générer le lien"}
        </button>
        {createError && <span className="text-sm text-red-600">{createError}</span>}
      </form>

      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-brand-ink/70">{actifsCount} militant(s) actif(s) sur {militants.length}</p>
        <button
          type="button"
          onClick={revoquerTous}
          disabled={revokingAll || actifsCount === 0}
          className="rounded-lg border border-red-600 px-3 py-1.5 text-xs font-semibold text-red-600 disabled:opacity-40"
        >
          {revokingAll ? "..." : "Révoquer tous les jetons"}
        </button>
      </div>

      {militants.length === 0 ? (
        <p className="text-sm text-brand-ink/70">Aucun militant pour l'instant.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-brand-line bg-white">
          <table className="w-full min-w-[700px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-brand-line bg-brand-paper text-left">
                <th className="p-2">Prénom</th>
                <th className="p-2 text-center">Tournées</th>
                <th className="p-2">Statut</th>
                <th className="p-2">Créé le</th>
                <th className="p-2">Lien</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {militants.map((m) => (
                <tr key={m.id} className="border-b border-brand-line align-top">
                  <td className="p-2 font-medium">{m.prenom}</td>
                  <td className="p-2 text-center">{m.nombre_tournees}</td>
                  <td className="p-2">
                    {m.actif ? (
                      <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">Actif</span>
                    ) : (
                      <span className="rounded bg-brand-line px-2 py-0.5 text-xs font-semibold text-brand-ink/60">Révoqué</span>
                    )}
                  </td>
                  <td className="p-2 whitespace-nowrap text-brand-ink/70">{formatDate(m.cree_le)}</td>
                  <td className="p-2">
                    {m.actif ? (
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => copy(`lien-${m.id}`, lienDe(m))}
                          className="rounded border border-brand-navy px-2 py-1 text-xs font-semibold text-brand-navy"
                        >
                          {copiedKey === `lien-${m.id}` ? "Copié !" : "Copier le lien"}
                        </button>
                        <button
                          type="button"
                          onClick={() => copy(`msg-${m.id}`, messageWhatsApp(m))}
                          className="rounded border border-brand-navy px-2 py-1 text-xs font-semibold text-brand-navy"
                        >
                          {copiedKey === `msg-${m.id}` ? "Copié !" : "Copier message WhatsApp"}
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-brand-ink/40">—</span>
                    )}
                  </td>
                  <td className="p-2">
                    {m.actif && (
                      <button
                        type="button"
                        onClick={() => revoquer(m.id)}
                        disabled={revokingId === m.id}
                        className="rounded border border-red-600 px-2 py-1 text-xs font-semibold text-red-600 disabled:opacity-40"
                      >
                        {revokingId === m.id ? "..." : "Révoquer"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
