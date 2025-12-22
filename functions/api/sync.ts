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
    if (!DB || typeof DB.prepare !== 'function') {
      return jsonResponse({ 
        success: false,
        error: 'D1 Database binding "DB" is missing. Please check your Cloudflare Pages / Wrangler configuration.',
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
        return jsonResponse({ success: false, error: `DB Query Failed: ${e.message}` }, 500);
      }
    }

    // 4. Handle WRITE_TEST (Diagnostic)
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
          if (e.message.includes("no such table")) hint = "The 'stores' table is missing. Run the CREATE TABLE commands in D1 console.";
          return jsonResponse({ success: false, error: e.message, hint }, 500);
      }
    }

    // 5. Handle standard Sync Actions
    if (!table || !data) {
       return jsonResponse({ success: false, error: 'Missing table or data parameters' }, 400);
    }

    // Move query and params declaration outside try block to be accessible in catch block
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
          if (!data[pk]) throw new Error(`Missing primary key: ${pk}`);
          query = `DELETE FROM \`${table}\` WHERE \`${pk}\` = ?`;
          params = [data[pk]];
          break;
        }
        default:
          return jsonResponse({ success: false, error: `Invalid action: ${action}` }, 400);
      }

      const result = await DB.prepare(query).bind(...params).run();
      return jsonResponse({ success: true, meta: result.meta });

    } catch (err: any) {
      console.error(`SQL Error [${table}]:`, err.message);
      // query is now accessible here
      return jsonResponse({ 
          success: false,
          error: err.message,
          details: `Query: ${query.substring(0, 50)}...`
      }, 500);
    }
  } catch (globalErr: any) {
    // Catch-all to prevent HTML error responses from Cloudflare
    return jsonResponse({
      success: false,
      error: 'Internal Worker Exception',
      message: globalErr.message
    }, 500);
  }
};