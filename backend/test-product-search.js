const { searchProducts } = require('./product.service');

const queries = [
  'Auralite Smart Bulb Pro', // full name
  'Auralite',                // partial
  'bulb',                    // partial, different word
  'auralite',                // case-insensitive
  'xyznonexistent',          // no match
];

async function main() {
  console.log('Loading catalog and running searches (first run fetches all 50 pages, may take a few seconds)...\n');

  for (const q of queries) {
    const results = await searchProducts(q);
    console.log(`Search: "${q}"`);
    console.log(`Results (${results.length}):`);
    console.log(JSON.stringify(results, null, 2));
    console.log('');
  }
}

main().catch((err) => {
  console.error('Test failed:', err.message);
  process.exitCode = 1;
});