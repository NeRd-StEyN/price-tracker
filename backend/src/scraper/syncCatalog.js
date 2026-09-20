import { supabase } from '../db.js';

/**
 * Synchronizes the target store's catalog into our local Supabase database.
 * Fetches pages sequentially to avoid triggering the target server's rate limits.
 */
export async function syncCatalog() {
  console.log('🔄 Starting Catalog Sync...');
  
  // 1. Get all IDs we currently know about so we can track new discoveries
  const { data: existingData } = await supabase.from('catalog').select('id');
  const existingIds = new Set(existingData?.map(row => row.id) || []);
  
  let totalNewFound = 0;
  let currentPage = 1;
  let totalPages = 1;

  try {
    while (currentPage <= totalPages) {
      console.log(`  ...Fetching catalog page ${currentPage} of ${totalPages}`);
      const url = `https://demo.inelabteamdev.com/api/catalog?page=${currentPage}&pageSize=100`;
      
      const response = await fetch(url);
      if (!response.ok) {
        if (response.status === 429) {
          console.error(`  ...Rate limited (429) on page ${currentPage}. Backing off for 10s...`);
          await new Promise(resolve => setTimeout(resolve, 10000));
          continue; // Retry the same page
        }
        throw new Error(`Failed to fetch catalog page ${currentPage}: ${response.status}`);
      }

      const data = await response.json();
      const items = data.items || [];
      
      if (currentPage === 1 && data.pages) {
        totalPages = data.pages;
        console.log(`  ...Total catalog pages to sync: ${totalPages}`);
      }

      // Find items we haven't seen before or update metadata
      const newItemsMap = new Map();
      for (const item of items) {
        newItemsMap.set(String(item.id), {
          id: String(item.id),
          name: item.name,
          brand: item.brand || null,
          sku: item.sku || null,
          category: item.category || null,
          url: `https://demo.inelabteamdev.com/product/${item.id}`,
          image_url: null,
          last_seen_at: new Date().toISOString()
        });
      }
      
      const newItems = Array.from(newItemsMap.values());
      
      if (newItems.length > 0) {
        totalNewFound += newItems.length;
        console.log(`  ...Upserting ${newItems.length} items on page ${currentPage}...`);
        
        for (const item of newItems) {
          existingIds.add(item.id);
        }
        
        const { error } = await supabase.from('catalog').upsert(newItems, { onConflict: 'id' });
        if (error) {
          console.error('Error upserting catalog items:', error);
        }
      }
 else {
        console.log(`  ...No new items on page ${currentPage}.`);
      }
      
      currentPage++;
      // Wait 1.5 seconds before the next page to be polite to the target server
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
    
    console.log(`✅ Catalog Sync Complete! Added ${totalNewFound} new items to the database. Total items: ${existingIds.size}`);
  } catch (err) {
    console.error('Error during catalog sync:', err);
  }
}
