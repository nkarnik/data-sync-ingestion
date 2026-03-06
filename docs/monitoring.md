# Metrics & Monitoring

## Prometheus Metrics Endpoint
Set `METRICS_PORT` to enable the Prometheus scrape endpoint:

```
METRICS_PORT=9090
```

When enabled, the worker exposes metrics at `http://<host>:9090/metrics`.

## Metrics Exposed
- `ingestion_events_total`: Total events ingested.
- `ingestion_batches_total`: Total batches ingested.
- `ingestion_rate_limited_total`: Rate-limit responses received.
- `ingestion_errors_total`: Ingestion loop errors.
- `ingestion_last_batch_size`: Size of the most recent batch.
- `ingestion_total_ingested`: Total events according to `sync_state`.
- `ingestion_rate_limit_remaining`: Latest API rate-limit remaining value.
- `ingestion_batch_duration_ms`: Batch loop duration histogram.

## Suggested Alerts
- `ingestion_errors_total` increasing rapidly.
- `ingestion_rate_limited_total` spikes.
- No increase in `ingestion_events_total` over a defined interval.
