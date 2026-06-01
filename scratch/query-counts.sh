#!/bin/bash
echo "=== TOPICS PER MEETING ==="
docker exec -i supabase-db psql -U postgres -d postgres -c "SELECT meeting_id, COUNT(id) FROM topics GROUP BY meeting_id ORDER BY meeting_id;"

echo "=== TASKS ==="
docker exec -i supabase-db psql -U postgres -d postgres -c "SELECT COUNT(id) FROM tasks;"

echo "=== NOTES ==="
docker exec -i supabase-db psql -U postgres -d postgres -c "SELECT COUNT(id) FROM notes;"

echo "=== DECISIONS ==="
docker exec -i supabase-db psql -U postgres -d postgres -c "SELECT COUNT(id) FROM decisions;"
