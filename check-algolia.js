const { algoliasearch } = require('algoliasearch');

const client = algoliasearch(
  process.env.ALGOLIA_ID,
  process.env.ALGOLIA_SEARCH_KEY
);

async function checkAlgolia() {
  console.log('Checking Algolia index...\n');

  // Search for all records with cnStatus=new
  const newStatusResp = await client.search({
    requests: [{
      indexName: 'solicitations',
      query: '',
      filters: 'cnStatus:"new"',
      hitsPerPage: 1000,
    }]
  });

  const newResult = newStatusResp.results[0];
  console.log(`Algolia: solicitations with cnStatus="new": ${newResult.nbHits}`);
  console.log(`  (returned ${newResult.hits.length} hits in this page)`);

  // Search for all records (excluding nonRelevant)
  const allResp = await client.search({
    requests: [{
      indexName: 'solicitations',
      query: '',
      filters: 'NOT cnType:"nonRelevant"',
      hitsPerPage: 1000,
    }]
  });

  const allResult = allResp.results[0];
  console.log(`\nAlgolia: solicitations (excluding nonRelevant): ${allResult.nbHits}`);
  console.log(`  (returned ${allResult.hits.length} hits in this page)`);

  // Get total count
  const totalResp = await client.search({
    requests: [{
      indexName: 'solicitations',
      query: '',
      hitsPerPage: 0,
    }]
  });

  const totalResult = totalResp.results[0];
  console.log(`\nAlgolia: total solicitations: ${totalResult.nbHits}`);

  // Sample a few from cnStatus=new
  console.log(`\nSample records with cnStatus="new":`);
  newResult.hits.slice(0, 3).forEach(hit => {
    console.log(`  - ${hit.objectID}: cnType=${hit.cnType}, aiScore=${hit.aiScore}, title=${hit.title?.substring(0, 50)}...`);
  });
}

checkAlgolia()
  .then(() => {
    console.log('\nDone!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  });
