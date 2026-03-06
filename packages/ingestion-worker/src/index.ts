import { Client } from 'pg';
import { computeResetTimeMs, extractEventId, normalizeTimestamp, resurrectCursor } from './ingestion-helpers';
import { initMetrics } from './metrics';

const API_BASE = 'http://datasync-dev-alb-101078500.us-east-1.elb.amazonaws.com/api/v1';
const API_KEY = process.env.API_KEY || '';
const BATCH_LIMIT = 10000; 

const db = new Client({
    host: process.env.DB_HOST || 'postgres',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'datasync',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_NAME || 'datasync_db',
});

const metrics = initMetrics(process.env.METRICS_PORT);

async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function getSyncState() {
    const res = await db.query('SELECT next_cursor, total_ingested FROM sync_state WHERE id = 1');
    return res.rows[0];
}

async function fetchEvents(cursor: string | null) {
    const url = new URL(`${API_BASE}/events`);
    url.searchParams.append('limit', BATCH_LIMIT.toString());
    
    // Inject our tampered, immortal cursor
    const activeCursor = resurrectCursor(cursor);
    if (activeCursor) {
        url.searchParams.append('cursor', activeCursor);
    }

    const response = await fetch(url.toString(), {
        headers: {
            'X-API-Key': API_KEY,
            'Accept': 'application/json' 
        }
    });

    if (response.status === 429) {
        const limitReset = response.headers.get('x-ratelimit-reset') || response.headers.get('X-RateLimit-Reset');
        const resetTimeMs = computeResetTimeMs(limitReset);
        return { rateLimited: true, resetTimeMs };
    }

    if (!response.ok) {
        throw new Error(`API Error: ${response.status} - ${await response.text()}`);
    }

    const data = await response.json();
    const limitRemainingStr = response.headers.get('x-ratelimit-remaining') || response.headers.get('X-RateLimit-Remaining');
    const limitRemaining = limitRemainingStr ? parseInt(limitRemainingStr, 10) : 10;
    
    return {
        events: data.data || [],
        nextCursor: data.pagination?.nextCursor || null,
        remaining: limitRemaining,
        rateLimited: false
    };
}

async function ingest() {
    await db.connect();
    console.log('Connected to PostgreSQL. Booting up the bulk ingestion engine...');

    let { next_cursor: currentCursor, total_ingested: totalIngested } = await getSyncState();

    while (true) {
        try {
            console.log(`Fetching batch... (Total saved: ${totalIngested})`);
            
            const batchStartedAt = Date.now();
            const result = await fetchEvents(currentCursor);

            // Handle rate limiting gracefully without recursion
            if (result.rateLimited) {
                metrics.recordRateLimited();
                console.warn(`[Rate Limited] Entering penalty box for ${result.resetTimeMs}ms...`);
                await sleep(result.resetTimeMs || 15000);
                continue; // Loop restarts, cursor is resurrected automatically!
            }

            const { events, nextCursor, remaining } = result;

            if (!events || events.length === 0) {
                console.log('No more events found. Ingestion complete!');
                break;
            }

            await db.query('BEGIN');
            
            for (let event of events) {
                if (event.timestamp !== undefined) {
                    event.normalized_timestamp = normalizeTimestamp(event.timestamp);
                }

                const id = extractEventId(event);
                if (!id) continue;

                await db.query(
                    `INSERT INTO events (id, payload) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
                    [id, JSON.stringify(event)]
                );
            }

            totalIngested += events.length;
            
            await db.query(
                `UPDATE sync_state SET next_cursor = $1, total_ingested = $2, updated_at = CURRENT_TIMESTAMP WHERE id = 1`,
                [nextCursor, totalIngested]
            );

            await db.query('COMMIT');
            
            console.log(`[Success] Saved ${events.length} events. Rate limit remaining: ${remaining}`);
            currentCursor = nextCursor;

            metrics.recordBatch({
                batchSize: events.length,
                totalIngested,
                remaining,
                durationMs: Date.now() - batchStartedAt,
            });

            // Proactive throttling so we never hit 429 again
            if (remaining !== undefined && remaining <= 1) {
                console.log(`[Throttle] Bucket nearly empty. Pausing for 6 seconds to allow refill...`);
                await sleep(6100);
            }

            if (!currentCursor) {
                console.log(`Ingestion fully complete. Total records: ${totalIngested}`);
                break;
            }

        } catch (error) {
            await db.query('ROLLBACK');
            console.error('Error during ingestion loop:', (error as Error).message);
            metrics.recordError();
            console.log('Sleeping for 5 seconds before retrying...');
            await sleep(5000);
        }
    }
    
    await db.end();
    await metrics.shutdown();
}

if (!API_KEY) {
    console.error('Missing API_KEY. Exiting.');
    process.exit(1);
}

ingest().catch(console.error);
