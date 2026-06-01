#!/bin/bash
docker exec -i supabase-db psql -U postgres -d postgres -c "SELECT id, meeting_id, section_id, title FROM topics ORDER BY meeting_id DESC LIMIT 50;"
