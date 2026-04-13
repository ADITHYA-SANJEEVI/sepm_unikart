create or replace function public.app_create_listing(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.listings (
    seller_profile_id,
    title,
    description,
    price,
    inventory_count,
    currency,
    category,
    condition,
    status,
    mode,
    negotiable,
    fulfillment_modes,
    area,
    campus_id,
    image_urls,
    tags,
    rent_details,
    bundle_details,
    listing_metadata,
    completeness_score
  )
  values (
    (p_payload->>'sellerProfileId')::uuid,
    p_payload->>'title',
    p_payload->>'description',
    coalesce((p_payload->>'price')::numeric, 0),
    coalesce((p_payload->>'inventoryCount')::integer, 1),
    coalesce(p_payload->>'currency', 'INR'),
    p_payload->>'category',
    p_payload->>'condition',
    coalesce(p_payload->>'status', 'active'),
    coalesce(p_payload->>'mode', 'sale'),
    coalesce((p_payload->>'negotiable')::boolean, false),
    coalesce(p_payload->'fulfillmentModes', '[]'::jsonb),
    p_payload->>'area',
    coalesce(p_payload->>'campusId', 'srm-ktr'),
    coalesce(p_payload->'imageUrls', '[]'::jsonb),
    coalesce(p_payload->'tags', '[]'::jsonb),
    p_payload->'rentDetails',
    p_payload->'bundleDetails',
    coalesce(p_payload->'listingMetadata', '{}'::jsonb),
    coalesce((p_payload->>'completenessScore')::integer, 45)
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.app_update_listing(p_listing_id uuid, p_patch jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  update public.listings
  set
    title = coalesce(p_patch->>'title', title),
    description = coalesce(p_patch->>'description', description),
    price = coalesce((p_patch->>'price')::numeric, price),
    inventory_count = coalesce((p_patch->>'inventoryCount')::integer, inventory_count),
    category = coalesce(p_patch->>'category', category),
    condition = coalesce(p_patch->>'condition', condition),
    status = coalesce(p_patch->>'status', status),
    mode = coalesce(p_patch->>'mode', mode),
    negotiable = coalesce((p_patch->>'negotiable')::boolean, negotiable),
    fulfillment_modes = coalesce(p_patch->'fulfillmentModes', fulfillment_modes),
    area = coalesce(p_patch->>'area', area),
    image_urls = coalesce(p_patch->'imageUrls', image_urls),
    tags = coalesce(p_patch->'tags', tags),
    rent_details = case when p_patch ? 'rentDetails' then p_patch->'rentDetails' else rent_details end,
    bundle_details = case when p_patch ? 'bundleDetails' then p_patch->'bundleDetails' else bundle_details end,
    listing_metadata = coalesce(p_patch->'listingMetadata', listing_metadata),
    updated_at = now()
  where id = p_listing_id
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.app_create_listing(jsonb) to service_role;
grant execute on function public.app_update_listing(uuid, jsonb) to service_role;

create or replace function public.app_create_listing_text(p_payload_text text)
returns uuid
language sql
security definer
set search_path = public
as $$
  select public.app_create_listing(p_payload_text::jsonb);
$$;

create or replace function public.app_update_listing_text(p_listing_id uuid, p_patch_text text)
returns uuid
language sql
security definer
set search_path = public
as $$
  select public.app_update_listing(p_listing_id, p_patch_text::jsonb);
$$;

grant execute on function public.app_create_listing_text(text) to service_role;
grant execute on function public.app_update_listing_text(uuid, text) to service_role;
