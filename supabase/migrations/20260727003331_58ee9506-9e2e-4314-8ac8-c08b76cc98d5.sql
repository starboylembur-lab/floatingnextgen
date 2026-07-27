CREATE POLICY "generated images owner read"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'generated-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "generated images owner delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'generated-images' AND auth.uid()::text = (storage.foldername(name))[1]);