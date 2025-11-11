// Resync Firestore data to Algolia for solicitations with high scores
const admin = require('firebase-admin');
const { algoliasearch } = require('algoliasearch');

// Initialize Firebase
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  });
}

const db = admin.firestore();

// Initialize Algolia with WRITE key
const algolia = algoliasearch(
  process.env.NEXT_PUBLIC_ALGOLIA_ID,
  process.env.ALGOLIA_WRITE_KEY
);

async function resyncHighScores() {
  console.log('Fetching solicitations with aiPursueScore > 0.7 from Firestore...\n');

  const snapshot = await db.collection('solicitations')
    .where('aiPursueScore', '>', 0.7)
    .get();

  console.log(`Found ${snapshot.size} solicitations with high scores`);

  const objectsToUpdate = [];

  snapshot.forEach(doc => {
    const data = doc.data();
    // Convert Firestore data to Algolia format
    const algoliaObject = {
      objectID: doc.id,
      ...data,
      // Convert Firestore timestamps to Algolia-friendly format
      created: data.created,
      updated: data.updated,
      closingDate: data.closingDate,
      publishDate: data.publishDate,
    };

    objectsToUpdate.push(algoliaObject);

    console.log(`  Preparing ${doc.id}: cnType=${data.cnType}, cnStatus=${data.cnStatus}, score=${data.aiPursueScore}`);
  });

  if (objectsToUpdate.length === 0) {
    console.log('\nNo objects to update');
    return;
  }

  console.log(`\nUpdating ${objectsToUpdate.length} objects in Algolia...`);

  try {
    await algolia.saveObjects({
      indexName: 'solicitations',
      objects: objectsToUpdate,
    });

    console.log('✅ Successfully updated Algolia index!');
  } catch (error) {
    console.error('❌ Failed to update Algolia:', error);
    throw error;
  }
}

resyncHighScores()
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  });
