#!/bin/sh
set -e

# Railway (and most PaaS targets without a distinct Heroku-style release
# phase) run this as the container's actual startup command, so migrations
# apply once per deploy before the API starts accepting traffic. Prisma's
# migrate deploy takes an advisory lock, so this stays safe even if a
# platform briefly runs two instances during a rolling deploy.
echo "Applying database migrations..."
npx prisma migrate deploy

echo "Starting ReproFlow API..."
exec node dist/main.js
