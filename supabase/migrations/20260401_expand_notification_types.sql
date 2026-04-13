alter table public.user_notifications
  drop constraint if exists user_notifications_type_check;

alter table public.user_notifications
  add constraint user_notifications_type_check
  check (
    type = any (
      array[
        'listing_sold'::text,
        'listing_updated'::text,
        'listing_deleted'::text,
        'saved_search_match'::text,
        'listing_moderated'::text,
        'message_received'::text,
        'schedule_updated'::text,
        'hold_updated'::text,
        'offer_updated'::text,
        'hold_requested'::text,
        'offer_received'::text,
        'system'::text
      ]
    )
  );
