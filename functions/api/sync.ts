/**
 * CLOUDFLARE D1 DATABASE SYNC API
 */

interface Env {
  DB?: any;
  db?: any;
}

const jsonResponse = (data: any, status = 200) => {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 
      'Content-Type': 'application/json',
      'X-OmniPOS-System': 'verified',
      'X-OmniPOS-Trace': 'sync-function-hit-' + Date.now(),
      'Access-Control-Allow-Origin': '*'
    }
  });
};

export const onRequestPost = async (context: { env: Env; request: Request }): Promise<Response> => {
  try {
    // 1. Resolve Binding (Handle case-sensitivity: DB vs db)
    const DB = context.env.DB || context.env.db;

    if (!DB) {
      const keys = Object.keys(context.env);
      return jsonResponse({ 
        success: false,
        error: 'Database binding not found.',
        hint: `Available env keys: ${keys.join(', ')}. Please ensure you have a D1 binding named "DB" or "db" in your Cloudflare Dashboard.`,
        code: 'MISSING_BINDING',
        debug_keys: keys
      }, 500);
    }
    
    // 2. Parse Payload
    let payload: any;
    try {
      const text = await context.request.text();
      payload = JSON.parse(text);
    } catch (e) {
      return jsonResponse({ 
        success: false, 
        error: 'Malformed JSON request body',
        details: 'The server expected JSON but received something else.' 
      }, 400);
    }

    const { action, table, data } = payload;

    // 3. Handle PING
    if (action === 'PING') {
      try {
        await DB.prepare('SELECT 1').run();
        return jsonResponse({ 
            success: true, 
            message: 'pong', 
            binding_used: context.env.DB ? 'DB' : 'db',
            system: 'OmniPOS v1.0'
        });
      } catch (e: any) {
          if (e.message.includes("no such table")) {
              return jsonResponse({ 
                  success: false, 
                  error: 'Binding exists, but schema is not initialized.',
                  code: 'SCHEMA_MISSING' 
              }, 200);
          }
        return jsonResponse({ success: false, error: `DB Query Failed: ${e.message}` }, 500);
      }
    }

    // 4. Handle INIT_SCHEMA
    if (action === 'INIT_SCHEMA') {
        try {
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
                "CREATE TABLE IF NOT EXISTS `global_permissions` (role TEXT PRIMARY KEY, permissions TEXT)"
            ];

            for (const query of schema) {
                await DB.prepare(query).run();
            }
            return jsonResponse({ success: true, message: 'Database schema initialized successfully.' });
        } catch (e: any) {
            return jsonResponse({ success: false, error: e.message }, 500);
        }
    }

    // 5. Handle WRITE_TEST
    if (action === 'WRITE_TEST') {
      try {
        const testId = `diag_${Date.now()}`;
        await DB.prepare("INSERT INTO `stores` (id, name, isActive) VALUES (?, ?, ?)")
          .bind(testId, "Diagnostic Store", 0)
          .run();
        await DB.prepare("DELETE FROM `stores` WHERE id = ?").bind(testId).run();
        return jsonResponse({ success: true, message: 'Database is writable.', binding: context.env.DB ? 'DB' : 'db' });
      } catch (e: any) {
          let hint = "Check if tables are created.";
          if (e.message.includes("no such table")) hint = "The 'stores' table is missing. Use the 'Repair Schema' button.";
          return jsonResponse({ success: false, error: e.message, hint }, 500);
      }
    }

    // 6. Standard Sync Actions
    if (!table || !data) return jsonResponse({ success: false, error: 'Missing table or data' }, 400);

    let query = '';
    let params: any[] = [];
    try {
      switch (action) {
        case 'INSERT':
        case 'UPDATE': {
          const keys = Object.keys(data);
          const sqlKeys = keys.map(k => `\`${k}\``).join(', ');
          const placeholders = keys.map(() => '?').join(', ');
          query = `INSERT OR REPLACE INTO \`${table}\` (${sqlKeys}) VALUES (${placeholders})`;
          params = keys.map(key => {
            const val = data[key];
            if (val !== null && typeof val === 'object') return JSON.stringify(val);
            if (typeof val === 'boolean') return val ? 1 : 0;
            return val;
          });
          break;
        }
        case 'DELETE': {
          const pk = (table === 'permissions' || table === 'global_permissions') ? 'role' : 'id';
          query = `DELETE FROM \`${table}\` WHERE \`${pk}\` = ?`;
          params = [data[pk]];
          break;
        }
        default: return jsonResponse({ success: false, error: `Invalid action: ${action}` }, 400);
      }
      const result = await DB.prepare(query).bind(...params).run();
      return jsonResponse({ success: true, meta: result.meta });
    } catch (err: any) {
      return jsonResponse({ success: false, error: err.message, details: `Query: ${query.substring(0, 50)}...` }, 500);
    }
  } catch (globalErr: any) {
    return jsonResponse({ success: false, error: 'Internal Worker Exception', message: globalErr.message }, 500);
  }
};