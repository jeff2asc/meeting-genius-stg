#!/bin/bash
echo "=== MEETINGS WITH TOPICS - DETAILED VIEW ==="
docker exec -i supabase-db psql -U postgres -d postgres -c "
SELECT m.id as meeting_id, m.title as meeting_title, t.id as topic_id, t.title as topic_title, t.section_id
FROM meetings m
JOIN topics t ON t.meeting_id = m.id
WHERE m.id IN (25, 26, 30, 32, 20, 41, 58, 66)
ORDER BY m.id, t.id;"

echo "=== NOTES COUNT PER TOPIC ==="
docker exec -i supabase-db psql -U postgres -d postgres -c "
SELECT n.topic_id, COUNT(n.id) as note_count
FROM notes n
GROUP BY n.topic_id
ORDER BY n.topic_id;"

echo "=== TASKS COUNT PER TOPIC ==="
docker exec -i supabase-db psql -U postgres -d postgres -c "
SELECT t.topic_id, COUNT(t.id) as task_count
FROM tasks t
GROUP BY t.topic_id
ORDER BY t.topic_id;"

echo "=== DECISIONS COUNT PER TOPIC ==="
docker exec -i supabase-db psql -U postgres -d postgres -c "
SELECT d.topic_id, COUNT(d.id) as decision_count
FROM decisions d
GROUP BY d.topic_id
ORDER BY d.topic_id;"
