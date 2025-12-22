interface Env {
  DB: any;
}

export const onRequestPost = async (context: { env: Env; request: Request }): Promise<Response> => {
  const { DB } = context.env;

  if (!DB) {
    return new Response(JSON.stringify({ 
      error: 'D1 Database binding "DB" is missing in Cloudflare environment.',
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

    // Helper to prepare values for SQL: stringify objects/arrays for JSON columns
    const sqlifyValues = (obj: any) => {
      return Object.values(obj).map(val => {
        if (val !== null && typeof val === 'object') {
          return JSON.stringify(val);
        }
        return val;
      });
    };

    // Use backticks for table names to avoid reserved keyword conflicts (e.g. `order`, `groups`)
    switch (action) {
      case 'INSERT': {
        const keys = Object.keys(data).map(k => `\`${k}\``).join(', ');
        const placeholders = Object.keys(data).map(() => '?').join(', ');
        query = `INSERT INTO \`${table}\` (${keys}) VALUES (${placeholders})`;
        params = sqlifyValues(data);
        break;
      }

      case 'UPDATE': {
        const sets = Object.keys(data)
          .filter(k => k !== 'id')
          .map(k => `\`${k}\` = ?`)
          .join(', ');
        query = `UPDATE \`${table}\` SET ${sets} WHERE \`id\` = ?`;
        
        const filteredData = { ...data };
        delete filteredData.id;
        params = [...sqlifyValues(filteredData), data.id];
        break;
      }

      case 'DELETE': {
        query = `DELETE FROM \`${table}\` WHERE \`id\` = ?`;
        params = [data.id];
        break;
      }

      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400 });
    }

    await DB.prepare(query).bind(...params).run();
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err: any) {
    // Robust detection of unique constraint violations (Duplicate IDs)
    const errorMsg = err.message?.toLowerCase() || '';
    const isDuplicate = errorMsg.includes('unique constraint') || 
                       errorMsg.includes('already exists') ||
                       errorMsg.includes('code 1555'); // SQLite Extended Result Code for constraint

    if (isDuplicate) {
      return new Response(JSON.stringify({ 
        error: 'Conflict: ID already exists in central database',
        code: 'DUPLICATE_ID',
        table,
        id: data.id
      }), { 
        status: 409, 
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.error(`D1 Sync Error [${table} - ${action}]:`, err.message);
    return new Response(JSON.stringify({ 
        error: err.message,
        details: `Table: ${table}, Action: ${action}`
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
