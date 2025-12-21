
interface Env {
  // Fix: Use any for DB to resolve missing D1Database type error
  DB: any;
}

// Fix: Explicitly type the function context to resolve missing PagesFunction type error
export const onRequestPost = async (context: { env: Env; request: Request }): Promise<Response> => {
  const { DB } = context.env;
  const { action, table, data } = await context.request.json() as any;

  try {
    let query = '';
    let params: any[] = [];

    switch (action) {
      case 'INSERT':
        const keys = Object.keys(data).join(', ');
        const placeholders = Object.keys(data).map(() => '?').join(', ');
        query = `INSERT INTO ${table} (${keys}) VALUES (${placeholders})`;
        params = Object.values(data);
        break;

      case 'UPDATE':
        const sets = Object.keys(data)
          .filter(k => k !== 'id')
          .map(k => `${k} = ?`)
          .join(', ');
        query = `UPDATE ${table} SET ${sets} WHERE id = ?`;
        params = [...Object.entries(data).filter(([k]) => k !== 'id').map(([, v]) => v), data.id];
        break;

      case 'DELETE':
        query = `DELETE FROM ${table} WHERE id = ?`;
        params = [data.id];
        break;

      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400 });
    }

    await DB.prepare(query).bind(...params).run();
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
