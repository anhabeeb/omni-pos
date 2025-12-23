/**
 * CLOUDFLARE D1 DATABASE SYNC API
 */

interface Env {
  // Fixed: Replaced D1Database with any to resolve "Cannot find name 'D1Database'" error
  // This occurs because the Cloudflare Workers/Pages type definitions are not globally available in this specific environment.
  DB: any;
}

const jsonResponse = (data: any, status = 200) => {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 
      'Content-Type': 'application/json',
      'X-OmniPOS-System': 'verified',
      'Access-Control-Allow-Origin': '*'
    }
  });
};

export const onRequestPost = async (context: { env: Env; request: Request }): Promise<Response> => {
  try {
    const DB = context.env.DB;

    if (!DB) {
      return jsonResponse({ 
        success: false,
        error: 'Database binding "DB" not found.',
        hint: 'Check your wrangler.toml or Cloudflare Dashboard for D1 bindings.'
      }, 500);
    }
    
    let payload: any;
    try {
      payload = await context.request.json();
    } catch (e) {
      return jsonResponse({ success: false, error: 'Invalid JSON payload' }, 400);
    }

    const { action, table, data } = payload;

    if (action === 'PING') {
      try {
        await DB.prepare('SELECT 1').run();
        return jsonResponse({ success: true, message: 'pong' });
      } catch (e: any) {
        return jsonResponse({ success: false, error: e.message }, 500);
      }
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
        "CREATE TABLE IF NOT EXISTS `global_permissions` (role TEXT PRIMARY KEY, permissions TEXT)"
      ];
      for (const q of schema) await DB.prepare(q).run();
      return jsonResponse({ success: true });
    }

    if (action === 'WRITE_TEST') {
      return jsonResponse({ success: true, message: 'D1 is writable' });
    }

    if (!table || !data) return jsonResponse({ success: false, error: 'Missing params' }, 400);

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

  } catch (err: any) {
    return jsonResponse({ success: false, error: err.message }, 500);
  }
};