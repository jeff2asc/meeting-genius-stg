SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname IN ('meetings', 'sections', 'topics', 'companies');
