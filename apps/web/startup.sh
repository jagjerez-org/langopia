#!/bin/sh
set -e

echo "Starting Langopia web application..."

# Wait for database to be ready using simple TCP check
echo "Waiting for database connection..."
until nc -z postgres-service 5432 2>/dev/null; do
  echo "Database not ready, waiting..."
  sleep 2
done
echo "Database connected!"

echo "Starting Next.js server..."
exec node apps/web/server.js
