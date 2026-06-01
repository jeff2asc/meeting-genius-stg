#!/bin/bash
docker exec -i supabase-db psql -U postgres -d postgres -c "SELECT datname FROM pg_database;"
