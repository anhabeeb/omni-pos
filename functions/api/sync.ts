/**
 * CLOUDFLARE D1 DATABASE SCHEMA
 * Run these commands in your Cloudflare D1 console to initialize the database:
 * 
 * CREATE TABLE `stores` (id TEXT PRIMARY KEY, name TEXT, currency TEXT, address TEXT, phone TEXT, tin TEXT, buildingName TEXT, streetName TEXT, city TEXT, province TEXT, zipCode TEXT, taxRate REAL, serviceChargeRate REAL, minStartingCash REAL, numberOfTables INTEGER, isActive INTEGER, printSettings TEXT, quotationSettings TEXT, eodSettings TEXT);
 * CREATE TABLE `users` (id TEXT PRIMARY KEY, userNumber INTEGER, name TEXT, username TEXT, password TEXT, role TEXT, storeIds TEXT);
 * CREATE TABLE `employees` (id TEXT PRIMARY KEY, empId TEXT, fullName TEXT, dob TEXT, nationality TEXT, idNumber TEXT, phoneNumber TEXT, emergencyContactNumber TEXT, emergencyContactPerson TEXT, emergencyRelation TEXT, createdAt INTEGER);
 * CREATE TABLE `products` (id TEXT PRIMARY KEY, name TEXT, price REAL, cost REAL, categoryId TEXT, isAvailable INTEGER, imageUrl TEXT, storeId TEXT, recipe TEXT);
 * CREATE TABLE `categories` (id TEXT PRIMARY KEY, name TEXT, orderId INTEGER, storeId TEXT);
 * CREATE TABLE `customers` (id TEXT PRIMARY KEY, name TEXT, phone TEXT, type TEXT, companyName TEXT, tin TEXT, houseName TEXT, streetName TEXT, buildingName TEXT, street TEXT, island TEXT, country TEXT, address TEXT, storeId TEXT);
 * CREATE TABLE `orders` (id TEXT PRIMARY KEY, orderNumber TEXT, storeId TEXT, shiftId TEXT, items TEXT, subtotal REAL, discountPercent REAL, discountAmount REAL, tax REAL, serviceCharge REAL, total REAL, orderType TEXT, status TEXT, kitchenStatus TEXT, paymentMethod TEXT, transactions TEXT, tableNumber TEXT, customerName TEXT, customerPhone TEXT, customerTin TEXT, customerAddress TEXT, note TEXT, cancellationReason TEXT, createdBy TEXT, createdAt INTEGER);
 * CREATE TABLE `quotations` (id TEXT PRIMARY KEY, quotationNumber TEXT, storeId TEXT, customerName TEXT, customerPhone TEXT, customerTin TEXT, customerAddress TEXT, items TEXT, subtotal REAL, discountPercent REAL, discountAmount REAL, tax REAL, total REAL, validUntil INTEGER, createdBy TEXT, createdAt INTEGER);
 * CREATE TABLE `shifts` (id TEXT PRIMARY KEY, shiftNumber INTEGER, storeId TEXT, openedBy TEXT, openedAt INTEGER, startingCash REAL, openingDenominations TEXT, status TEXT, closedAt INTEGER, closedBy TEXT, expectedCash REAL, actualCash REAL, closingDenominations TEXT, difference REAL, totalCashSales REAL, totalCashRefunds REAL, heldOrdersCount INTEGER, notes TEXT);
 * CREATE TABLE `inventory` (id TEXT PRIMARY KEY, name TEXT, quantity REAL, unit TEXT, minLevel REAL, storeId TEXT);
 * CREATE TABLE `permissions` (role TEXT PRIMARY KEY, permissions TEXT);
 */

interface Env {
  DB: any;
}

export const onRequestPost = async (context: { env: Env; request: Request }): Promise<Response> => {
  const { DB } = context.env;

  // 1. Check if the binding exists
  if (!DB || typeof DB.prepare !== 'function') {
    return new Response(JSON.stringify({ 
      success: false,
      error: 'D1 Database binding "DB" is missing in Cloudflare environment.',
      code: 'MISSING_BINDING'
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
  
  let payload: any;
  try {
    payload = await context.request.json();
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: 'Invalid JSON payload' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const { action, table, data } = payload;

  // 2. Handshake / Health Check
  if (action === 'PING') {
    try {
      await DB.prepare('SELECT 1').run();
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'pong', 
        timestamp: Date.now(),
        status: 'DATABASE_CONNECTED'
      }), { headers: { 'Content-Type': 'application/json' } });
    } catch (e: any) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: `Database query failed: ${e.message}`,
        code: 'DB_QUERY_ERROR'
      }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
  }

  if (!table || !data) {
     return new Response(JSON.stringify({ success: false, error: 'Missing table or data' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    let query = '';
    let params: any[] = [];

    const sqlifyValues = (obj: any) => {
      return Object.keys(obj).map(key => {
        const val = obj[key];
        if (val !== null && typeof val === 'object') return JSON.stringify(val);
        if (typeof val === 'boolean') return val ? 1 : 0;
        return val;
      });
    };

    switch (action) {
      case 'INSERT':
      case 'UPDATE': {
        const keys = Object.keys(data).map(k => `\`${k}\``).join(', ');
        const placeholders = Object.keys(data).map(() => '?').join(', ');
        query = `INSERT OR REPLACE INTO \`${table}\` (${keys}) VALUES (${placeholders})`;
        params = sqlifyValues(data);
        break;
      }

      case 'DELETE': {
        const pk = (table === 'permissions' || table === 'global_permissions') ? 'role' : 'id';
        const pkValue = data[pk];
        if (!pkValue) throw new Error(`Missing primary key (${pk}) for DELETE`);
        query = `DELETE FROM \`${table}\` WHERE \`${pk}\` = ?`;
        params = [pkValue];
        break;
      }

      default:
        return new Response(JSON.stringify({ success: false, error: 'Invalid action' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // CRITICAL FIX: Use .bind(...params).run() for Cloudflare D1
    const result = await DB.prepare(query).bind(...params).run();
    
    if (!result.success) {
        throw new Error(result.error || 'D1 execution failed without specific error message.');
    }

    return new Response(JSON.stringify({ 
      success: true,
      meta: result.meta
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err: any) {
    console.error(`D1 Sync Error [${table} - ${action}]:`, err.message);
    return new Response(JSON.stringify({ 
        success: false,
        error: err.message,
        details: `SQL Operation failed. Ensure the table "${table}" exists and matches the object schema.`
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};