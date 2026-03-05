import { Client } from 'pg';

const API_BASE = 'http://datasync-dev-alb-101078500.us-east-1.elb.amazonaws.com/api/v1';
const API_KEY = process.env.API_KEY || '';

const db = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5434'),
    user: process.env.DB_USER || 'datasync',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'datasync_db',
});

async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function getSyncState() {
    const res = await db.query('SELECT next_cursor, total_ingested FROM sync_state WHERE id = 1');
    return res.rows[0];
}

async function fetchEvents(cursor: string | null): Promise<any> {
    // TODO: Update this URL based on network tab discovery!
    const url = new URL(`${API_BASE}/events`); 
    if (cursor) url.searchParams.append('cursor', cursor);

    const response = await fetch(url.toString(), {
        headers: {
            'X-API-Key': API_KEY,
            'Accept': 'application/json'
        }
    });

    const rateLimitRemaining = response.headers.get('X-RateLimit-Remaining');
    const rateLimitReset = response.headers.get('X-RateLimit-Reset');
    
    if (response.status === 429) {
        const resetTime = rateLimitReset ? parseInt(rateLimitReset) * 1000 - Date.now() : 5000;
        console.warn(`Rate limited! Sleeping for ${Math.max(resetTime, 1000)}ms...`);
        await sleep(Math.max(resetTime, 1000));
        return fetchEvents(cursor); 
    }

    if (!response.ok) {
        throw new Error(`API Error: ${response.status} - ${await response.text()}`);
    }

    const data = await response.json();
    
    // TODO: Inspect actual header names for the cursor
    const nextCursor = response.headers.get('X-Next-Cursor') || data.nextCursor || null; 
    
    return {
        events: data.events || data, 
        nextCursor
    };
}

async function ingest() {
    await db.connect();
    console.log('Connected to PostgreSQL. Starting ingestion loop...');

    let { next_cursor: currentCursor, total_ingested: totalIngested } = await getSyncState();

    while (true) {
        try {
            console.log(`Fetching batch... (Current total: ${totalIngested}, Cursor: ${currentCursor})`);
            
            const { events, nextCursor } = await fetchEvents(currentCursor);

            if (!events || events.length === 0) {
                console.log('No more events found. Ingestion complete!');
                break;
            }

            await db.query('BEGIN');
            
            for (const event of events) {
                // Assuming event has an 'id' field based on standard REST design
                await db.query(
                    `INSERT INTO events (id, payload) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
                    [event.id || crypto.randomUUID(), JSON.stringify(event)]
                );
            }

            totalIngested += events.length;
            await db.query(
                `UPDATE sync_state SET next_cursor = $1, total_ingested = $2, updated_at = CURRENT_TIMESTAMP WHERE id = 1`,
                [nextCursor, totalIngested]
            );

            await db.query('COMMIT');
            currentCursor = nextCursor;

            if (!currentCursor) {
                console.log(`Ingestion fully complete. Total records: ${totalIngested}`);
                break;
            }

        } catch (error) {
            await db.query('ROLLBACK');
            console.error('Error during ingestion loop:', error);
            console.log('Sleeping for 5 seconds before retrying...');
            await sleep(5000);
        }
    }
    
    await db.end();
}

if (!API_KEY || API_KEY === 'your_actual_key') {
    console.error('Missing API_KEY in environment. Exiting to prevent accidental timer start.');
    process.exit(1);
}

ingest().catch(console.error);
