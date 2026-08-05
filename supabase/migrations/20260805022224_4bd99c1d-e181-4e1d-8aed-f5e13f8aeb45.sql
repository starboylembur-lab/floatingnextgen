ALTER TABLE public.chats RENAME TO conversations;
ALTER TABLE public.messages RENAME COLUMN chat_id TO conversation_id;
ALTER TABLE public.chat_documents RENAME TO conversation_documents;
ALTER TABLE public.conversation_documents RENAME COLUMN chat_id TO conversation_id;
ALTER POLICY "chats self all" ON public.conversations RENAME TO "conversations self all";
ALTER POLICY "chat_documents self all" ON public.conversation_documents RENAME TO "conversation_documents self all";