
/**
 * CLOUDFLARE D1 DATABASE SYNC API
 */

interface Env {
  DB: any;
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
      'Pragma': 'no-cache',
      'Expires': '0'
    }
  });
};

export const onRequestGet = async (context: { env: Env }): Promise<Response> => {
  const DB = context.env.DB;
  if (!DB) {
      return jsonResponse({ success: false, error: 'Database binding "DB" not found.' }, 500);
  }
  return jsonResponse({ success: true, message: 'Backend functions are correctly mapped.' });
};

export const onRequestPost = async (context: { env: Env; request: Request }): Promise<Response> => {
  try {
    const DB = context.env.DB;

    if (!DB) {
      return jsonResponse({ 
        success: false,
        error: 'Database binding "DB" not found.',
        hint: 'Check your wrangler.toml for [[d1_databases]] with binding = "DB"'
      }, 500);
    }
    
    let payload: any;
    try {
      payload = await context.request.json();
    } catch (e) {
      return jsonResponse({ success: false, error: 'Invalid JSON payload' }, 400);
    }

    const { action, table, data, username, password } = payload;

    if (action === 'PING') {
      try {
        await DB.prepare('SELECT 1').run();
        return jsonResponse({ success: true, message: 'pong' });
      } catch (e: any) {
        return jsonResponse({ success: false, error: e.message }, 500);
      }
    }

    if (action === 'REMOTE_LOGIN') {
        const { results } = await DB.prepare("SELECT * FROM `users` WHERE `username` = ? AND `password` = ?").bind(username, password).run();
        if (results && results.length > 0) {
            const user = results[0];
            if (typeof user.storeIds === 'string') {
              try { user.storeIds = JSON.parse(user.storeIds); } catch(e) { user.storeIds = []; }
            }
            return jsonResponse({ success: true, user });
        }
        return jsonResponse({ success: false, error: "Invalid Credentials" });
    }

    if (action === 'INIT_SCHEMA') {
      const schema = [
        "CREATE TABLE IF NOT EXISTS `stores` (id INTEGER PRIMARY KEY, name TEXT, currency TEXT, address TEXT, phone TEXT, tin TEXT, isActive INTEGER, taxRate REAL, serviceChargeRate REAL, minStartingCash REAL, numberOfTables INTEGER, printSettings TEXT, quotationSettings TEXT, eodSettings TEXT, buildingName TEXT, streetName TEXT, city TEXT, province TEXT, zipCode TEXT)",
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
      
      const migrations = [
        "ALTER TABLE `stores` ADD COLUMN `buildingName` TEXT",
        "ALTER TABLE `stores` ADD COLUMN `streetName` TEXT",
        "ALTER TABLE `stores` ADD COLUMN `city` TEXT",
        "ALTER TABLE `stores` ADD COLUMN `province` TEXT",
        "ALTER TABLE `stores` ADD COLUMN `zipCode` TEXT"
      ];
      for (const m of migrations) {
        try { await DB.prepare(m).run(); } catch (e) { /* column exists */ }
      }

      return jsonResponse({ success: true });
    }

    if (action === 'FETCH_HYDRATION_DATA') {
        const tables = ['stores', 'users', 'employees', 'products', 'categories', 'customers', 'orders', 'quotations', 'shifts', 'global_permissions', 'inventory', 'system_activities'];
        const result: any = {};
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
      if (!data) return jsonResponse({ success: false, error: 'No data provided' }, 400);
      const keys = Object.keys(data);
      const cols = keys.map(k => `\`${k}\``).join(',');
      const vals = keys.map(() => '?').join(',');
      const query = `INSERT OR REPLACE INTO \`${table}\` (${cols}) VALUES (${vals})`;
      
      const params = keys.map(k => {
          const val = data[k];
          if (val === undefined) return null;
          if (val !== null && typeof val === 'object') return JSON.stringify(val);
          return val;
      });
      
      try {
        const res = await DB.prepare(query).bind(...params).run();
        return jsonResponse({ success: true, meta: res.meta });
      } catch (err: any) {
        return jsonResponse({ success: false, error: `SQL Error in ${table}: ${err.message}` }, 500);
      }
    }
    
    if (action === 'DELETE') {
      if (!data) return jsonResponse({ success: false, error: 'No data provided for deletion' }, 400);
      const pk = (table.includes('permission')) ? 'role' : 'id';
      if (data[pk] === undefined) return jsonResponse({ success: false, error: `Primary key ${pk} missing in data` }, 400);
      
      await DB.prepare(`DELETE FROM \`${table}\` WHERE \`${pk}\` = ?`).bind(data[pk]).run();
      return jsonResponse({ success: true });
    }

    return jsonResponse({ success: false, error: 'Unknown action' }, 400);

  } catch (err: any) {
    return jsonResponse({ success: false, error: err.message }, 500);
  }
};
