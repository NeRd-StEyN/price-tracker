import { supabase } from '../db.js';
import { invalidateSearchCache } from '../routes/search.js';

let isCatalogSyncing = false;

export async function syncCatalog() {
  if (isCatalogSyncing) {
    console.log('[SYNC] Catalog sync already in progress, skipping duplicate call.');
    return { ok: false, message: 'Catalog sync already in progress' };
  }
  isCatalogSyncing = true;
  console.log('[SYNC] Starting Catalog Sync with INE Official Store...');

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

    // Preservation policy: We do NOT delete products that are missing/removed from the INE store.
    // All items remain stored in our database for historical tracking.
    console.log('[SYNC]   Preserved all existing products in DB (no deletions applied for removed store items).');

    if (hadChanges) {
      await invalidateSearchCache();
      console.log('[SYNC]   Search cache invalidated — new catalog is live.');
    }

    console.log(`[SYNC] ✅ Catalog sync complete. Upserted/Updated: ${totalUpserted} products.`);
    return { ok: true, upserted: totalUpserted };

  } catch (err) {
    console.error('[SYNC] ❌ Error during catalog sync:', err.message);
    return { ok: false, error: err.message };
  } finally {
    isCatalogSyncing = false;
  }
}

