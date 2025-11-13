const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  });
}

const db = admin.firestore();

(async () => {
  const snapshot = await db.collection('solicitations')
    .orderBy('updated', 'desc')
    .limit(3000)
    .get();

  console.log('Total fetched:', snapshot.size);

  const relevantDocs = [];
  const nonRelevantDocs = [];
  const statusCounts = {};
  const missingStatus = [];

  const validStatuses = ['new', 'researching', 'pursuing', 'preApproval', 'submitted', 'negotiation', 'monitor', 'foia', 'awarded', 'notWon', 'notPursuing'];

  snapshot.forEach(doc => {
    const data = doc.data();
    if (data.cnType === 'nonRelevant') {
      nonRelevantDocs.push(doc.id);
    } else {
      relevantDocs.push(doc.id);
      const status = data.cnStatus;

      if (!status || status === '') {
        missingStatus.push({ id: doc.id, status: status });
      } else if (!validStatuses.includes(status)) {
        missingStatus.push({ id: doc.id, status: status });
      }

      statusCounts[status] = (statusCounts[status] || 0) + 1;
    }
  });

  console.log('Relevant docs:', relevantDocs.length);
  console.log('NonRelevant docs:', nonRelevantDocs.length);
  console.log('\nStatus counts:', statusCounts);
  console.log('\nDocs with missing or invalid cnStatus:', missingStatus.length);
  if (missingStatus.length > 0) {
    console.log('First 10 examples:', missingStatus.slice(0, 10));
  }

  const sumOfCounts = Object.values(statusCounts).reduce((a, b) => a + b, 0);
  console.log('\nSum of all status counts:', sumOfCounts);
  console.log('Relevant docs count:', relevantDocs.length);
  console.log('MISMATCH:', sumOfCounts !== relevantDocs.length ? 'YES - FOUND THE ISSUE!' : 'No');

  process.exit(0);
})();
