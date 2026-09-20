async function testCatalog() {
  const url = 'https://demo.inelabteamdev.com/api/catalog?page=1&pageSize=5';
  const res = await fetch(url);
  if (res.ok) {
    const data = await res.json();
    console.log('Catalog response:', JSON.stringify(data, null, 2));
  }
}
testCatalog().catch(console.error);
