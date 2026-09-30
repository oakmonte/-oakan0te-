-- Step 1 of 2 for app-level encryption (POSTPONED.md §1.5). Apply BEFORE
-- deploying the code that encrypts.
--
-- Message bodies, third-party tokens and payout account numbers are now
-- encrypted by the app before they are written (src/lib/field-encryption.server.ts,
-- AES-256-GCM, key in DATA_ENCRYPTION_KEY). Not end-to-end: the server holds the
-- key. What changes is that the database — dashboard, SQL editor, backups,
-- Realtime payloads — only ever sees `enc:v1:...` ciphertext.
--
-- This step only lifts the length limits written for plaintext: a 4000-character
-- message is up to ~21k characters once encrypted and base64'd, so the old
-- check would reject long messages the moment the new code ships. The 4000 cap
-- is enforced on the plaintext by the api.chat.* / api.support-messages.*
-- routes instead. A looser ceiling stays here so the column can't be used to
-- store something unbounded. Works with both the old and the new code.
--
-- Step 2, 20260930130000_require_encrypted_columns.sql, refuses plaintext —
-- apply it only after the deploy AND the backfill.
--
-- Guarded because the direct-messages tables may not be applied on every
-- database yet (POSTPONED §1.4). Their migrations sort earlier, so on a fresh
-- database they exist by the time this runs.

-- Drops the CHECK constraints that constrain `col` alone — the auto-named
-- plaintext length checks — without touching multi-column ones such as
-- messages_has_content, and without depending on the auto-generated name.
create or replace function pg_temp.drop_single_column_checks(tbl regclass, col text)
returns void
language plpgsql
as $$
declare
  c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_attribute att on att.attrelid = con.conrelid and att.attname = col
    where con.conrelid = tbl
      and con.contype = 'c'
      and con.conkey = array[att.attnum]
  loop
    execute format('alter table %s drop constraint %I', tbl, c.conname);
  end loop;
end;
$$;

do $$
begin
  if to_regclass('public.messages') is not null then
    perform pg_temp.drop_single_column_checks('public.messages', 'body');
    alter table public.messages
      add constraint messages_body_length
      check (body is null or char_length(body) <= 24000);
  end if;

  if to_regclass('public.support_messages') is not null then
    perform pg_temp.drop_single_column_checks('public.support_messages', 'body');
    alter table public.support_messages
      add constraint support_messages_body_length
      check (char_length(trim(body)) between 1 and 24000);
  end if;
end;
$$;
