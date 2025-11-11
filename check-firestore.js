const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  });
}

const db = admin.firestore();

async function checkSolicitations() {
  console.log('Querying Firestore solicitations collection...\n');

  // Count all solicitations
  const allSols = await db.collection('solicitations').get();
  console.log(`Total solicitations in Firestore: ${allSols.size}`);

  // Count by cnStatus
  const statuses = ['new', 'pursuing', 'notPursuing', 'submitted', 'won', 'lost'];
  for (const status of statuses) {
    const snapshot = await db.collection('solicitations')
      .where('cnStatus', '==', status)
      .get();
    console.log(`  cnStatus="${status}": ${snapshot.size}`);
  }

  // Count by cnType
  const types = ['nonRelevant', 'relevant'];
  console.log('\nBy cnType:');
  for (const type of types) {
    const snapshot = await db.collection('solicitations')
      .where('cnType', '==', type)
      .get();
    console.log(`  cnType="${type}": ${snapshot.size}`);
  }

  // Count with cnType NOT equal to nonRelevant
  const notNonRelevant = await db.collection('solicitations')
    .where('cnType', '!=', 'nonRelevant')
    .get();
  console.log(`  cnType != "nonRelevant": ${notNonRelevant.size}`);

  // Get a few samples with new status
  console.log('\nSample solicitations with cnStatus="new":');
  const newSols = await db.collection('solicitations')
    .where('cnStatus', '==', 'new')
    .limit(3)
    .get();

  newSols.forEach(doc => {
    const data = doc.data();
    console.log(`  - ${doc.id}: cnType=${data.cnType}, aiScore=${data.aiScore}, title=${data.title?.substring(0, 50)}...`);
  });

  // Check how many have aiPursueScore > 0.7
  console.log('\nChecking aiPursueScore field:');
  const allDocs = await db.collection('solicitations').limit(1000).get();
  let highScoreCount = 0;
  let highScoreNonRelevantCount = 0;
  let highScoreRelevantCount = 0;
  let highScoreRelevantNewCount = 0;
  const highScoreRelevantSamples = [];

  allDocs.forEach(doc => {
    const data = doc.data();
    if (data.aiPursueScore && data.aiPursueScore > 0.7) {
      highScoreCount++;
      if (data.cnType === 'nonRelevant') {
        highScoreNonRelevantCount++;
      } else {
        highScoreRelevantCount++;
        if (data.cnStatus === 'new') {
          highScoreRelevantNewCount++;
          if (highScoreRelevantSamples.length < 5) {
            highScoreRelevantSamples.push({
              id: doc.id,
              cnStatus: data.cnStatus,
              cnType: data.cnType,
              aiPursueScore: data.aiPursueScore,
              title: data.title?.substring(0, 50)
            });
          }
        }
      }
    }
  });

  console.log(`Solicitations with aiPursueScore > 0.7: ${highScoreCount}`);
  console.log(`  - With cnType="nonRelevant": ${highScoreNonRelevantCount}`);
  console.log(`  - With cnType!="nonRelevant": ${highScoreRelevantCount}`);
  console.log(`  - With cnType!="nonRelevant" AND cnStatus="new": ${highScoreRelevantNewCount}`);

  if (highScoreRelevantSamples.length > 0) {
    console.log('\nSample high-score items that SHOULD be visible:');
    highScoreRelevantSamples.forEach(sample => {
      console.log(`  - ${sample.id}: score=${sample.aiPursueScore}, cnStatus=${sample.cnStatus}, cnType=${sample.cnType}`);
      console.log(`    title: ${sample.title}`);
    });
  }
}

checkSolicitations()
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  });
