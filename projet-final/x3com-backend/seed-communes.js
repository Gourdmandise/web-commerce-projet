/**
 * Script de peuplement — Table communes_fermeture_cuivre
 * Usage: node seed-communes.js <chemin-csv>
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } }
);

/**
 * Parse un fichier CSV simplement (sans dépendance)
 */
function parseCSV(csvPath) {
  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.trim().split('\n');
  const header = lines[0].split(',').map(h => h.trim());

  const rows = lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim());
    const obj = {};
    header.forEach((key, i) => {
      obj[key] = values[i] || null;
    });
    return obj;
  });

  return rows;
}

/**
 * Extrait code postal depuis insee_com (format XXYY...)
 * Format INSEE: XXYYYY où XX=dept, YYYY=commune
 * Pour le code postal, on peut utiliser dept + commune, mais c'est approximatif
 * Alternative: laisser vide ou utiliser le dept en préfixe
 */
function extraireCodePostal(inseeCom) {
  if (!inseeCom || inseeCom.length < 2) return '';
  // Format simple : dept + 000 (approximation)
  const dept = inseeCom.substring(0, 2);
  return `${dept}000`;
}

/**
 * Détermine le statut selon les colonnes de fermeture
 */
function determinerStatut(row) {
  const ferm25 = parseInt(row.ferm_cu25) || 0;
  const ferm26 = parseInt(row.ferm_cu26) || 0;
  const ferm27 = parseInt(row.ferm_cu27) || 0;
  const ferm28 = parseInt(row.ferm_cu28) || 0;
  const ferm29 = parseInt(row.ferm_cu29) || 0;
  const ferm30 = parseInt(row.ferm_cu30) || 0;

  const total = ferm25 + ferm26 + ferm27 + ferm28 + ferm29 + ferm30;

  if (total === 0) return 'programmee';
  if (total < parseInt(row.locaux_arcep || 0) / 2) return 'effective';
  return 'effectuee';
}

/**
 * Main
 */
async function main() {
  const csvPath = process.argv[2];

  if (!csvPath) {
    console.error('❌ Usage: node seed-communes.js <chemin-csv>');
    process.exit(1);
  }

  if (!fs.existsSync(csvPath)) {
    console.error(`❌ Fichier non trouvé: ${csvPath}`);
    process.exit(1);
  }

  console.log(`📖 Lecture du CSV: ${csvPath}`);
  const rows = parseCSV(csvPath);
  console.log(`✓ ${rows.length} communes trouvées\n`);

  // Préparer les données pour insertion
  const communes = rows.map(row => ({
    commune: row.com_lib || '',
    code_postal: extraireCodePostal(row.insee_com),
    region: '', // Pas dans le CSV, à laisser vide
    departement: row.dep_lib || row.insee_dep || '',
    date_fermeture_commerciale: null,
    date_fermeture_technique: null,
    statut: determinerStatut(row),
  }));

  // Insérer par batch de 100
  const BATCH_SIZE = 100;
  let inserted = 0;
  let errors = 0;

  try {
    for (let i = 0; i < communes.length; i += BATCH_SIZE) {
      const batch = communes.slice(i, i + BATCH_SIZE);
      const { data, error } = await supabase
        .from('communes_fermeture_cuivre')
        .insert(batch);

      if (error) {
        console.error(`❌ Batch ${Math.floor(i / BATCH_SIZE) + 1}:`, error.message);
        errors++;
      } else {
        inserted += batch.length;
        console.log(`✓ Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} communes`);
      }
    }

    console.log(`\n✅ Insertion terminée`);
    console.log(`   ✓ ${inserted} communes insérées`);
    console.log(`   ❌ ${errors} erreurs`);

  } catch (err) {
    console.error('❌ Erreur:', err.message);
    process.exit(1);
  }
}

main();
