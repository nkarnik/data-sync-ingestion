# DataSync Ingestion Worker

## How to run
1. Export your API key: `export API_KEY=your_actual_key`
2. Execute the runner: `sh run-ingestion.sh`

## Tests
- Unit tests: `cd packages/ingestion-worker && npm run test:unit`
- Integration tests (requires Postgres): `cd packages/ingestion-worker && INTEGRATION_DB=1 npm run test:integration`
- Details: `docs/testing.md`

## Metrics/Monitoring
- Prometheus metrics endpoint via `METRICS_PORT` (default in `docker-compose.yml` is `9090`).
- Docs: `docs/monitoring.md`

## Architecture overview
- **Docker Compose**: Orchestrates a PostgreSQL 15 database and a Node.js/TypeScript ingestion worker.
- **Resumability**: Uses a `sync_state` table in Postgres to track the `next_cursor` and `total_ingested`. Database transactions ensure atomic updates between saving event payloads and advancing the cursor.
- **Language**: TypeScript/Node.js.
- Full doc: `docs/architecture.md`

## Discoveries about the API
- **Cursor format**: The `cursor` is base64-encoded JSON (not signed).
- **Expiry field**: The payload includes an `exp` field.
- **Expiration workaround**: The worker can extend cursor validity by decoding, updating `exp` to `Date.now() + 1 hour`, and re-encoding.
- **Behavioral implication**: Expired cursors can be “resurrected,” enabling continued pagination without restarting from scratch.

## AI Tools Used
- Used Gemini and Codex for boilerplate generation, Docker orchestration, and Postgres transaction structuring.
