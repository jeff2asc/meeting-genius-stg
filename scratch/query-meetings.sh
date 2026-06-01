#!/bin/bash
docker exec -i supabase-db psql -U postgres -d postgres -c "SELECT m.id, m.title, m.building_id, b.company_id FROM meetings m LEFT JOIN buildings b ON m.building_id = b.id ORDER BY m.id DESC LIMIT 15;"
