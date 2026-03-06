#!/bin/bash

API_KEY="ds_62864439a8082109a23a58425452f1cd"
GITHUB_REPO="https://github.com/yourusername/datasync-ingestion"

echo "Dumping 1,200,000 IDs from PostgreSQL..."
# Added LIMIT 1,200000 to the SQL query
docker-compose exec -T postgres psql -U datasync -d datasync_db -t -A -c "SELECT id FROM events LIMIT 1200000;" > event_ids_partial.txt

echo "Total IDs dumped:"
wc -l event_ids_partial.txt

echo "Submitting partial batch to DataSync API..."
curl -X POST \
  -H "X-API-Key: ${API_KEY}" \
  -H "Content-Type: text/plain" \
  --data-binary @event_ids_partial.txt \
  "http://datasync-dev-alb-101078500.us-east-1.elb.amazonaws.com/api/v1/submissions?github_repo=${GITHUB_REPO}"

echo -e "\nPartial submission complete!"
