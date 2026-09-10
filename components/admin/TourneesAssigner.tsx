"use client";

import { useMemo, useState } from "react";

export interface TourneeRow {
  id: string;
  numero_tournee: number;
  rue_principale: string | null;
  nombre_portes: number;
  bureau_numero: string;
  bureau_centre: string;
  militant_id: string | null;
  militant_prenom: string | null;
}

export interface MilitantOption {
  id: string;
  prenom: string;
}

export default function TourneesAssigner({
  initialTournees,
  militants,
}: {
  initialTournees: TourneeRow[];
  militants: MilitantOption[];
}) {
  const [tournees, setTournees] = useState(initialTournees);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [militantChoisi, setMilitantChoisi] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const parBureau = useMemo(() => {
    const groupes = new Map<string, TourneeRow[]>();
    for (const t of tournees) {
      const cle = `${t.bureau_centre} — Bureau ${t.bureau_numero}`;
      if (!groupes.has(cle)) groupes.set(cle, []);
      groupes.get(cle)!.push(t);
    }
    return groupes;
  }, [tournees]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toutCocherGroupe(ids: string[], cocher: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (cocher) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  async function assigner() {
    if (selected.size === 0 || !militantChoisi) return;
    setAssigning(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/tournees/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tourneeIds: [...selected], militantId: militantChoisi }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(
          data.error === "militant_revoque"
            ? "Ce militant a un jeton révoqué, impossible de lui assigner des tournées."
            : "Échec de l'assignation.",
        );
        return;
      }
      const militant = militants.find((m) => m.id === militantChoisi);
      setTournees((prev) =>
        prev.map((t) => (selected.has(t.id) ? { ...t, militant_id: militantChoisi, militant_prenom: militant?.prenom ?? null } : t)),
      );
      setMessage(`${data.assignees} tournée(s) assignée(s) à ${militant?.prenom ?? ""}.`);
      setSelected(new Set());
    } catch {
      setMessage("Échec de l'assignation (réseau).");
    } finally {
      setAssigning(false);
    }
  }

  if (tournees.length === 0) {
    return <p className="text-sm text-brand-ink/70">Aucune tournée pour l'instant.</p>;
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-brand-line bg-white p-4">
        <span className="text-sm text-brand-ink/70">{selected.size} tournée(s) cochée(s)</span>
        <select
          value={militantChoisi}
          onChange={(e) => setMilitantChoisi(e.target.value)}
          className="rounded border border-brand-line px-3 py-2 text-sm"
        >
          <option value="">Assigner à…</option>
          {militants.map((m) => (
            <option key={m.id} value={m.id}>
              {m.prenom}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={assigner}
          disabled={assigning || selected.size === 0 || !militantChoisi}
          className="rounded-lg bg-brand-navy px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {assigning ? "Assignation..." : "Assigner"}
        </button>
        {message && <span className="text-sm text-brand-ink">{message}</span>}
      </div>

      {[...parBureau.entries()].map(([bureau, lignes]) => {
        const ids = lignes.map((l) => l.id);
        const touscoches = ids.every((id) => selected.has(id));
        return (
          <div key={bureau} className="mb-4 overflow-x-auto rounded-lg border border-brand-line bg-white">
            <div className="flex items-center justify-between border-b border-brand-line bg-brand-paper p-2">
              <span className="text-sm font-semibold text-brand-ink">{bureau}</span>
              <button
                type="button"
                onClick={() => toutCocherGroupe(ids, !touscoches)}
                className="text-xs font-semibold text-brand-navy underline"
              >
                {touscoches ? "Tout décocher" : "Tout cocher"}
              </button>
            </div>
            <table className="w-full min-w-[600px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-brand-line text-left">
                  <th className="p-2"></th>
                  <th className="p-2">Tournée</th>
                  <th className="p-2">Rue principale</th>
                  <th className="p-2 text-center">Portes</th>
                  <th className="p-2">Assignée à</th>
                </tr>
              </thead>
              <tbody>
                {lignes.map((t) => (
                  <tr key={t.id} className="border-b border-brand-line">
                    <td className="p-2">
                      <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggle(t.id)} className="h-4 w-4" />
                    </td>
                    <td className="p-2">n° {t.numero_tournee}</td>
                    <td className="p-2 text-brand-ink/70">{t.rue_principale ?? "—"}</td>
                    <td className="p-2 text-center">{t.nombre_portes}</td>
                    <td className="p-2">
                      {t.militant_prenom ?? <span className="text-brand-ink/40">Non assignée</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
