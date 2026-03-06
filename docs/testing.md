# Testing

## Unit Tests
Run unit tests from the worker package:

```
cd packages/ingestion-worker
npm test
```

Or just unit tests:

```
npm run test:unit
```

## Integration Tests
Integration tests require a running PostgreSQL instance (via Docker Compose or any local Postgres). The tests use `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`.

Example with Docker Compose:

```
docker-compose up -d postgres
cd packages/ingestion-worker
INTEGRATION_DB=1 npm run test:integration
```
