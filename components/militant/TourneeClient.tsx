"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ajouterALaFile,
  chargerFile,
  chargerPortesCache,
  genererClientId,
  retirerDeLaFile,
  sauvegarderPortesCache,
  type SaisieEnAttente,
  type Statut,
} from "@/lib/offline-queue";

export interface PorteData {
  id: string;
  adresse_brute: string;
  rue: string;
  numero_voie: string | null;
  nom: string;
  prenom: string;
  tranche_age: string;
  immeuble: boolean;
  ordre: number;
  statut: Statut | null;
  telephone: string | null;
  consentement: boolean;
  observation: string | null;
}

const STATUTS: { valeur: Statut; label: string; couleur: string }[] = [
  { valeur: "contacte", label: "Contacté", couleur: "bg-brand-green" },
  { valeur: "absent", label: "Absent", couleur: "bg-gray-500" },
  { valeur: "porte_fermee", label: "Fermée", couleur: "bg-gray-700" },
  { valeur: "refus", label: "Refus", couleur: "bg-brand-red" },
  { valeur: "carte_remise", label: "Carte", couleur: "bg-brand-amber" },
];

const TEXTE_CONSENTEMENT = "La personne accepte de recevoir un message de rappel avant le 23 septembre.";

export default function TourneeClient({
  jeton,
  tourneeId,
  bureauNumero,
  initialPortes,
}: {
  jeton: string;
  tourneeId: string;
  bureauNumero: string;
  initialPortes: PorteData[];
}) {
  const [portes, setPortes] = useState<PorteData[]>(initialPortes);
  const [enAttenteIds, setEnAttenteIds] = useState<Set<string>>(new Set());
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [enLigne, setEnLigne] = useState(true);
  const enVolDeSync = useRef(false);

  // Au montage : fusionne le cache local (saisies pas encore
  // synchronisées) par-dessus les données fraîches du serveur, pour
  // ne jamais faire régresser une saisie à l'écran.
  useEffect(() => {
    const file = chargerFile(jeton).filter((s) => s.tourneeId === tourneeId);
    if (file.length > 0) {
      setPortes((prev) =>
        prev.map((p) => {
          const enAttente = [...file].reverse().find((s) => s.porteId === p.id);
          if (!enAttente) return p;
          return {
            ...p,
            statut: enAttente.statut,
            telephone: enAttente.telephone,
            consentement: enAttente.consentement,
            observation: enAttente.observation,
          };
        }),
      );
      setEnAttenteIds(new Set(file.map((s) => s.porteId)));
    }
    setEnLigne(navigator.onLine);
  }, [jeton, tourneeId]);

  // Sauvegarde le cache local à chaque changement, pour une
  // consultation possible sans réseau au sein de la même session.
  useEffect(() => {
    sauvegarderPortesCache(tourneeId, portes);
  }, [tourneeId, portes]);

  const envoyerSaisie = useCallback(
    async (saisie: SaisieEnAttente) => {
      try {
        const res = await fetch(`/api/t/${jeton}/statut`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            porteId: saisie.porteId,
            clientId: saisie.clientId,
            statut: saisie.statut,
            telephone: saisie.telephone,
            consentement: saisie.consentement,
            observation: saisie.observation,
          }),
        });
        if (res.ok) {
          retirerDeLaFile(jeton, saisie.clientId);
          setEnAttenteIds((prev) => {
            const next = new Set(prev);
            next.delete(saisie.porteId);
            return next;
          });
          return true;
        }
      } catch {
        // Pas de réseau ou erreur : la saisie reste dans la file,
        // elle sera retentée automatiquement.
      }
      return false;
    },
    [jeton],
  );

  const viderLaFile = useCallback(async () => {
    if (enVolDeSync.current) return;
    enVolDeSync.current = true;
    try {
      const file = chargerFile(jeton);
      for (const saisie of file) {
        // eslint-disable-next-line no-await-in-loop
        await envoyerSaisie(saisie);
      }
    } finally {
      enVolDeSync.current = false;
    }
  }, [jeton, envoyerSaisie]);

  useEffect(() => {
    function surRetourReseau() {
      setEnLigne(true);
      void viderLaFile();
    }
    function surPerteReseau() {
      setEnLigne(false);
    }
    window.addEventListener("online", surRetourReseau);
    window.addEventListener("offline", surPerteReseau);
    const intervalle = setInterval(() => {
      if (navigator.onLine) void viderLaFile();
    }, 15000);
    void viderLaFile();
    return () => {
      window.removeEventListener("online", surRetourReseau);
      window.removeEventListener("offline", surPerteReseau);
      clearInterval(intervalle);
    };
  }, [viderLaFile]);

  function enregistrerSaisie(porteId: string, statut: Statut, extra?: Partial<Pick<PorteData, "telephone" | "consentement" | "observation">>) {
    const telephone = extra?.telephone ?? null;
    const consentement = extra?.consentement ?? false;
    const observation = extra?.observation ?? null;

    setPortes((prev) => prev.map((p) => (p.id === porteId ? { ...p, statut, telephone, consentement, observation } : p)));
    setEnAttenteIds((prev) => new Set(prev).add(porteId));

    const saisie: SaisieEnAttente = {
      clientId: genererClientId(),
      porteId,
      tourneeId,
      statut,
      telephone,
      consentement,
      observation,
      creeLe: new Date().toISOString(),
    };
    ajouterALaFile(jeton, saisie);
    void envoyerSaisie(saisie);
  }

  function tapStatut(porte: PorteData, statut: Statut) {
    if (statut === "contacte") {
      // "Contacté" s'enregistre tout de suite (un seul geste), et on
      // ouvre le petit formulaire pour ajouter le téléphone si besoin.
      enregistrerSaisie(porte.id, statut, {
        telephone: porte.statut === "contacte" ? porte.telephone : null,
        consentement: porte.statut === "contacte" ? porte.consentement : false,
        observation: porte.statut === "contacte" ? porte.observation : null,
      });
      setOuvert(porte.id);
    } else {
      enregistrerSaisie(porte.id, statut);
      setOuvert(null);
    }
  }

  const faites = portes.filter((p) => p.statut !== null).length;
  const enAttenteCount = enAttenteIds.size;

  return (
    <div>
      <div
        className={`sticky top-0 z-10 mb-3 flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${
          enAttenteCount > 0 ? "border-brand-amber bg-amber-50" : "border-brand-green bg-green-50"
        }`}
      >
        <span>
          Bureau {bureauNumero} — {faites}/{portes.length} portes
        </span>
        <span className="font-semibold">
          {enAttenteCount > 0 ? `${enAttenteCount} en attente` : "Tout synchronisé"}
          {!enLigne && " · Hors ligne"}
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {portes.map((porte) => (
          <div key={porte.id} className="rounded-xl border border-brand-line bg-white p-3 shadow-sm">
            <div className="mb-2 flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-brand-ink">
                  {porte.nom} {porte.prenom}
                  {porte.immeuble && <span className="ml-1" title="Immeuble">🏢</span>}
                </p>
                <p className="text-xs text-brand-ink/70">{porte.adresse_brute}</p>
              </div>
              <span className="shrink-0 rounded-full bg-brand-paper px-2 py-0.5 text-xs font-medium text-brand-ink/70">
                {porte.tranche_age}
              </span>
            </div>

            <div className="grid grid-cols-5 gap-1.5">
              {STATUTS.map((s) => {
                const actif = porte.statut === s.valeur;
                return (
                  <button
                    key={s.valeur}
                    type="button"
                    onClick={() => tapStatut(porte, s.valeur)}
                    className={`rounded-lg py-3 text-[11px] font-semibold text-white ${actif ? s.couleur : "bg-brand-line text-brand-ink/60"}`}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>

            {porte.statut === "contacte" && ouvert === porte.id && (
              <FormulaireContact
                porte={porte}
                onEnregistrer={(extra) => enregistrerSaisie(porte.id, "contacte", extra)}
                onFermer={() => setOuvert(null)}
              />
            )}
            {porte.statut === "contacte" && ouvert !== porte.id && (
              <button
                type="button"
                onClick={() => setOuvert(porte.id)}
                className="mt-2 text-xs font-semibold text-brand-navy underline"
              >
                {porte.telephone ? "Modifier le téléphone / la note" : "Ajouter un téléphone / une note"}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function FormulaireContact({
  porte,
  onEnregistrer,
  onFermer,
}: {
  porte: PorteData;
  onEnregistrer: (extra: { telephone: string | null; consentement: boolean; observation: string | null }) => void;
  onFermer: () => void;
}) {
  const [telephone, setTelephone] = useState(porte.telephone ?? "");
  const [consentement, setConsentement] = useState(porte.consentement);
  const [observation, setObservation] = useState(porte.observation ?? "");

  function valider() {
    // Sans la case cochée, le téléphone n'est jamais envoyé (le
    // serveur le refuserait de toute façon) : on enregistre alors
    // juste l'observation, sans bloquer la saisie du militant.
    onEnregistrer({
      telephone: consentement ? telephone.trim() || null : null,
      consentement,
      observation: observation.trim() || null,
    });
    onFermer();
  }

  return (
    <div className="mt-3 rounded-lg border border-brand-line bg-brand-paper p-3">
      <label className="mb-1 block text-xs font-medium text-brand-ink" htmlFor={`tel-${porte.id}`}>
        Téléphone (facultatif)
      </label>
      <input
        id={`tel-${porte.id}`}
        inputMode="tel"
        value={telephone}
        onChange={(e) => setTelephone(e.target.value)}
        placeholder="06XXXXXXXX"
        className="mb-2 w-full rounded border border-brand-line px-3 py-2 text-sm"
      />

      <label className="mb-2 flex items-start gap-2 text-xs text-brand-ink">
        <input
          type="checkbox"
          checked={consentement}
          onChange={(e) => setConsentement(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0"
        />
        <span>{TEXTE_CONSENTEMENT}</span>
      </label>

      <label className="mb-1 block text-xs font-medium text-brand-ink" htmlFor={`obs-${porte.id}`}>
        Observation (facultatif)
      </label>
      <textarea
        id={`obs-${porte.id}`}
        value={observation}
        onChange={(e) => setObservation(e.target.value)}
        rows={2}
        className="mb-2 w-full rounded border border-brand-line px-3 py-2 text-sm"
      />

      {telephone.trim() && !consentement && (
        <p className="mb-2 text-xs text-brand-red">Le téléphone ne sera pas enregistré sans la case cochée.</p>
      )}

      <div className="flex gap-2">
        <button type="button" onClick={valider} className="rounded-lg bg-brand-navy px-4 py-2 text-sm font-semibold text-white">
          Enregistrer
        </button>
        <button type="button" onClick={onFermer} className="rounded-lg border border-brand-line px-4 py-2 text-sm text-brand-ink">
          Fermer
        </button>
      </div>
    </div>
  );
}
