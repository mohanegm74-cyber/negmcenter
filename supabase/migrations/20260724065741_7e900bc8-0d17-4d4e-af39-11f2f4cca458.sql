
CREATE POLICY "subs read" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'submissions');
CREATE POLICY "subs write" ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'submissions');
CREATE POLICY "subs update" ON storage.objects FOR UPDATE TO anon, authenticated USING (bucket_id = 'submissions');
CREATE POLICY "subs delete" ON storage.objects FOR DELETE TO anon, authenticated USING (bucket_id = 'submissions');
