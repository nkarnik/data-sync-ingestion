# Architecture

## Overview
The ingestion system consists of a TypeScript worker that polls the DataSync API and persists event payloads into PostgreSQL. A `sync_state` row tracks `next_cursor` and `total_ingested` so the worker can resume safely after restarts.

## Components
- `packages/ingestion-worker/src/index.ts`: Main ingestion loop.
- PostgreSQL 15: Stores `events` payloads and `sync_state` state.
- Docker Compose: Orchestrates local database and worker runtime.

## Data Flow
1. The worker reads `sync_state` to find the next cursor and total count.
2. The worker fetches a batch of events from the DataSync API.
3. Each event is normalized with `normalized_timestamp` and inserted into `events` (deduplicated by `id`).
4. A transaction commits the batch and advances `sync_state`.

## Resiliency
- Rate limiting: The worker observes API rate-limit headers and sleeps based on `x-ratelimit-reset`.
- Cursor expiration: The worker attempts to resurrect expired cursors by rewriting the unsigned payload.
- Failure handling: Errors cause a rollback and a fixed backoff sleep.

## Extensibility Notes
- Consider swapping the cursor resurrection hack for a supported API flow once available.
- Add structured logging for long-term observability.
