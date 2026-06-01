#!/bin/bash
docker exec -i supabase-db psql -U postgres -d postgres -c "SELECT setval('sections_id_seq', COALESCE((SELECT MAX(id)+1 FROM sections), 1), false);"
