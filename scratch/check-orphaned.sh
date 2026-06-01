#!/bin/bash
echo "=== TOPICS THAT HAVE TASKS BUT ARE NOT YET LINKED TO VISIBLE MEETINGS ==="
docker exec -i supabase-db psql -U postgres -d postgres -c "
SELECT DISTINCT t.id as topic_id, t.meeting_id, t.title as topic_title, t.section_id, m.title as meeting_title
FROM topics t
JOIN tasks tk ON tk.topic_id = t.id
LEFT JOIN meetings m ON m.id = t.meeting_id
ORDER BY t.meeting_id;"

echo ""
echo "=== TOPICS THAT HAVE NOTES BUT ARE NOT YET LINKED TO VISIBLE MEETINGS ==="
docker exec -i supabase-db psql -U postgres -d postgres -c "
SELECT DISTINCT t.id as topic_id, t.meeting_id, t.title as topic_title, t.section_id, m.title as meeting_title
FROM topics t
JOIN notes n ON n.topic_id = t.id
LEFT JOIN meetings m ON m.id = t.meeting_id
ORDER BY t.meeting_id;"

echo ""
echo "=== TOPICS THAT HAVE DECISIONS ==="
docker exec -i supabase-db psql -U postgres -d postgres -c "
SELECT DISTINCT t.id as topic_id, t.meeting_id, t.title as topic_title, t.section_id, m.title as meeting_title
FROM topics t
JOIN decisions d ON d.topic_id = t.id
LEFT JOIN meetings m ON m.id = t.meeting_id
ORDER BY t.meeting_id;"
