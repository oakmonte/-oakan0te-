-- Follow-ups to add_direct_messages from the security advisor and review:
-- trigger functions aren't RPCs, the storage path helper pins its
-- search_path, and a block stops reactions as well as messages.
revoke execute on function public.messages_after_insert() from public, anon, authenticated;
revoke execute on function public.message_reactions_set_conversation() from public, anon, authenticated;

alter function public.chat_media_conversation(text) set search_path = '';

drop policy "Members react as themselves" on public.message_reactions;
create policy "Members react as themselves"
  on public.message_reactions for insert
  with check (
    user_id = auth.uid()
    and public.is_conversation_member(conversation_id)
    and not public.is_conversation_blocked(conversation_id)
  );

drop policy "Members change their own reaction" on public.message_reactions;
create policy "Members change their own reaction"
  on public.message_reactions for update
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and public.is_conversation_member(conversation_id)
    and not public.is_conversation_blocked(conversation_id)
  );
