#!/bin/bash

# 1. ADD YOUR INFO HERE
API_KEY="YOUR_ACTUAL_API_KEY"
GITHUB_REPO="https://github.com/yourusername/datasync-ingestion"

echo "Dumping IDs from PostgreSQL to event_ids.txt..."
# This command runs inside the Postgres container to dump the IDs instantly
docker-compose exec -T postgres psql -U datasync -d datasync_db -t -A -c "SELECT id FROM events;" > event_ids.txt

echo "Total IDs dumped (Target: 3000000):"
wc -l event_ids.txt

echo "Submitting to DataSync API to stop the clock..."
curl -X POST \
  -H "X-API-Key: ${API_KEY}" \
  -H "Content-Type: text/plain" \
  --data-binary @event_ids.txt \
  "http://datasync-dev-alb-101078500.us-east-1.elb.amazonaws.com/api/v1/submissions?github_repo=${GITHUB_REPO}"

echo -e "\nSubmission complete!"
