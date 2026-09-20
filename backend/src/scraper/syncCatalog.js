import { supabase } from '../db.js';
import { invalidateSearchCache } from '../routes/search.js';

export async function syncCatalog() {
  console.log('[SYNC] Starting Catalog Sync...');

  const { data: existingData } = await supabase.from('catalog').select('id');
  const existingIds = new Set(existingData?.map(row => String(row.id)) || []);
  const seenIds     = new Set(); 

  let totalUpserted = 0;
  let currentPage   = 1;
  let totalPages    = 1;
  let hadChanges    = false;

  try {
    
    while (currentPage <= totalPages) {
      console.log(`[SYNC]   Fetching page ${currentPage} of ${totalPages}...`);
      const url = `https://demo.inelabteamdev.com/api/catalog?page=${currentPage}&pageSize=100`;

      const response = await fetch(url);

      if (!response.ok) {
        if (response.status === 429) {
          
          console.warn(`[SYNC]   Rate limited (429) on page ${currentPage}. Backing off 10s...`);
          await new Promise(r => setTimeout(r, 10000));
          continue;
        }
        throw new Error(`Catalog page ${currentPage} returned HTTP ${response.status}`);
      }

      const data  = await response.json();
      const items = data.items || [];

      if (currentPage === 1 && data.pages) {
        totalPages = data.pages;
        console.log(`[SYNC]   Total pages: ${totalPages} (~${totalPages * 100} products)`);
      }

      const batch = items.map(item => {
        const id = String(item.id);
        seenIds.add(id);
        return {
          id,
          name:         item.name,
          brand:        item.brand    || null,
          sku:          item.sku      || null,
          category:     item.category || null,
          url:          `https://demo.inelabteamdev.com/product/${id}`,
          image_url:    null,
          last_seen_at: new Date().toISOString()
        };
      });

      if (batch.length > 0) {
        const { error } = await supabase
          .from('catalog')
          .upsert(batch, { onConflict: 'id' });

        if (error) {
          console.error('[SYNC]   Upsert error:', error.message);
        } else {
          totalUpserted += batch.length;
          hadChanges = true;
        }
      }

      currentPage++;
      
      await new Promise(r => setTimeout(r, 1500));
    }

    const deletedIds = [...existingIds].filter(id => !seenIds.has(id));

    if (deletedIds.length > 0) {
      console.log(`[SYNC] Removing ${deletedIds.length} products no longer on the INE store...`);
      const { error: delError } = await supabase
        .from('catalog')
        .delete()
        .in('id', deletedIds);

      if (delError) {
        console.error('[SYNC]   Delete error:', delError.message);
      } else {
        hadChanges = true;
        console.log(`[SYNC]   Deleted ${deletedIds.length} stale catalog entries.`);
      }
    } else {
      console.log('[SYNC]   No deletions detected. All existing catalog items still present on INE.');
    }

    if (hadChanges) {
      await invalidateSearchCache();
      console.log('[SYNC]   Search cache invalidated — new catalog is live.');
    }

    console.log(`[SYNC] ✅ Complete. Upserted: ${totalUpserted}, Deleted: ${deletedIds?.length ?? 0}, Total in DB: ${seenIds.size}`);

  } catch (err) {
    console.error('[SYNC] ❌ Error during catalog sync:', err.message);
  }
}
