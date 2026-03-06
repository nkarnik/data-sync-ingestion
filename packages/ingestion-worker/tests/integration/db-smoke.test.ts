import { Client } from 'pg';
import { describe, expect, it } from 'vitest';

const shouldRun = process.env.INTEGRATION_DB === '1';
const suite = shouldRun ? describe : describe.skip;

suite('postgres integration', () => {
  it('connects and runs a simple query', async () => {
    const client = new Client({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      user: process.env.DB_USER || 'datasync',
      password: process.env.DB_PASSWORD || 'password',
      database: process.env.DB_NAME || 'datasync_db',
    });

    await client.connect();
    const result = await client.query('SELECT 1 as ok');
    await client.end();

    expect(result.rows[0].ok).toBe(1);
  });
});
