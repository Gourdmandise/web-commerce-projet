/**
 * Script de peuplement — Table communes_fermeture_cuivre (v2 — robuste)
 * Usage: node seed-communes-v2.js <chemin-csv>
 * Installe: npm install csv-parser
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } }
);

async function main() {
  const csvPath = process.argv[2];

  if (!csvPath) {
    console.error('❌ Usage: node seed-communes-v2.js <chemin-csv>');
    process.exit(1);
  }

  if (!fs.existsSync(csvPath)) {
    console.error(`❌ Fichier non trouvé: ${csvPath}`);
    process.exit(1);
  }

  console.log(`📖 Lecture du CSV: ${csvPath}`);

  const communes = [];
  let rowCount = 0;

  return new Promise((resolve, reject) => {
    fs.createReadStream(csvPath)
      .pipe(csv())
      .on('data', (row) => {
        rowCount++;
        const ferm25 = parseInt(row.ferm_cu25) || 0;
        const ferm26 = parseInt(row.ferm_cu26) || 0;
        const ferm27 = parseInt(row.ferm_cu27) || 0;
        const ferm28 = parseInt(row.ferm_cu28) || 0;
        const ferm29 = parseInt(row.ferm_cu29) || 0;
        const ferm30 = parseInt(row.ferm_cu30) || 0;
        const total = ferm25 + ferm26 + ferm27 + ferm28 + ferm29 + ferm30;
        const locaux = parseInt(row.locaux_arcep) || 0;

        let statut = 'programmee';
        if (total > 0) {
          if (total >= locaux) statut = 'effectuee';
          else statut = 'effective';
        }

        communes.push({
          commune: row.com_lib || '',
          code_postal: row.insee_com.substring(0, 2) + '000', // Approximation
          region: '',
          departement: row.dep_lib || row.insee_dep || '',
          date_fermeture_commerciale: null,
          date_fermeture_technique: null,
          statut,
        });
      })
      .on('end', async () => {
        console.log(`✓ ${rowCount} lignes lues\n`);

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

          console.log(`\n✅ Import terminé`);
          console.log(`   ✓ ${inserted} communes insérées`);
          if (errors > 0) console.log(`   ❌ ${errors} erreurs`);
          resolve();
        } catch (err) {
          console.error('❌ Erreur:', err.message);
          reject(err);
        }
      })
      .on('error', reject);
  });
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
