#!/bin/bash
echo "=== TOPICS FOR MEETING 100 ==="
docker exec -i supabase-db psql -U postgres -d postgres -c "SELECT id, title, section_id FROM topics WHERE meeting_id = 100;"

echo "=== SECTIONS FOR MEETING 100 ==="
docker exec -i supabase-db psql -U postgres -d postgres -c "SELECT id, title FROM sections WHERE meeting_id = 100;"
