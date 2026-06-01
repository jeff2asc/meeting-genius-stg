#!/bin/bash
echo "=== RLS STATUS ON ALL KEY TABLES ==="
docker exec -i supabase-db psql -U postgres -d postgres -c "
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('meetings','sections','topics','tasks','notes','decisions','topic_attachments','section_attachments','meeting_transcripts')
ORDER BY tablename;"

echo ""
echo "=== TOTAL ROW COUNTS ==="
docker exec -i supabase-db psql -U postgres -d postgres -c "
SELECT 'meetings' as tbl, COUNT(*) FROM meetings
UNION ALL SELECT 'sections', COUNT(*) FROM sections
UNION ALL SELECT 'topics', COUNT(*) FROM topics
UNION ALL SELECT 'tasks', COUNT(*) FROM tasks
UNION ALL SELECT 'notes', COUNT(*) FROM notes
UNION ALL SELECT 'decisions', COUNT(*) FROM decisions
UNION ALL SELECT 'topic_attachments', COUNT(*) FROM topic_attachments
UNION ALL SELECT 'section_attachments', COUNT(*) FROM section_attachments;"

echo ""
echo "=== RLS POLICIES ON SECTIONS ==="
docker exec -i supabase-db psql -U postgres -d postgres -c "
SELECT policyname, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'sections';"

echo ""
echo "=== RLS POLICIES ON TOPICS ==="
docker exec -i supabase-db psql -U postgres -d postgres -c "
SELECT policyname, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'topics';"
