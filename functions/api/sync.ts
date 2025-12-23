/**
 * CLOUDFLARE D1 DATABASE SYNC API
 */

interface Env {
  DB: any;
}

const jsonResponse = (data: any, status = 200) => {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
};

export const onRequestPost = async (context: { env: Env; request: Request }): Promise<Response> => {
  try {
    const { DB } = context.env;

    // 1. Verify Database Binding
    if (!DB) {
      return jsonResponse({ 
        success: false,
        error: 'The D1 Database binding "DB" is not connected to this project.',
        hint: 'Go to Cloudflare Pages > Settings > Functions > D1 Database Bindings and add "DB".',
        code: 'MISSING_BINDING'
      }, 500);
    }
    
    // 2. Parse Payload
    let payload: any;
    try {
      payload = await context.request.json();
    } catch (e) {
      return jsonResponse({ success: false, error: 'Malformed JSON request body' }, 400);
    }

    const { action, table, data } = payload;

    // 3. Handle PING (Connection Test)
    if (action === 'PING') {
      try {
        await DB.prepare('SELECT 1').run();
        return jsonResponse({ success: true, message: 'pong', timestamp: Date.now() });
      } catch (e: any) {
          if (e.message.includes("no such table")) {
              return jsonResponse({ 
                  success: false, 
                  error: 'Binding exists, but schema is not initialized.',
                  code: 'SCHEMA_MISSING' 
              }, 200); // Return 200 so UI can handle the setup
          }
        return jsonResponse({ success: false, error: `DB Query Failed: ${e.message}` }, 500);
      }
    }

    // 4. Handle INIT_SCHEMA (Provisioning)
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

    // 5. Handle WRITE_TEST (Diagnostic)
    if (action === 'WRITE_TEST') {
      try {
        const testId = `diag_${Date.now()}`;
        await DB.prepare("INSERT INTO `stores` (id, name, isActive) VALUES (?, ?, ?)")
          .bind(testId, "Diagnostic Store", 0)
          .run();
        await DB.prepare("DELETE FROM `stores` WHERE id = ?").bind(testId).run();
        return jsonResponse({ success: true, message: 'Database is writable.' });
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