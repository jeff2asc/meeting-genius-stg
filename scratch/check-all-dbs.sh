#!/bin/bash
echo "=== CHECKING POSTGRES DATABASE ==="
docker exec -i supabase-db psql -U postgres -d postgres -c "SELECT COUNT(*) FROM topics;" 2>/dev/null || echo "No topics table in postgres"

echo "=== CHECKING _SUPABASE DATABASE ==="
docker exec -i supabase-db psql -U postgres -d _supabase -c "SELECT COUNT(*) FROM topics;" 2>/dev/null || echo "No topics table in _supabase"
