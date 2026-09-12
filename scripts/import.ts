/**
 * Script d'import de la liste électorale — exécuté EN LOCAL UNIQUEMENT,
 * jamais déployé (il vit dans scripts/, en dehors de app/, donc Next.js
 * ne l'inclut jamais dans le site publié).
 *
 * Usage :
 *   npm run import -- chemin/vers/fichier.xlsx
 *   npm run import -- chemin/vers/fichier.xlsx --dry-run
 *   npm run import -- chemin/vers/fichier.xlsx --centres "نص1,نص2"
 *   npm run import -- chemin/vers/fichier.xlsx --sql-out=import.sql
 *   npm run import -- chemin/vers/fichier.xlsx --sql-out=import.sql --exclure-bureaux=42,43,44
 *
 * Variables d'environnement requises pour l'écriture directe en base
 * (mêmes que le site, voir README) : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Avec --sql-out, ces variables ne sont pas nécessaires : le script
 * écrit un fichier .sql (à exécuter une seule fois, sur une base vide)
 * au lieu de se connecter à Supabase.
 *
 * Ce script ne journalise JAMAIS un nom, une adresse ou un numéro de
 * téléphone sur la sortie standard (compteurs uniquement) — le mode
 * --sql-out écrit ces informations dans le fichier .sql demandé, pas
 * sur la sortie standard.
 */
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
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
  const sqlOutArg = argv.find((a) => a.startsWith("--sql-out="));
  const sqlOut = sqlOutArg ? sqlOutArg.slice("--sql-out=".length) : null;
  // Bureaux déjà présents en base (numéro de bureau) à ne pas régénérer :
  // portes n'a pas de contrainte d'unicité, donc les réinsérer créerait
  // des doublons. À utiliser pour reprendre un import interrompu.
  const exclureArg = argv.find((a) => a.startsWith("--exclure-bureaux="));
  const exclureBureaux = exclureArg
    ? new Set(exclureArg.slice("--exclure-bureaux=".length).split(",").map((n) => n.trim()))
    : new Set<string>();
  const cheminFichier = positional[0];
  if (!cheminFichier) {
    console.error(
      "Usage : npm run import -- chemin/vers/fichier.xlsx [--dry-run] [--centres=\"نص1,نص2\"] [--feuille=\"nom\"] [--sql-out=chemin.sql] [--exclure-bureaux=42,43,44]",
    );
    process.exit(1);
  }
  return { cheminFichier, dryRun, centres, nomFeuille, sqlOut, exclureBureaux };
}

/** Échappe une valeur texte pour du SQL (guillemets simples doublés). */
function sqlStr(v: string | null): string {
  if (v === null) return "null";
  return `'${v.replace(/'/g, "''")}'`;
}
function sqlBool(v: boolean): string {
  return v ? "true" : "false";
}

/**
 * Trie les portes d'un bureau et les découpe en tournées de
 * TAILLE_TOURNEE portes maximum. Partagé entre le mode --sql-out et
 * l'écriture directe en base, pour que les deux produisent exactement
 * le même découpage.
 */
function construireTournees(lignes: LigneImportee[]): {
  numeroTournee: number;
  ruePrincipale: string | null;
  portes: LigneImportee[];
}[] {
  // { numeric: true } fait que les nombres inclus dans le texte se
  // comparent comme des nombres et non lettre par lettre : "قطاع 2"
  // passe bien avant "قطاع 12".
  const triees = [...lignes].sort((a, b) => {
    const rueCompare = a.rue.localeCompare(b.rue, "ar", { numeric: true });
    if (rueCompare !== 0) return rueCompare;
    return a.numeroVoie.localeCompare(b.numeroVoie, "ar", { numeric: true });
  });

  const tournees: { numeroTournee: number; ruePrincipale: string | null; portes: LigneImportee[] }[] = [];
  for (let i = 0; i < triees.length; i += TAILLE_TOURNEE) {
    const chunk = triees.slice(i, i + TAILLE_TOURNEE);
    const compteRues = new Map<string, number>();
    for (const l of chunk) compteRues.set(l.rue, (compteRues.get(l.rue) ?? 0) + 1);
    const ruePrincipale = [...compteRues.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    tournees.push({
      numeroTournee: Math.floor(i / TAILLE_TOURNEE) + 1,
      ruePrincipale,
      portes: chunk,
    });
  }
  return tournees;
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
  const { cheminFichier, dryRun, centres, nomFeuille, sqlOut, exclureBureaux } = parseArgs(process.argv.slice(2));

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

  if (exclureBureaux.size > 0) {
    let exclus = 0;
    for (const [cle, bureau] of bureauxMap) {
      if (exclureBureaux.has(bureau.numeroBureau)) {
        bureauxMap.delete(cle);
        exclus++;
      }
    }
    console.log(`${exclus} bureau(x) exclu(s) car déjà importé(s) : ${[...exclureBureaux].join(", ")}.`);
  }

  let totalTournees = 0;
  for (const bureau of bureauxMap.values()) {
    totalTournees += Math.ceil(bureau.lignes.length / TAILLE_TOURNEE);
  }
  console.log(`${totalTournees} tournée(s) seront créées (${TAILLE_TOURNEE} portes maximum chacune).`);

  if (dryRun) {
    console.log("Mode --dry-run : rien n'a été écrit en base.");
    return;
  }

  if (sqlOut) {
    ecrireSql(sqlOut, bureauxMap);
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

/**
 * Écrit un fichier .sql à exécuter une seule fois, sur une base vide
 * (les identifiants sont générés ici, pas de gestion de doublons).
 * N'a besoin d'aucune variable d'environnement Supabase.
 */
function ecrireSql(
  cheminSortie: string,
  bureauxMap: Map<string, { centreVote: string; numeroBureau: string; arrondissement: string; lignes: LigneImportee[] }>,
) {
  const lignesSql: string[] = [
    "-- Import généré automatiquement (scripts/import.ts --sql-out).",
    "-- Les identifiants sont fixés ici (randomUUID côté script) : ce fichier peut être",
    "-- découpé en morceaux et chaque insertion bureaux/tournees est protégée par",
    "-- ON CONFLICT DO NOTHING (rejouer un morceau par erreur est donc sans risque pour",
    "-- ces deux tables). Ce n'est PAS le cas pour les portes (pas de contrainte",
    "-- d'unicité) : ne jamais exécuter deux fois le même bloc \"insert into portes\".",
  ];
  let bureauxCrees = 0;
  let tourneesCreees = 0;
  let portesCreees = 0;

  for (const bureau of bureauxMap.values()) {
    const bureauId = randomUUID();
    bureauxCrees++;
    lignesSql.push(
      `insert into bureaux (id, centre_vote, numero_bureau, arrondissement, nombre_inscrits) values (${sqlStr(bureauId)}, ${sqlStr(bureau.centreVote)}, ${sqlStr(bureau.numeroBureau)}, ${sqlStr(bureau.arrondissement || null)}, ${bureau.lignes.length}) on conflict (centre_vote, numero_bureau) do nothing;`,
    );

    for (const tournee of construireTournees(bureau.lignes)) {
      const tourneeId = randomUUID();
      tourneesCreees++;
      lignesSql.push(
        `insert into tournees (id, bureau_id, numero_tournee, rue_principale, nombre_portes) values (${sqlStr(tourneeId)}, ${sqlStr(bureauId)}, ${tournee.numeroTournee}, ${sqlStr(tournee.ruePrincipale)}, ${tournee.portes.length}) on conflict (bureau_id, numero_tournee) do nothing;`,
      );

      const valeurs = tournee.portes.map(
        (ligne, ordre) =>
          `(${sqlStr(randomUUID())}, ${sqlStr(tourneeId)}, ${sqlStr(bureauId)}, ${sqlStr(ligne.adresseBrute)}, ${sqlStr(ligne.rue)}, ${sqlStr(ligne.numeroVoie || null)}, ${sqlStr(ligne.nom)}, ${sqlStr(ligne.prenom)}, ${sqlStr(ligne.trancheAge)}, ${sqlBool(ligne.immeuble)}, ${ordre})`,
      );
      // portes n'a pas de contrainte d'unicité — le "where not exists" rend
      // ce bloc sans effet si on le rejoue par erreur (déjà des portes pour
      // cette tournée), au lieu de dupliquer silencieusement les lignes.
      lignesSql.push(
        `insert into portes (id, tournee_id, bureau_id, adresse_brute, rue, numero_voie, nom, prenom, tranche_age, immeuble, ordre)\nselect * from (values\n  ${valeurs.join(",\n  ")}\n) as v(id, tournee_id, bureau_id, adresse_brute, rue, numero_voie, nom, prenom, tranche_age, immeuble, ordre)\nwhere not exists (select 1 from portes where tournee_id = ${sqlStr(tourneeId)});`,
      );
      portesCreees += tournee.portes.length;
    }
  }

  writeFileSync(cheminSortie, lignesSql.join("\n\n") + "\n", "utf-8");
  console.log(`Fichier SQL écrit : ${cheminSortie}`);
  console.log(`Bureaux : ${bureauxCrees}, Tournées : ${tourneesCreees}, Portes : ${portesCreees}`);
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

    for (const tournee of construireTournees(bureau.lignes)) {
      const { data: tourneeRow, error: tourneeError } = await supabase
        .from("tournees")
        .upsert(
          {
            bureau_id: bureauRow.id,
            numero_tournee: tournee.numeroTournee,
            rue_principale: tournee.ruePrincipale,
            nombre_portes: tournee.portes.length,
          },
          { onConflict: "bureau_id,numero_tournee" },
        )
        .select("id")
        .single();

      if (tourneeError || !tourneeRow) {
        console.error(`Échec de création de la tournée ${tournee.numeroTournee} du bureau ${bureau.numeroBureau} :`, tourneeError?.message);
        continue;
      }
      tourneesCreees++;

      const portesAInserer = tournee.portes.map((ligne, ordre) => ({
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
        console.error(`Échec d'insertion des portes (tournée ${tournee.numeroTournee}, bureau ${bureau.numeroBureau}) :`, portesError.message);
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
