import http from 'http';
import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

export type Metrics = {
  recordBatch: (params: { batchSize: number; totalIngested: number; remaining?: number; durationMs: number }) => void;
  recordRateLimited: () => void;
  recordError: () => void;
  shutdown: () => Promise<void>;
};

const noopMetrics: Metrics = {
  recordBatch: () => {},
  recordRateLimited: () => {},
  recordError: () => {},
  shutdown: async () => {},
};

export function initMetrics(portEnv: string | undefined): Metrics {
  if (!portEnv) return noopMetrics;
  const port = parseInt(portEnv, 10);
  if (!Number.isFinite(port) || port <= 0) return noopMetrics;

  const register = new Registry();
  collectDefaultMetrics({ register });

  const eventsTotal = new Counter({
    name: 'ingestion_events_total',
    help: 'Total events ingested',
    registers: [register],
  });
  const batchesTotal = new Counter({
    name: 'ingestion_batches_total',
    help: 'Total batches ingested',
    registers: [register],
  });
  const rateLimitedTotal = new Counter({
    name: 'ingestion_rate_limited_total',
    help: 'Total rate limit responses received',
    registers: [register],
  });
  const errorsTotal = new Counter({
    name: 'ingestion_errors_total',
    help: 'Total ingestion loop errors',
    registers: [register],
  });
  const lastBatchSize = new Gauge({
    name: 'ingestion_last_batch_size',
    help: 'Size of the most recent ingested batch',
    registers: [register],
  });
  const totalIngestedGauge = new Gauge({
    name: 'ingestion_total_ingested',
    help: 'Total events ingested according to sync state',
    registers: [register],
  });
  const rateLimitRemaining = new Gauge({
    name: 'ingestion_rate_limit_remaining',
    help: 'Last reported API rate limit remaining',
    registers: [register],
  });
  const batchDuration = new Histogram({
    name: 'ingestion_batch_duration_ms',
    help: 'Duration of a batch ingestion loop in milliseconds',
    registers: [register],
    buckets: [250, 500, 1000, 2000, 5000, 10000, 30000],
  });

  const server = http.createServer(async (req, res) => {
    if (req.url === '/metrics') {
      res.statusCode = 200;
      res.setHeader('Content-Type', register.contentType);
      res.end(await register.metrics());
      return;
    }
    res.statusCode = 404;
    res.end('Not Found');
  });

  server.listen(port, '0.0.0.0');
  console.log(`[Metrics] Prometheus endpoint listening on :${port}/metrics`);

  return {
    recordBatch: ({ batchSize, totalIngested, remaining, durationMs }) => {
      batchesTotal.inc(1);
      eventsTotal.inc(batchSize);
      lastBatchSize.set(batchSize);
      totalIngestedGauge.set(totalIngested);
      if (remaining !== undefined) {
        rateLimitRemaining.set(remaining);
      }
      batchDuration.observe(durationMs);
    },
    recordRateLimited: () => {
      rateLimitedTotal.inc(1);
    },
    recordError: () => {
      errorsTotal.inc(1);
    },
    shutdown: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    },
  };
}
