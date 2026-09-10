/**
 * Script d'import de la liste électorale — exécuté EN LOCAL UNIQUEMENT,
 * jamais déployé (il vit dans scripts/, en dehors de app/, donc Next.js
 * ne l'inclut jamais dans le site publié).
 *
 * Usage :
 *   npm run import -- chemin/vers/fichier.xlsx
 *   npm run import -- chemin/vers/fichier.xlsx --dry-run
 *   npm run import -- chemin/vers/fichier.xlsx --centres "نص1,نص2"
 *
 * Variables d'environnement requises (mêmes que le site, voir README) :
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Ce script ne journalise JAMAIS un nom, une adresse ou un numéro de
 * téléphone : seulement des compteurs.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import type { Database } from "../lib/database.types";
import {
  computeAgeBracket,
  detectImmeuble,
  normalizeArabicAddress,
  parseAdresseVoie,
  type TrancheAge,
} from "../lib/import-utils";

// Colonnes attendues dans le fichier Excel (en-têtes exacts en arabe).
const COL_NOM = "الإسم العائلي";
const COL_PRENOM = "الإسم الشخصي";
const COL_ADRESSE = "العنوان";
const COL_DATE_NAISSANCE = "تاريخ الإزدياد";
const COL_ARRONDISSEMENT = "جماعة أو مقاطعة";
const COL_NUMERO_BUREAU = "رقم مكتب التصويت";
const COL_CENTRE_VOTE = "مكتب التصويت";

const DEFAULT_CENTRES = [
  "ثانوية الشريف الإدريسي التأهيلية",
  "مركز عمر بن الخطاب لمسارات الرياضة",
];

// Nom exact de la feuille contenant la liste électorale. NE PAS
// supposer que c'est la première feuille du classeur : un fichier reçu
// peut contenir des feuilles de résumé/tableaux croisés placées avant
// elle (c'est le cas du premier fichier reçu : "Sheet3" vient avant).
const FEUILLE_LISTE_PAR_DEFAUT = "لائحة الناخبين";

const JOUR_SCRUTIN = new Date("2026-09-23T00:00:00");
const TAILLE_TOURNEE = 30;

type LigneImportee = {
  nom: string;
  prenom: string;
  arrondissement: string;
  numeroBureau: string;
  centreVote: string;
  rue: string;
  numeroVoie: string;
  adresseBrute: string;
  immeuble: boolean;
  trancheAge: TrancheAge;
};

function parseArgs(argv: string[]) {
  const positional = argv.filter((a) => !a.startsWith("--"));
  const dryRun = argv.includes("--dry-run");
  const centresArg = argv.find((a) => a.startsWith("--centres="));
  const centres = centresArg
    ? centresArg.slice("--centres=".length).split(",").map((c) => c.trim())
    : DEFAULT_CENTRES;
  const feuilleArg = argv.find((a) => a.startsWith("--feuille="));
  const nomFeuille = feuilleArg ? feuilleArg.slice("--feuille=".length) : FEUILLE_LISTE_PAR_DEFAUT;
  const cheminFichier = positional[0];
  if (!cheminFichier) {
    console.error(
      "Usage : npm run import -- chemin/vers/fichier.xlsx [--dry-run] [--centres=\"نص1,نص2\"] [--feuille=\"nom\"]",
    );
    process.exit(1);
  }
  return { cheminFichier, dryRun, centres, nomFeuille };
}

/** Essaie plusieurs façons de lire une date de naissance. */
function parseBirthDate(raw: unknown): Date | null {
  if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? null : raw;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    // AAAA-MM-JJ ou AAAA/MM/JJ
    let m = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    // JJ-MM-AAAA ou JJ/MM/AAAA
    m = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    return null;
  }
  if (typeof raw === "number") {
    // Date sérielle Excel (nombre de jours depuis le 30/12/1899).
    const epoch = new Date(1899, 11, 30);
    return new Date(epoch.getTime() + raw * 86400000);
  }
  return null;
}

function readRows(cheminFichier: string, nomFeuille: string): Record<string, unknown>[] {
  const buffer = readFileSync(cheminFichier);
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  if (!workbook.SheetNames.includes(nomFeuille)) {
    console.error(
      `Feuille "${nomFeuille}" introuvable dans ce fichier. Feuilles disponibles : ${workbook.SheetNames.join(", ")}`,
    );
    console.error(`Utilisez --feuille="nom exact" pour préciser la bonne feuille.`);
    process.exit(1);
  }
  const sheet = workbook.Sheets[nomFeuille];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
}

function main() {
  const { cheminFichier, dryRun, centres, nomFeuille } = parseArgs(process.argv.slice(2));

  console.log(`Lecture du fichier... (feuille "${nomFeuille}", périmètre : ${centres.length} centre(s))`);
  const rawRows = readRows(cheminFichier, nomFeuille);
  console.log(`${rawRows.length} lignes lues au total.`);

  const lignes: LigneImportee[] = [];
  const anomalies = {
    horsPerimetre: 0,
    adresseVide: 0,
    dateInvalide: 0,
    ageInvalide: 0,
    bureauManquant: 0,
  };

  for (const row of rawRows) {
    const centreVote = String(row[COL_CENTRE_VOTE] ?? "").trim();
    if (!centres.includes(centreVote)) {
      anomalies.horsPerimetre++;
      continue;
    }

    const numeroBureau = String(row[COL_NUMERO_BUREAU] ?? "").trim();
    if (!numeroBureau) {
      anomalies.bureauManquant++;
      continue;
    }

    const adresseBrute = String(row[COL_ADRESSE] ?? "").trim();
    if (!adresseBrute) {
      anomalies.adresseVide++;
      continue;
    }
    const adresseNormalisee = normalizeArabicAddress(adresseBrute);
    const { rue, numeroVoie } = parseAdresseVoie(adresseNormalisee);
    const immeuble = detectImmeuble(adresseNormalisee);

    const birthDate = parseBirthDate(row[COL_DATE_NAISSANCE]);
    if (!birthDate) {
      anomalies.dateInvalide++;
      continue;
    }
    const trancheAge = computeAgeBracket(birthDate, JOUR_SCRUTIN);
    if (!trancheAge) {
      anomalies.ageInvalide++;
      continue;
    }

    lignes.push({
      nom: String(row[COL_NOM] ?? "").trim(),
      prenom: String(row[COL_PRENOM] ?? "").trim(),
      arrondissement: String(row[COL_ARRONDISSEMENT] ?? "").trim(),
      numeroBureau,
      centreVote,
      rue,
      numeroVoie,
      adresseBrute,
      immeuble,
      trancheAge,
    });
  }

  console.log(`${lignes.length} lignes retenues dans le périmètre.`);
  console.log("Anomalies :", anomalies);

  // Regroupement par bureau (centre + numéro).
  const bureauxMap = new Map<string, { centreVote: string; numeroBureau: string; arrondissement: string; lignes: LigneImportee[] }>();
  for (const ligne of lignes) {
    const cle = `${ligne.centreVote}|||${ligne.numeroBureau}`;
    if (!bureauxMap.has(cle)) {
      bureauxMap.set(cle, {
        centreVote: ligne.centreVote,
        numeroBureau: ligne.numeroBureau,
        arrondissement: ligne.arrondissement,
        lignes: [],
      });
    }
    bureauxMap.get(cle)!.lignes.push(ligne);
  }

  console.log(`${bureauxMap.size} bureau(x) distinct(s) dans le périmètre.`);

  let totalTournees = 0;
  for (const bureau of bureauxMap.values()) {
    totalTournees += Math.ceil(bureau.lignes.length / TAILLE_TOURNEE);
  }
  console.log(`${totalTournees} tournée(s) seront créées (${TAILLE_TOURNEE} portes maximum chacune).`);

  if (dryRun) {
    console.log("Mode --dry-run : rien n'a été écrit en base.");
    return;
  }

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    console.error("SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY doivent être définies.");
    process.exit(1);
  }
  const supabase = createClient<Database>(url, serviceRoleKey, { auth: { persistSession: false } });

  void importerEnBase(supabase, bureauxMap);
}

async function importerEnBase(
  supabase: ReturnType<typeof createClient<Database>>,
  bureauxMap: Map<string, { centreVote: string; numeroBureau: string; arrondissement: string; lignes: LigneImportee[] }>,
) {
  let bureauxCrees = 0;
  let tourneesCreees = 0;
  let portesCreees = 0;

  for (const bureau of bureauxMap.values()) {
    const { data: bureauRow, error: bureauError } = await supabase
      .from("bureaux")
      .upsert(
        {
          centre_vote: bureau.centreVote,
          numero_bureau: bureau.numeroBureau,
          arrondissement: bureau.arrondissement || null,
          nombre_inscrits: bureau.lignes.length,
        },
        { onConflict: "centre_vote,numero_bureau" },
      )
      .select("id")
      .single();

    if (bureauError || !bureauRow) {
      console.error(`Échec de création du bureau ${bureau.numeroBureau} :`, bureauError?.message);
      continue;
    }
    bureauxCrees++;

    // Tri par rue/groupe puis par numéro. { numeric: true } fait que
    // les nombres inclus dans le texte se comparent comme des nombres
    // et non lettre par lettre : "قطاع 2" passe bien avant "قطاع 12"
    // (une comparaison textuelle classique les aurait mis dans le
    // mauvais ordre, "1" < "2" caractère par caractère).
    const lignesTriees = [...bureau.lignes].sort((a, b) => {
      const rueCompare = a.rue.localeCompare(b.rue, "ar", { numeric: true });
      if (rueCompare !== 0) return rueCompare;
      return a.numeroVoie.localeCompare(b.numeroVoie, "ar", { numeric: true });
    });

    for (let i = 0; i < lignesTriees.length; i += TAILLE_TOURNEE) {
      const chunk = lignesTriees.slice(i, i + TAILLE_TOURNEE);
      const numeroTournee = Math.floor(i / TAILLE_TOURNEE) + 1;

      // Rue principale = la rue la plus fréquente de la tournée.
      const compteRues = new Map<string, number>();
      for (const l of chunk) compteRues.set(l.rue, (compteRues.get(l.rue) ?? 0) + 1);
      const ruePrincipale = [...compteRues.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

      const { data: tourneeRow, error: tourneeError } = await supabase
        .from("tournees")
        .upsert(
          {
            bureau_id: bureauRow.id,
            numero_tournee: numeroTournee,
            rue_principale: ruePrincipale,
            nombre_portes: chunk.length,
          },
          { onConflict: "bureau_id,numero_tournee" },
        )
        .select("id")
        .single();

      if (tourneeError || !tourneeRow) {
        console.error(`Échec de création de la tournée ${numeroTournee} du bureau ${bureau.numeroBureau} :`, tourneeError?.message);
        continue;
      }
      tourneesCreees++;

      const portesAInserer = chunk.map((ligne, ordre) => ({
        tournee_id: tourneeRow.id,
        bureau_id: bureauRow.id,
        adresse_brute: ligne.adresseBrute,
        rue: ligne.rue,
        numero_voie: ligne.numeroVoie || null,
        nom: ligne.nom,
        prenom: ligne.prenom,
        tranche_age: ligne.trancheAge,
        immeuble: ligne.immeuble,
        ordre,
      }));

      const { error: portesError, count } = await supabase
        .from("portes")
        .insert(portesAInserer, { count: "exact" });

      if (portesError) {
        console.error(`Échec d'insertion des portes (tournée ${numeroTournee}, bureau ${bureau.numeroBureau}) :`, portesError.message);
        continue;
      }
      portesCreees += count ?? portesAInserer.length;
    }
  }

  console.log("--- Résumé de l'import ---");
  console.log(`Bureaux créés/mis à jour : ${bureauxCrees}`);
  console.log(`Tournées créées : ${tourneesCreees}`);
  console.log(`Portes créées : ${portesCreees}`);
}

main();
