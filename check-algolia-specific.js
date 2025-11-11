// Check specific solicitation IDs in Algolia vs Firestore
const admin = require('firebase-admin');
const { algoliasearch } = require('algoliasearch');

// Initialize Firebase
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  });
}

const db = admin.firestore();

// Initialize Algolia
const algolia = algoliasearch(
  process.env.NEXT_PUBLIC_ALGOLIA_ID,
  process.env.ALGOLIA_ADMIN_KEY  // Need admin key to read records
);

const highScoreIds = [
  '03c7zGKUyVAnMnSeeGhC',
  '19YE86s5nsU2ZmmWjXFq',
  '3BG6dwqt0OcTHUv3rAwh',
  '5rNYryBDGfCdEt9rklZR',
  '93zc5lwoV1cwfjSeeVgO'
];

async function checkSync() {
  console.log('Checking Firestore vs Algolia for high-score items...\n');

  for (const id of highScoreIds) {
    // Get from Firestore
    const fireDoc = await db.collection('solicitations').doc(id).get();
    const fireData = fireDoc.data();

    // Get from Algolia
    let algoliaData = null;
    try {
      algoliaData = await algolia.getObject({
        indexName: 'solicitations',
        objectID: id
      });
    } catch (err) {
      console.log(`[${id}] NOT FOUND in Algolia`);
    }

    console.log(`\n[${id}]`);
    console.log(`  Firestore: cnStatus=${fireData?.cnStatus}, cnType=${fireData?.cnType}, aiPursueScore=${fireData?.aiPursueScore}`);
    if (algoliaData) {
      console.log(`  Algolia:   cnStatus=${algoliaData.cnStatus}, cnType=${algoliaData.cnType}, aiPursueScore=${algoliaData.aiPursueScore}`);

      if (fireData?.cnType !== algoliaData.cnType || fireData?.aiPursueScore !== algoliaData.aiPursueScore) {
        console.log(`  ⚠️  MISMATCH DETECTED!`);
      }
    }
  }
}

checkSync()
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  });
