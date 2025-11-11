const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  });
}

const db = admin.firestore();

async function checkCnTypeValues() {
  console.log('Checking all unique cnType values in Firestore...\n');

  const snapshot = await db.collection('solicitations').limit(1000).get();

  const cnTypeValues = new Set();
  const cnTypeCounts = {};

  snapshot.forEach(doc => {
    const data = doc.data();
    const cnType = data.cnType;
    const key = cnType === undefined ? 'undefined' : cnType === null ? 'null' : cnType === '' ? 'empty_string' : cnType;

    cnTypeValues.add(key);
    cnTypeCounts[key] = (cnTypeCounts[key] || 0) + 1;
  });

  console.log('Unique cnType values found:');
  Array.from(cnTypeValues).sort().forEach(value => {
    console.log(`  - "${value}": ${cnTypeCounts[value]} documents`);
  });

  console.log(`\nTotal documents checked: ${snapshot.size}`);
}

checkCnTypeValues()
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  });
