alter table public.user_notifications
  drop constraint if exists user_notifications_type_check;

alter table public.user_notifications
  add constraint user_notifications_type_check
  check (
    type in (
      'listing_sold',
      'listing_updated',
      'listing_deleted',
      'saved_search_match',
      'listing_moderated',
      'hold_requested',
      'offer_received',
      'system'
    )
  );
