/**
 * OmniPOS Standard Cloudflare Worker
 * Updated for Numerical ID Schema and Robust Error Handling
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

          const { action, table, data, username, password, deviceId } = payload;

          if (action === 'INIT_SCHEMA') {
            try {
              const schema = [
                "CREATE TABLE IF NOT EXISTS `stores` (id INTEGER PRIMARY KEY, name TEXT, currency TEXT, address TEXT, phone TEXT, tin TEXT, isActive INTEGER, useKOT INTEGER, useInventory INTEGER, taxRate REAL, serviceCharge REAL, minStartingCash REAL, numberOfTables INTEGER, printSettings TEXT, quotationSettings TEXT, eodSettings TEXT, buildingName TEXT, streetName TEXT, city TEXT, province TEXT, zipCode TEXT)",
                "CREATE TABLE IF NOT EXISTS `users` (id INTEGER PRIMARY KEY, userNumber INTEGER, name TEXT, username TEXT, password TEXT, role TEXT, storeIds TEXT, phoneNumber TEXT, email TEXT)",
                "CREATE TABLE IF NOT EXISTS `employees` (id INTEGER PRIMARY KEY, empId TEXT, fullName TEXT, dob TEXT, nationality TEXT, idNumber TEXT, phoneNumber TEXT, emergencyContactNumber TEXT, emergencyContactPerson TEXT, emergencyRelation TEXT, createdAt INTEGER)",
                "CREATE TABLE IF NOT EXISTS `products` (id INTEGER PRIMARY KEY, storeId INTEGER, name TEXT, price REAL, cost REAL, categoryId INTEGER, isAvailable INTEGER, imageUrl TEXT, recipe TEXT)",
                "CREATE TABLE IF NOT EXISTS `categories` (id INTEGER PRIMARY KEY, storeId INTEGER, name TEXT, orderId INTEGER)",
                "CREATE TABLE IF NOT EXISTS `customers` (id INTEGER PRIMARY KEY, storeId INTEGER, name TEXT, phone TEXT, type TEXT, companyName TEXT, tin TEXT, houseName TEXT, streetName TEXT, buildingName TEXT, street TEXT, island TEXT, country TEXT, address TEXT)",
                "CREATE TABLE IF NOT EXISTS `orders` (id INTEGER PRIMARY KEY, orderNumber TEXT, storeId INTEGER, shiftId INTEGER, items TEXT, subtotal REAL, tax REAL, serviceCharge REAL, total REAL, orderType TEXT, status TEXT, kitchenStatus TEXT, paymentMethod TEXT, transactions TEXT, tableNumber TEXT, customerName TEXT, customerPhone TEXT, customerTin TEXT, customerAddress TEXT, note TEXT, cancellationReason TEXT, createdBy INTEGER, createdAt INTEGER, discountPercent REAL, discountAmount REAL)",
                "CREATE TABLE IF NOT EXISTS `quotations` (id INTEGER PRIMARY KEY, quotationNumber TEXT, storeId INTEGER, customerName TEXT, customerPhone TEXT, customerTin TEXT, customerAddress TEXT, items TEXT, subtotal REAL, discountPercent REAL, discountAmount REAL, tax REAL, total REAL, validUntil INTEGER, createdBy INTEGER, createdAt INTEGER)",
                "CREATE TABLE IF NOT EXISTS `shifts` (id INTEGER PRIMARY KEY, shiftNumber INTEGER, storeId INTEGER, openedBy INTEGER, openedAt INTEGER, startingCash REAL, openingDenominations TEXT, status TEXT, closedAt INTEGER, closedBy INTEGER, expectedCash REAL, actualCash REAL, closingDenominations TEXT, difference REAL, totalCashSales REAL, totalCashRefunds REAL, heldOrdersCount INTEGER, notes TEXT)",
                "CREATE TABLE IF NOT EXISTS `global_permissions` (role TEXT PRIMARY KEY, permissions TEXT)",
                "CREATE TABLE IF NOT EXISTS `inventory` (id INTEGER PRIMARY KEY, storeId INTEGER, name TEXT, quantity REAL, unit TEXT, minLevel REAL)",
                "CREATE TABLE IF NOT EXISTS `sessions` (userId INTEGER PRIMARY KEY, userName TEXT, role TEXT, storeId INTEGER, lastActive INTEGER, deviceId TEXT)",
                "CREATE TABLE IF NOT EXISTS `system_activities` (id INTEGER PRIMARY KEY, storeId INTEGER, userId INTEGER, userName TEXT, action TEXT, description TEXT, timestamp INTEGER, metadata TEXT)"
              ];
              
              for (const q of schema) {
                await DB.prepare(q).run();
              }
              
              const migrations = [
                { table: 'stores', column: 'buildingName', type: 'TEXT' },
                { table: 'stores', column: 'streetName', type: 'TEXT' },
                { table: 'stores', column: 'city', type: 'TEXT' },
                { table: 'stores', column: 'province', type: 'TEXT' },
                { table: 'stores', column: 'zipCode', type: 'TEXT' },
                { table: 'stores', column: 'useKOT', type: 'INTEGER' },
                { table: 'stores', column: 'useInventory', type: 'INTEGER' },
                { table: 'users', column: 'phoneNumber', type: 'TEXT' },
                { table: 'users', column: 'email', type: 'TEXT' },
                { table: 'orders', column: 'items', type: 'TEXT' },
                { table: 'sessions', column: 'userName', type: 'TEXT' },
                { table: 'sessions', column: 'role', type: 'TEXT' },
                { table: 'sessions', column: 'storeId', type: 'INTEGER' },
                { table: 'sessions', column: 'deviceId', type: 'TEXT' }
              ];

              for (const m of migrations) {
                try {
                  await DB.prepare(`ALTER TABLE \`${m.table}\` ADD COLUMN \`${m.column}\` ${m.type}`).run();
                } catch (e) {
                    // Fail silently if column already exists
                }
              }
              return jsonResponse({ success: true });
            } catch (err: any) {
              return jsonResponse({ success: false, error: `Schema Init Error: ${err.message}` }, 500);
            }
          }

          if (action === 'REMOTE_LOGIN') {
            const { results } = await DB.prepare("SELECT * FROM `users` WHERE `username` = ? AND `password` = ?").bind(username, password).run();
            if (results && results.length > 0) {
              const user = results[0];
              const userId = user.id;

              // CONCURRENCY CHECK: Check if an active session exists on a DIFFERENT device
              const { results: sessionResults } = await DB.prepare("SELECT * FROM `sessions` WHERE `userId` = ?").bind(userId).run();
              if (sessionResults && sessionResults.length > 0) {
                const activeSession = sessionResults[0];
                const now = Date.now();
                // If last heartbeat was within the last 120 seconds and on a different device, lock them out
                if (now - activeSession.lastActive < 120000 && activeSession.deviceId !== deviceId) {
                  return jsonResponse({ 
                    success: false, 
                    error: `User is already active on another device. Please logout from other devices first.` 
                  }, 403);
                }
              }

              // Proceed with login, update session record
              await DB.prepare("INSERT OR REPLACE INTO `sessions` (userId, userName, role, storeId, lastActive, deviceId) VALUES (?, ?, ?, ?, ?, ?)")
                .bind(userId, user.name, user.role, null, Date.now(), deviceId || 'unknown')
                .run();

              if (typeof user.storeIds === 'string') {
                try { user.storeIds = JSON.parse(user.storeIds); } catch(e) { user.storeIds = []; }
              }
              return jsonResponse({ success: true, user });
            }
            return jsonResponse({ success: false, error: "Invalid Credentials" });
          }

          if (action === 'FETCH_HYDRATION_DATA') {
            const tables = ['stores', 'users', 'employees', 'products', 'categories', 'customers', 'orders', 'quotations', 'shifts', 'global_permissions', 'inventory', 'system_activities', 'sessions'];
            const result: Record<string, any[]> = {};
            for (const t of tables) {
                try {
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
                } catch(e) {
                    result[t] = [];
                }
            }
            return jsonResponse({ success: true, data: result });
          }

          if (action === 'INSERT' || action === 'UPDATE') {
            if (!data) return jsonResponse({ success: false, error: 'No data provided' }, 400);
            const keys = Object.keys(data);
            const cols = keys.map(k => `\`${k}\``).join(',');
            const vals = keys.map(() => '?').join(',');
            const query = `INSERT OR REPLACE INTO \`${table}\` (${cols}) VALUES (${vals})`;
            
            const params = keys.map(k => {
                let val = data[k];
                if (val === undefined) return null;
                
                const numericFields = [
                  'id', 'userId', 'storeId', 'shiftId', 'categoryId', 'createdAt', 'openedAt', 'closedAt', 
                  'timestamp', 'price', 'cost', 'total', 'subtotal', 'tax', 'serviceCharge', 
                  'quantity', 'taxRate', 'serviceChargeRate', 'minLevel', 'minStartingCash', 'numberOfTables', 'useKOT', 'useInventory', 'lastActive'
                ];
                
                if (numericFields.includes(k)) {
                    const coerced = Number(val);
                    if (!isNaN(coerced)) val = coerced;
                }

                if (val !== null && typeof val === 'object') return JSON.stringify(val);
                return val;
            });
            
            try {
              const res = await DB.prepare(query).bind(...params).run();
              return jsonResponse({ success: true, meta: res.meta });
            } catch (err: any) {
              return jsonResponse({ 
                success: false, 
                error: `Database Error in ${table}: ${err.message}. Hint: Use 'Repair DB Schema' or 'Skip Task'.` 
              }, 500);
            }
          }
          
          if (action === 'DELETE') {
            if (!data) return jsonResponse({ success: false, error: 'No data provided for deletion' }, 400);
            // Default PK is 'id', but some tables use special keys
            let pk = 'id';
            if (table === 'global_permissions') pk = 'role';
            if (table === 'sessions') pk = 'userId';
            
            if (data[pk] === undefined) return jsonResponse({ success: false, error: `Primary key ${pk} missing in data` }, 400);
            
            try {
              await DB.prepare(`DELETE FROM \`${table}\` WHERE \`${pk}\` = ?`).bind(data[pk]).run();
              return jsonResponse({ success: true });
            } catch (err: any) {
              return jsonResponse({ success: false, error: `Delete Error: ${err.message}` }, 500);
            }
          }
        }
      } catch (err: any) { 
          return jsonResponse({ success: false, error: `System Critical Error: ${err.message}` }, 500); 
      }
    }
    return new Response(null, { status: 404 });
  }
};