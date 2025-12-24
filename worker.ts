
/**
 * OmniPOS Standard Cloudflare Worker
 * Updated for Numerical ID Schema
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

    if (url.pathname === '/api/sync') {
      try {
        const DB = env.DB;
        if (!DB) return jsonResponse({ success: false, error: 'Database binding "DB" not found.' }, 500);

        if (request.method === 'GET') return jsonResponse({ success: true, message: 'OmniPOS Worker API is active.' });

        if (request.method === 'POST') {
          let payload: any;
          try { payload = await request.json(); } catch (e) { return jsonResponse({ success: false, error: 'Invalid JSON payload' }, 400); }

          const { action, table, data, storeId, username, password, userId } = payload;

          if (action === 'INIT_SCHEMA') {
            const schema = [
              "CREATE TABLE IF NOT EXISTS `stores` (id INTEGER PRIMARY KEY, name TEXT, currency TEXT, address TEXT, phone TEXT, tin TEXT, isActive INTEGER, taxRate REAL, serviceChargeRate REAL, minStartingCash REAL, numberOfTables INTEGER, printSettings TEXT, quotationSettings TEXT, eodSettings TEXT)",
              "CREATE TABLE IF NOT EXISTS `users` (id INTEGER PRIMARY KEY, userNumber INTEGER, name TEXT, username TEXT, password TEXT, role TEXT, storeIds TEXT)",
              "CREATE TABLE IF NOT EXISTS `employees` (id INTEGER PRIMARY KEY, empId TEXT, fullName TEXT, dob TEXT, nationality TEXT, idNumber TEXT, phoneNumber TEXT, emergencyContactNumber TEXT, emergencyContactPerson TEXT, emergencyRelation TEXT, createdAt INTEGER)",
              "CREATE TABLE IF NOT EXISTS `products` (id INTEGER PRIMARY KEY, storeId INTEGER, name TEXT, price REAL, cost REAL, categoryId INTEGER, isAvailable INTEGER, imageUrl TEXT, recipe TEXT)",
              "CREATE TABLE IF NOT EXISTS `categories` (id INTEGER PRIMARY KEY, storeId INTEGER, name TEXT, orderId INTEGER)",
              "CREATE TABLE IF NOT EXISTS `customers` (id INTEGER PRIMARY KEY, storeId INTEGER, name TEXT, phone TEXT, type TEXT, companyName TEXT, tin TEXT, houseName TEXT, streetName TEXT, buildingName TEXT, street TEXT, island TEXT, country TEXT, address TEXT)",
              "CREATE TABLE IF NOT EXISTS `orders` (id INTEGER PRIMARY KEY, orderNumber TEXT, storeId INTEGER, shiftId INTEGER, subtotal REAL, tax REAL, serviceCharge REAL, total REAL, orderType TEXT, status TEXT, kitchenStatus TEXT, paymentMethod TEXT, transactions TEXT, tableNumber TEXT, customerName TEXT, customerPhone TEXT, customerTin TEXT, customerAddress TEXT, note TEXT, cancellationReason TEXT, createdBy INTEGER, createdAt INTEGER, discountPercent REAL, discountAmount REAL)",
              "CREATE TABLE IF NOT EXISTS `quotations` (id INTEGER PRIMARY KEY, quotationNumber TEXT, storeId INTEGER, customerName TEXT, customerPhone TEXT, customerTin TEXT, customerAddress TEXT, items TEXT, subtotal REAL, discountPercent REAL, discountAmount REAL, tax REAL, total REAL, validUntil INTEGER, createdBy INTEGER, createdAt INTEGER)",
              "CREATE TABLE IF NOT EXISTS `shifts` (id INTEGER PRIMARY KEY, shiftNumber INTEGER, storeId INTEGER, openedBy INTEGER, openedAt INTEGER, startingCash REAL, openingDenominations TEXT, status TEXT, closedAt INTEGER, closedBy INTEGER, expectedCash REAL, actualCash REAL, closingDenominations TEXT, difference REAL, totalCashSales REAL, totalCashRefunds REAL, heldOrdersCount INTEGER, notes TEXT)",
              "CREATE TABLE IF NOT EXISTS `global_permissions` (role TEXT PRIMARY KEY, permissions TEXT)",
              "CREATE TABLE IF NOT EXISTS `inventory` (id INTEGER PRIMARY KEY, storeId INTEGER, name TEXT, quantity REAL, unit TEXT, minLevel REAL)",
              "CREATE TABLE IF NOT EXISTS `sessions` (userId INTEGER PRIMARY KEY, lastActive INTEGER, status TEXT)",
              "CREATE TABLE IF NOT EXISTS `system_activities` (id INTEGER PRIMARY KEY, storeId INTEGER, userId INTEGER, userName TEXT, action TEXT, description TEXT, timestamp INTEGER, metadata TEXT)"
            ];
            for (const q of schema) await DB.prepare(q).run();
            return jsonResponse({ success: true });
          }

          if (action === 'FETCH_HYDRATION_DATA') {
            const tables = ['stores', 'users', 'employees', 'products', 'categories', 'customers', 'orders', 'quotations', 'shifts', 'global_permissions', 'inventory', 'system_activities'];
            const result: Record<string, any[]> = {};
            for (const t of tables) {
                const { results } = await DB.prepare(`SELECT * FROM \`${t}\``).run();
                result[t] = results.map((row: any) => {
                    const processed = { ...row };
                    ['storeIds', 'printSettings', 'quotationSettings', 'eodSettings', 'items', 'transactions', 'permissions', 'openingDenominations', 'closingDenominations', 'recipe'].forEach(field => {
                        if (processed[field] && typeof processed[field] === 'string') {
                            try { processed[field] = JSON.parse(processed[field]); } catch(e) {}
                        }
                    });
                    return processed;
                });
            }
            return jsonResponse({ success: true, data: result });
          }

          if (action === 'INSERT' || action === 'UPDATE') {
            const keys = Object.keys(data);
            const cols = keys.map(k => `\`${k}\``).join(',');
            const vals = keys.map(() => '?').join(',');
            const query = `INSERT OR REPLACE INTO \`${table}\` (${cols}) VALUES (${vals})`;
            const params = keys.map(k => typeof data[k] === 'object' ? JSON.stringify(data[k]) : data[k]);
            const res = await DB.prepare(query).bind(...params).run();
            return jsonResponse({ success: true, meta: res.meta });
          }
          
          if (action === 'DELETE') {
            const pk = table === 'global_permissions' ? 'role' : 'id';
            await DB.prepare(`DELETE FROM \`${table}\` WHERE \`${pk}\` = ?`).bind(data[pk]).run();
            return jsonResponse({ success: true });
          }
        }
      } catch (err: any) { return jsonResponse({ success: false, error: err.message }, 500); }
    }
    return new Response(null, { status: 404 });
  }
};
