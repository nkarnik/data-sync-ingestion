#!/bin/sh
set -e

echo "Starting DataSync Ingestion System..."
# Clean up previous runs to ensure a fresh start for testing
docker-compose down -v 
docker-compose up --build -d

echo "Tailing worker logs..."
docker-compose logs -f ingestion-worker
