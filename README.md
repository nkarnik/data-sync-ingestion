# DataSync Ingestion Worker

## How to run
1. Export your API key: `export API_KEY=your_actual_key`
2. Execute the runner: `sh run-ingestion.sh`

## Architecture overview
- **Docker Compose**: Orchestrates a PostgreSQL 15 database and a Node.js/TypeScript ingestion worker.
- **Resumability**: Uses a `sync_state` table in Postgres to track the `next_cursor` and `total_ingested`. Database transactions ensure atomic updates between saving event payloads and advancing the cursor.
- **Language**: TypeScript/Node.js.

## Discoveries about the API
*(To be filled out once we intercept the hidden endpoints/headers)*

## AI Tools Used
- Used Gemini for boilerplate generation, Docker orchestration, and Postgres transaction structuring.
