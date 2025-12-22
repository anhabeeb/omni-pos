/**
 * CLOUDFLARE D1 DATABASE SCHEMA
 * Run these commands in your Cloudflare D1 console to initialize the database:
 * 
 * CREATE TABLE `stores` (id TEXT PRIMARY KEY, name TEXT, currency TEXT, address TEXT, phone TEXT, tin TEXT, buildingName TEXT, streetName TEXT, city TEXT, province TEXT, zipCode TEXT, taxRate REAL, serviceChargeRate REAL, minStartingCash REAL, numberOfTables INTEGER, isActive INTEGER, printSettings TEXT, quotationSettings TEXT, eodSettings TEXT);
 * CREATE TABLE `users` (id TEXT PRIMARY KEY, userNumber INTEGER, name TEXT, username TEXT, password TEXT, role TEXT, storeIds TEXT);
 * CREATE TABLE `employees` (id TEXT PRIMARY KEY, empId TEXT, fullName TEXT, dob TEXT, nationality TEXT, idNumber TEXT, phoneNumber TEXT, emergencyContactNumber TEXT, emergencyContactPerson TEXT, emergencyRelation TEXT, createdAt INTEGER);
 * CREATE TABLE `products` (id TEXT PRIMARY KEY, name TEXT, price REAL, cost REAL, categoryId TEXT, isAvailable INTEGER, imageUrl TEXT, storeId TEXT, recipe TEXT);
 * CREATE TABLE `categories` (id TEXT PRIMARY KEY, name TEXT, orderId INTEGER);
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

  if (!DB) {
    return new Response(JSON.stringify({ 
      error: 'D1 Database binding "DB" is missing. Please check your Wrangler config or Cloudflare dashboard.',
      code: 'MISSING_BINDING'
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
  
  let payload: any;
  try {
    payload = await context.request.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Invalid JSON payload' }), { status: 400 });
  }

  const { action, table, data } = payload;

  try {
    let query = '';
    let params: any[] = [];

    const sqlifyValues = (obj: any) => {
      return Object.values(obj).map(val => {
        if (val !== null && typeof val === 'object') {
          return JSON.stringify(val);
        }
        if (typeof val === 'boolean') {
          return val ? 1 : 0;
        }
        return val;
      });
    };

    switch (action) {
      case 'INSERT': {
        const keys = Object.keys(data).map(k => `\`${k}\``).join(', ');
        const placeholders = Object.keys(data).map(() => '?').join(', ');
        query = `INSERT INTO \`${table}\` (${keys}) VALUES (${placeholders})`;
        params = sqlifyValues(data);
        break;
      }

      case 'UPDATE': {
        // Detect primary key (usually 'id', but 'role' for permissions)
        const pk = (table === 'permissions' || table === 'global_permissions') ? 'role' : 'id';
        const sets = Object.keys(data)
          .filter(k => k !== pk)
          .map(k => `\`${k}\` = ?`)
          .join(', ');
        
        query = `UPDATE \`${table}\` SET ${sets} WHERE \`${pk}\` = ?`;
        
        const filteredData = { ...data };
        const pkValue = filteredData[pk];
        delete filteredData[pk];
        
        params = [...sqlifyValues(filteredData), pkValue];
        break;
      }

      case 'DELETE': {
        const pk = (table === 'permissions' || table === 'global_permissions') ? 'role' : 'id';
        query = `DELETE FROM \`${table}\` WHERE \`${pk}\` = ?`;
        params = [data[pk]];
        break;
      }

      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400 });
    }

    const result = await DB.prepare(query).bind(...params).run();
    
    return new Response(JSON.stringify({ 
      success: true,
      meta: result.meta
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err: any) {
    const errorMsg = err.message?.toLowerCase() || '';
    const isDuplicate = errorMsg.includes('unique constraint') || 
                       errorMsg.includes('already exists') ||
                       errorMsg.includes('code 1555');

    if (isDuplicate) {
      return new Response(JSON.stringify({ 
        error: 'Conflict: Record already exists in central database.',
        code: 'DUPLICATE_ID',
        table,
        id: data.id || data.role
      }), { 
        status: 409, 
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.error(`D1 Sync Error [${table} - ${action}]:`, err.message);
    return new Response(JSON.stringify({ 
        error: err.message,
        details: `Table: ${table}, Action: ${action}. Check if the table exists in D1.`
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
