#!/bin/bash
echo "=== ALL MEETINGS WITH TOPIC COUNTS ==="
docker exec -i supabase-db psql -U postgres -d postgres -c "
SELECT m.id, m.title, COUNT(t.id) as topic_count
FROM meetings m
LEFT JOIN topics t ON t.meeting_id = m.id
GROUP BY m.id, m.title
ORDER BY topic_count DESC, m.id;"
