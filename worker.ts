/**
 * OmniPOS Standard Cloudflare Worker
 * This script handles API requests and serves as the bridge to D1.
 */

interface Env {
  DB: any;
  ASSETS: { fetch: (request: Request) => Promise<Response> };
}

const jsonResponse = (data: any, status = 200) => {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 
      'Content-Type': 'application/json',
      'X-OmniPOS-System': 'verified',
      'X-OmniPOS-Verification': 'authorized',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    }
  });
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Only intercept requests to the sync API
    if (url.pathname === '/api/sync') {
      try {
        const DB = env.DB;
        if (!DB) {
          return jsonResponse({ success: false, error: 'Database binding "DB" not found.' }, 500);
        }

        if (request.method === 'GET') {
          return jsonResponse({ success: true, message: 'OmniPOS Worker API is active.' });
        }

        if (request.method === 'POST') {
          let payload: any;
          try {
            payload = await request.json();
          } catch (e) {
            return jsonResponse({ success: false, error: 'Invalid JSON payload' }, 400);
          }

          const { action, table, data, storeId } = payload;

          if (action === 'PING') {
            await DB.prepare('SELECT 1').run();
            return jsonResponse({ success: true, message: 'pong' });
          }

          if (action === 'GET_EXISTING_IDS') {
            if (!table) return jsonResponse({ success: false, error: 'Table required' }, 400);
            
            let query = `SELECT id FROM \`${table}\``;
            if (storeId && table !== 'users' && table !== 'stores' && table !== 'employees' && table !== 'global_permissions') {
                query += ` WHERE storeId = ?`;
            }
            
            const { results } = await DB.prepare(query).bind(storeId || '').run();
            const ids = results.map((r: any) => r.id);
            
            // Also fetch orderNumbers if syncing orders to check for sequential conflicts
            let orderNumbers: string[] = [];
            if (table === 'orders' && storeId) {
                const ordRes = await DB.prepare(`SELECT orderNumber FROM orders WHERE storeId = ?`).bind(storeId).run();
                orderNumbers = ordRes.results.map((r: any) => r.orderNumber);
            }

            return jsonResponse({ success: true, ids, orderNumbers });
          }

          if (action === 'INIT_SCHEMA') {
            const schema = [
              "CREATE TABLE IF NOT EXISTS `stores` (id TEXT PRIMARY KEY, name TEXT, currency TEXT, address TEXT, phone TEXT, tin TEXT, isActive INTEGER, taxRate REAL, serviceChargeRate REAL, minStartingCash REAL, numberOfTables INTEGER, printSettings TEXT, quotationSettings TEXT, eodSettings TEXT)",
              "CREATE TABLE IF NOT EXISTS `users` (id TEXT PRIMARY KEY, userNumber INTEGER, name TEXT, username TEXT, password TEXT, role TEXT, storeIds TEXT)",
              "CREATE TABLE IF NOT EXISTS `employees` (id TEXT PRIMARY KEY, empId TEXT, fullName TEXT, dob TEXT, nationality TEXT, idNumber TEXT, phoneNumber TEXT, emergencyContactNumber TEXT, emergencyContactPerson TEXT, emergencyRelation TEXT, createdAt INTEGER)",
              "CREATE TABLE IF NOT EXISTS `products` (id TEXT PRIMARY KEY, storeId TEXT, name TEXT, price REAL, cost REAL, categoryId TEXT, isAvailable INTEGER, imageUrl TEXT, recipe TEXT)",
              "CREATE TABLE IF NOT EXISTS `categories` (id TEXT PRIMARY KEY, storeId TEXT, name TEXT, orderId INTEGER)",
              "CREATE TABLE IF NOT EXISTS `customers` (id TEXT PRIMARY KEY, storeId TEXT, name TEXT, phone TEXT, type TEXT, companyName TEXT, tin TEXT, houseName TEXT, streetName TEXT, buildingName TEXT, street TEXT, island TEXT, country TEXT, address TEXT)",
              "CREATE TABLE IF NOT EXISTS `orders` (id TEXT PRIMARY KEY, orderNumber TEXT, storeId TEXT, shiftId TEXT, subtotal REAL, tax REAL, serviceCharge REAL, total REAL, orderType TEXT, status TEXT, kitchenStatus TEXT, paymentMethod TEXT, transactions TEXT, tableNumber TEXT, customerName TEXT, customerPhone TEXT, customerTin TEXT, customerAddress TEXT, note TEXT, cancellationReason TEXT, createdBy TEXT, createdAt INTEGER, discountPercent REAL, discountAmount REAL)",
              "CREATE TABLE IF NOT EXISTS `quotations` (id TEXT PRIMARY KEY, quotationNumber TEXT, storeId TEXT, customerName TEXT, customerPhone TEXT, customerTin TEXT, customerAddress TEXT, items TEXT, subtotal REAL, discountPercent REAL, discountAmount REAL, tax REAL, total REAL, validUntil INTEGER, createdBy TEXT, createdAt INTEGER)",
              "CREATE TABLE IF NOT EXISTS `shifts` (id TEXT PRIMARY KEY, shiftNumber INTEGER, storeId TEXT, openedBy TEXT, openedAt INTEGER, startingCash REAL, openingDenominations TEXT, status TEXT, closedAt INTEGER, closedBy TEXT, expectedCash REAL, actualCash REAL, closingDenominations TEXT, difference REAL, totalCashSales REAL, totalCashRefunds REAL, heldOrdersCount INTEGER, notes TEXT)",
              "CREATE TABLE IF NOT EXISTS `global_permissions` (role TEXT PRIMARY KEY, permissions TEXT)",
              "CREATE TABLE IF NOT EXISTS `inventory` (id TEXT PRIMARY KEY, storeId TEXT, name TEXT, quantity REAL, unit TEXT, minLevel REAL)"
            ];
            for (const q of schema) await DB.prepare(q).run();
            return jsonResponse({ success: true });
          }

          if (action === 'WRITE_TEST') {
            await DB.prepare('SELECT name FROM sqlite_master WHERE type="table" LIMIT 1').run();
            return jsonResponse({ success: true, message: 'D1 Database is correctly bound and reachable.' });
          }

          if (!table || !data) return jsonResponse({ success: false, error: 'Missing parameters' }, 400);

          let query = '';
          let params: any[] = [];

          if (action === 'INSERT' || action === 'UPDATE') {
            const keys = Object.keys(data);
            const cols = keys.map(k => `\`${k}\``).join(',');
            const vals = keys.map(() => '?').join(',');
            query = `INSERT OR REPLACE INTO \`${table}\` (${cols}) VALUES (${vals})`;
            params = keys.map(k => typeof data[k] === 'object' ? JSON.stringify(data[k]) : data[k]);
          } else if (action === 'DELETE') {
            const pk = (table.includes('permission')) ? 'role' : 'id';
            query = `DELETE FROM \`${table}\` WHERE \`${pk}\` = ?`;
            params = [data[pk]];
          }

          const result = await DB.prepare(query).bind(...params).run();
          return jsonResponse({ success: true, meta: result.meta });
        }
      } catch (err: any) {
        return jsonResponse({ success: false, error: err.message }, 500);
      }
    }

    // Fallback: Return a 404 to let Cloudflare Assets handle static file requests
    return new Response(null, { status: 404 });
  }
};
