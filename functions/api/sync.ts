/**
 * CLOUDFLARE D1 DATABASE SCHEMA
 * ... (existing schema documentation) ...
 */

interface Env {
  DB: any;
}

export const onRequestPost = async (context: { env: Env; request: Request }): Promise<Response> => {
  const { DB } = context.env;

  // 1. Check if the binding itself exists in the environment
  if (!DB || typeof DB.prepare !== 'function') {
    return new Response(JSON.stringify({ 
      success: false,
      error: 'D1 Database binding "DB" is missing. Ensure you have created a D1 database and bound it as "DB" in your Cloudflare Pages settings.',
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

  // 2. NEW: Connection Handshake / Health Check
  if (action === 'PING') {
    try {
      // Test the database connection with a trivial query
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
        error: `API is up, but Database query failed: ${e.message}`,
        code: 'DB_QUERY_ERROR'
      }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
  }

  if (!table || !data) {
     return new Response(JSON.stringify({ error: 'Missing table or data' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  try {
    let query = '';
    let params: any[] = [];

    const sqlifyValues = (obj: any) => {
      return Object.values(obj).map(val => {
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
        return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const result = await DB.prepare(query).run(...params);
    
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
        details: `Table: ${table}, Action: ${action}. Check D1 schema matching.`
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};