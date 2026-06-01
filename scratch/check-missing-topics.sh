#!/bin/bash
echo "=== TOPICS WITH HIGH IDs THAT HAVE TASKS (checking for missing meetings) ==="
docker exec -i supabase-db psql -U postgres -d postgres -c "
SELECT t.id as topic_id, t.meeting_id, t.title, t.section_id, m.title as meeting_title
FROM topics t
LEFT JOIN meetings m ON m.id = t.meeting_id
WHERE t.id IN (127,129,147,151,152,153,178,179,181,184,185,190,192,198,199,203,224,225,236,253,256,266,268,289,297,307,346,347,357,402,464,551,561,574)
ORDER BY t.meeting_id;"
