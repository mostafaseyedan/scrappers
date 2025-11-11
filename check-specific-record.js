const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  });
}

const db = admin.firestore();

async function checkRecord() {
  console.log('Searching for record with title "RFP 2026-031 Enterprise Resource Planning"...\n');

  // Search by title
  const snapshot = await db.collection('solicitations')
    .where('title', '>=', 'RFP 2026-031')
    .where('title', '<=', 'RFP 2026-031\uf8ff')
    .get();

  if (snapshot.empty) {
    console.log('No matching records found. Trying broader search...');

    // Try by siteId
    const snapshot2 = await db.collection('solicitations')
      .where('siteId', '==', 'bidsync-37c9512c-f446-4a4f-a03a-86ed9c07be1b')
      .get();

    if (snapshot2.empty) {
      console.log('Still no match. Let me search all records...');
      const allDocs = await db.collection('solicitations').limit(3000).get();

      allDocs.forEach(doc => {
        const data = doc.data();
        if (data.title && data.title.includes('RFP 2026-031')) {
          console.log(`\nFound matching record:`);
          console.log(`  ID: ${doc.id}`);
          console.log(`  Title: ${data.title}`);
          console.log(`  Issuer: ${data.issuer}`);
          console.log(`  Location: ${data.location}`);
          console.log(`  cnStatus: ${data.cnStatus}`);
          console.log(`  cnType: ${data.cnType}`);
          console.log(`  aiPursueScore: ${data.aiPursueScore}`);
          console.log(`  siteId: ${data.siteId}`);
        }
      });
      return;
    }

    snapshot2.forEach(doc => {
      const data = doc.data();
      console.log(`\nFound record by siteId:`);
      console.log(`  ID: ${doc.id}`);
      console.log(`  Title: ${data.title}`);
      console.log(`  Issuer: ${data.issuer}`);
      console.log(`  Location: ${data.location}`);
      console.log(`  cnStatus: ${data.cnStatus}`);
      console.log(`  cnType: ${data.cnType}`);
      console.log(`  aiPursueScore: ${data.aiPursueScore}`);
      console.log(`  siteId: ${data.siteId}`);
    });
    return;
  }

  snapshot.forEach(doc => {
    const data = doc.data();
    console.log(`Found record:`);
    console.log(`  ID: ${doc.id}`);
    console.log(`  Title: ${data.title}`);
    console.log(`  Issuer: ${data.issuer}`);
    console.log(`  Location: ${data.location}`);
    console.log(`  cnStatus: ${data.cnStatus}`);
    console.log(`  cnType: ${data.cnType}`);
    console.log(`  aiPursueScore: ${data.aiPursueScore}`);
    console.log(`  siteId: ${data.siteId}`);
  });
}

checkRecord()
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  });
