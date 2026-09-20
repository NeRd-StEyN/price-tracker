async function testAll() {
  const BASE = 'http://localhost:3000';

  console.log('--- 1. GET /api/stats ---');
  const statsRes = await fetch(`${BASE}/api/stats`);
  console.log('Status:', statsRes.status, await statsRes.json());

  console.log('\n--- 2. GET /api/products ---');
  const prodsRes = await fetch(`${BASE}/api/products`);
  const products = await prodsRes.json();
  console.log('Status:', prodsRes.status, 'Count:', products.length);

  if (products.length > 0) {
    const pid = products[0].id;
    console.log(`\n--- 3. GET /api/products/${pid} ---`);
    const detailRes = await fetch(`${BASE}/api/products/${pid}`);
    console.log('Status:', detailRes.status, await detailRes.json());

    console.log(`\n--- 4. GET /api/products/${pid}/history?range=7d ---`);
    const histRes = await fetch(`${BASE}/api/products/${pid}/history?range=7d`);
    console.log('Status:', histRes.status, 'Good reads count:', (await histRes.json()).length);

    console.log(`\n--- 5. GET /api/products/${pid}/logs?limit=5 ---`);
    const logsRes = await fetch(`${BASE}/api/products/${pid}/logs?limit=5`);
    console.log('Status:', logsRes.status, 'Logs count:', (await logsRes.json()).length);

    console.log(`\n--- 6. PATCH /api/products/${pid} ---`);
    const patchRes = await fetch(`${BASE}/api/products/${pid}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scrape_interval_minutes: 360 })
    });
    console.log('Status:', patchRes.status, 'Updated interval:', (await patchRes.json()).scrape_interval_minutes);
  }
}

testAll().catch(console.error);
