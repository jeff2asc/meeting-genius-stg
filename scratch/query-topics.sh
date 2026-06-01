#!/bin/bash
echo "=== TOPICS DETAIL FOR COMPANY 21 ==="
docker exec -i supabase-db psql -U postgres -d postgres -c "
SELECT t.id, t.meeting_id, t.title, m.title as meeting_title 
FROM topics t 
LEFT JOIN meetings m ON t.meeting_id = m.id 
LEFT JOIN buildings b ON m.building_id = b.id 
WHERE b.company_id = 21;"
