import { randomUUID } from "node:crypto";

import { env } from "../config/env";
import { getSupabaseAdminClient } from "../lib/supabase";
import type { AuthUser } from "../types/auth";
import type {
  PlatformAnalyticsSummary,
  Cart,
  CompareQueueItem,
  Conversation,
  DashboardSummary,
  DeliverySchedule,
  Listing,
  ListingHold,
  ListingMediaAsset,
  Message,
  MediaUploadTicket,
  NotificationInbox,
  NotificationInboxGroup,
  NotificationInboxSection,
  ModerationAction,
  NegotiationOffer,
  PolicyArticle,
  Profile,
  PublicProfile,
  Report,
  SavedFilter,
  SellerAnalyticsSummary,
  AiDiagnosticsSummary,
  AiProviderEvent,
  UserAnalyticsSummary,
  AdminAnalyticsSummary,
  UserNotification,
} from "../types/marketplace";
import {
  addModerationAction as addModerationActionInMemory,
  blockUser as blockUserInMemory,
  createListing as createListingInMemory,
  createSchedule as createScheduleInMemory,
  deleteListing as deleteListingInMemory,
  ensureProfileForAuthUser as ensureProfileForAuthUserInMemory,
  favoriteListing as favoriteListingInMemory,
  getListingById as getListingByIdInMemory,
  getReportById as getReportByIdInMemory,
  getSellerProfileForListing as getSellerProfileForListingInMemory,
  listBlocks as listBlocksInMemory,
  listConversations as listConversationsInMemory,
  listFavoriteListings as listFavoriteListingsInMemory,
  listListings as listListingsInMemory,
  listMessagesForListing as listMessagesForListingInMemory,
  listModerationActions as listModerationActionsInMemory,
  listOwnListings as listOwnListingsInMemory,
  listReports as listReportsInMemory,
  listSchedules as listSchedulesInMemory,
  reportListing as reportListingInMemory,
  sendMessageToListing as sendMessageToListingInMemory,
  unfavoriteListing as unfavoriteListingInMemory,
  updateScheduleStatus as updateScheduleStatusInMemory,
  updateListing as updateListingInMemory,
} from "../data/store";

interface ListingFilters {
  search?: string;
  category?: string;
  condition?: string;
  status?: string;
  mode?: "sale" | "rent" | "bundle";
  minPrice?: number;
  maxPrice?: number;
  deliveryAvailable?: boolean;
  negotiableOnly?: boolean;
  limit?: number;
  sort?: "newest" | "price_asc" | "price_desc" | "trust_desc";
}

const PUBLIC_LISTING_STATUSES = ["active", "reserved", "sold"] as const;
const NON_PUBLIC_LISTING_STATUSES = ["draft", "hidden", "suspended"] as const;

interface ListingWriteInput {
  title: string;
  description: string;
  price: number;
  inventoryCount?: number;
  category: any;
  condition: any;
  negotiable: boolean;
  fulfillmentModes: any[];
  area: string;
  imageUrls: string[];
  mediaAssetIds?: string[];
  tags: string[];
  status?: any;
  mode?: "sale" | "rent" | "bundle";
  rentDetails?: Record<string, unknown>;
  bundleDetails?: Record<string, unknown>;
  listingMetadata?: Record<string, unknown>;
}

interface CartView {
  cart: Cart;
  items: Array<{
    id: string;
    quantity: number;
    listing: Listing | null;
  }>;
  totalAmount: number;
  sellerBreakdown: Array<{ seller: string; total: number; count: number }>;
}

interface ConversationView extends Conversation {
  listingTitle: string;
  listing?: Listing | null;
  participant: PublicProfile | null;
  lastMessage: (Message & { sender: PublicProfile | null }) | null;
  unreadCount?: number;
  safetyReminder: string;
}

interface ScheduleView extends DeliverySchedule {
  listingTitle: string;
  listing?: Listing | null;
  buyer: PublicProfile | null;
  seller: PublicProfile | null;
  safetyChecklist: string[];
}

interface ConversationWorkspaceView {
  listing: Listing | null;
  conversation: ConversationView | null;
  messages: Array<Message & { sender: PublicProfile | null }>;
  offers: NegotiationOffer[];
  schedules: ScheduleView[];
}

const policyArticles: PolicyArticle[] = [
  {
    id: "safe-meetups",
    category: "meetups",
    title: "Safe Meetups on Campus",
    summary: "Prefer public SRM KTR locations, inspect items first, and avoid isolated exchanges.",
    body: [
      "Meet in public campus areas such as library-side zones, academic blocks, or known hostel common points.",
      "Inspect the item before making full payment whenever possible.",
      "Do not share unnecessary personal details or exact room locations.",
    ],
  },
  {
    id: "payment-caution",
    category: "payments",
    title: "Payment Caution",
    summary: "Avoid pressure-heavy advance payment requests and keep proof of every transaction step.",
    body: [
      "Be cautious if a seller asks for urgent advance payment before verification.",
      "Use on-platform context and documented chat before agreeing to any transfer.",
      "Report suspicious payment requests immediately.",
    ],
  },
  {
    id: "prohibited-items",
    category: "policy",
    title: "Prohibited Items",
    summary: "Illegal goods, stolen items, substances, weapons, and harmful products are not allowed.",
    body: [
      "Listings that violate campus policy or law are prohibited.",
      "Impersonation, harassment, and fake product representation are moderation priorities.",
      "Repeated policy violations may lead to listing suspension or account bans.",
    ],
  },
];

const fallbackCarts = new Map<string, { cart: Cart; items: Array<{ id: string; listingId: string; quantity: number; createdAt: string }> }>();
const fallbackCompareQueues = new Map<string, Array<{ id: string; profileId: string; listingId: string; createdAt: string }>>();
const listingCache = new Map<string, { expiresAt: number; data: Listing[] }>();
const listingDetailCache = new Map<string, { expiresAt: number; data: Listing | null }>();
const publicProfileCache = new Map<string, { expiresAt: number; data: PublicProfile | null }>();
const authProfileCache = new Map<string, { expiresAt: number; data: Profile }>();
const CACHE_TTL_MS = 120000;
const CART_QUERY_TIMEOUT_MS = 2500;
const NOTIFICATION_DEDUPE_WINDOW_HOURS = 6;
const LISTING_MEDIA_BUCKET = "listing-media";
const LISTING_SELLER_SUMMARY_SELECT = [
  "id",
  "full_name",
  "campus_id",
  "is_verified",
  "joined_at",
  "response_reliability",
  "avatar_url",
  "profile_completeness",
  "trust_badges",
].join(",");
const LISTING_SELLER_DETAIL_SELECT = [
  "id",
  "full_name",
  "campus_id",
  "is_verified",
  "joined_at",
  "response_reliability",
  "avatar_url",
  "bio",
  "hostel",
  "department",
  "seller_headline",
  "preferred_meetup_spot",
  "profile_completeness",
  "trust_badges",
  "setup_completed",
].join(",");
const LISTING_SUMMARY_SELECT = [
  "id",
  "seller_profile_id",
  "title",
  "description",
  "price",
  "inventory_count",
  "currency",
  "category",
  "condition",
  "status",
  "mode",
  "negotiable",
  "fulfillment_modes",
  "area",
  "campus_id",
  "image_urls",
  "tags",
  "trust_score",
  "completeness_score",
  "created_at",
  "updated_at",
  `seller_profile:profiles!listings_seller_profile_id_fkey(${LISTING_SELLER_SUMMARY_SELECT})`,
].join(",");
const LISTING_DETAIL_SELECT = [
  "id",
  "seller_profile_id",
  "title",
  "description",
  "price",
  "inventory_count",
  "currency",
  "category",
  "condition",
  "status",
  "mode",
  "negotiable",
  "fulfillment_modes",
  "area",
  "campus_id",
  "image_urls",
  "tags",
  "rent_details",
  "bundle_details",
  "listing_metadata",
  "trust_score",
  "completeness_score",
  "created_at",
  "updated_at",
  `seller_profile:profiles!listings_seller_profile_id_fkey(${LISTING_SELLER_DETAIL_SELECT})`,
].join(",");
const LISTING_MEDIA_ASSET_SELECT = [
  "id",
  "owner_profile_id",
  "listing_id",
  "bucket_id",
  "object_path",
  "public_url",
  "media_kind",
  "mime_type",
  "file_size_bytes",
  "width",
  "height",
  "duration_seconds",
  "sort_order",
  "upload_status",
  "original_filename",
  "checksum",
  "created_at",
  "updated_at",
].join(",");
let cartPersistenceDisabled = false;

function describeError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unknown error";
}

function disableCartPersistence(operation: string, error?: unknown) {
  if (!cartPersistenceDisabled) {
    const reason = error ? ` ${describeError(error)}` : "";
    console.warn(`[cart] disabling Supabase cart persistence after ${operation}.${reason}`);
  }
  cartPersistenceDisabled = true;
}

function getFallbackCartState(profileId: string, seedCart?: Cart) {
  const existing = fallbackCarts.get(profileId);
  if (existing) return existing;

  const cart =
    seedCart ??
    ({
      id: `cart-${randomUUID()}`,
      profileId,
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } satisfies Cart);

  const localState = { cart, items: [] as Array<{ id: string; listingId: string; quantity: number; createdAt: string }> };
  fallbackCarts.set(profileId, localState);
  return localState;
}

function getCartSupabaseClient() {
  if (cartPersistenceDisabled) {
    return null;
  }
  return getSupabaseAdminClient();
}

async function runCartSupabaseQuery<T>(operation: string, query: () => PromiseLike<T>): Promise<T | null> {
  if (!getCartSupabaseClient()) {
    return null;
  }

  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      query(),
      new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(new Error(`Cart Supabase query timed out after ${CART_QUERY_TIMEOUT_MS}ms`));
        }, CART_QUERY_TIMEOUT_MS);
      }),
    ]);
  } catch (error) {
    disableCartPersistence(operation, error);
    return null;
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}

function mapCompareQueueRow(row: any): CompareQueueItem {
  return {
    id: row.id,
    profileId: row.profile_id,
    listingId: row.listing_id,
    createdAt: row.created_at,
  };
}

function mapMediaAssetRow(row: any): ListingMediaAsset {
  return {
    id: row.id,
    ownerProfileId: row.owner_profile_id,
    listingId: row.listing_id,
    bucketId: row.bucket_id,
    objectPath: row.object_path,
    publicUrl: row.public_url,
    mediaKind: row.media_kind,
    mimeType: row.mime_type,
    fileSizeBytes: row.file_size_bytes,
    width: row.width,
    height: row.height,
    durationSeconds: row.duration_seconds,
    sortOrder: row.sort_order ?? 0,
    uploadStatus: row.upload_status,
    originalFilename: row.original_filename,
    checksum: row.checksum,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAiProviderEventRow(row: any): AiProviderEvent {
  return {
    id: row.id,
    provider: row.provider,
    operation: row.operation,
    model: row.model,
    status: row.status,
    usedFallback: !!row.used_fallback,
    httpStatus: row.http_status,
    latencyMs: row.latency_ms,
    subjectType: row.subject_type,
    subjectId: row.subject_id,
    errorMessage: row.error_message,
    requestMeta: row.request_meta ?? {},
    responseMeta: row.response_meta ?? {},
    createdAt: row.created_at,
  };
}

function slugifyFilenameSegment(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "asset";
}

function guessFileExtension(filename: string, mimeType: string) {
  const explicit = filename.split(".").pop()?.trim().toLowerCase();
  if (explicit && explicit.length <= 8 && !explicit.includes("/")) {
    return explicit;
  }
  if (mimeType.includes("jpeg")) return "jpg";
  if (mimeType.includes("png")) return "png";
  if (mimeType.includes("webp")) return "webp";
  if (mimeType.includes("heic")) return "heic";
  if (mimeType.includes("quicktime")) return "mov";
  if (mimeType.includes("webm")) return "webm";
  if (mimeType.includes("mp4")) return "mp4";
  return "bin";
}

function buildStoragePublicUrl(bucketId: string, objectPath: string) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return objectPath;
  const { data } = supabase.storage.from(bucketId).getPublicUrl(objectPath);
  return data.publicUrl;
}

async function getReadyMediaAssetMapForListings(listingIds: string[]) {
  const supabase = getSupabaseAdminClient();
  if (!supabase || !listingIds.length) return new Map<string, ListingMediaAsset[]>();

  const { data, error } = await supabase
    .from("listing_media_assets")
    .select(LISTING_MEDIA_ASSET_SELECT)
    .in("listing_id", [...new Set(listingIds)])
    .in("upload_status", ["uploaded", "ready"])
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    throw createServiceError("Failed to load listing media assets from Supabase.", error);
  }

  const map = new Map<string, ListingMediaAsset[]>();
  for (const row of data ?? []) {
    const asset = mapMediaAssetRow(row);
    const bucket = map.get(asset.listingId || "") ?? [];
    bucket.push(asset);
    map.set(asset.listingId || "", bucket);
  }
  return map;
}

async function attachMediaToListings(listings: Listing[]): Promise<Listing[]> {
  if (!listings.length) return listings;
  const mediaMap = await getReadyMediaAssetMapForListings(listings.map((listing) => listing.id));
  return listings.map((listing) => {
    const assets = mediaMap.get(listing.id) ?? [];
    if (!assets.length) return listing;
    return {
      ...listing,
      mediaAssets: assets,
      imageUrls: assets.map((asset) => asset.publicUrl),
    };
  });
}

async function getFavoriteListingIdsForProfile(
  profileId: string | undefined,
  listingIds: string[],
) {
  if (!profileId || !listingIds.length) {
    return new Set<string>();
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return new Set<string>();
  }

  const { data, error } = await supabase
    .from("favorites")
    .select("listing_id")
    .eq("profile_id", profileId)
    .in("listing_id", [...new Set(listingIds)]);

  if (error) {
    throw createServiceError("Failed to load favorite listings for the current view.", error);
  }

  return new Set((data ?? []).map((favorite: any) => favorite.listing_id));
}

function buildNotificationDedupKey(notification: {
  profileId: string;
  type: UserNotification["type"];
  entityId?: string | null;
  title: string;
  metadata?: Record<string, unknown>;
}) {
  const metadataKey =
    notification.type === "saved_search_match"
      ? String(notification.metadata?.filterId ?? "")
      : notification.type === "message_received"
        ? String(notification.metadata?.messageId ?? "")
        : notification.type === "schedule_updated"
          ? `${notification.metadata?.scheduleId ?? ""}:${notification.metadata?.status ?? ""}:${notification.metadata?.confirmedTime ?? ""}`
          : notification.type === "hold_updated"
            ? `${notification.metadata?.holdId ?? ""}:${notification.metadata?.status ?? ""}`
            : notification.type === "offer_received" || notification.type === "offer_updated"
              ? `${notification.metadata?.offerId ?? ""}:${notification.metadata?.status ?? ""}:${notification.metadata?.amount ?? ""}`
              : notification.type === "listing_updated"
                ? `${notification.metadata?.previousPrice ?? ""}:${notification.metadata?.nextPrice ?? ""}`
                : "";
  return [notification.profileId, notification.type, notification.entityId ?? "", metadataKey, notification.title].join("|");
}

function filterSelfNotifications<T extends { profileId: string }>(profileId: string, notifications: T[]): T[] {
  return notifications.filter((notification) => notification.profileId && notification.profileId !== profileId);
}

function createServiceError(message: string, details?: unknown) {
  const error = new Error(
    details
      ? `${message} ${
          typeof details === "object" && details !== null && "message" in details
            ? String((details as { message?: unknown }).message)
            : ""
        }`.trim()
      : message,
  ) as Error & { statusCode?: number };
  error.statusCode = 500;
  return error;
}

function readCache<T>(cache: Map<string, { expiresAt: number; data: T }>, key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function writeCache<T>(cache: Map<string, { expiresAt: number; data: T }>, key: string, data: T) {
  cache.set(key, {
    data,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

function readNullableCache<T>(cache: Map<string, { expiresAt: number; data: T }>, key: string) {
  const entry = cache.get(key);
  if (!entry) return { hit: false, data: null as T | null };
  if (entry.expiresAt < Date.now()) {
    cache.delete(key);
    return { hit: false, data: null as T | null };
  }
  return { hit: true, data: entry.data };
}

function invalidateListingCaches() {
  listingCache.clear();
  listingDetailCache.clear();
  publicProfileCache.clear();
}

function invalidateProfileCaches(profileId?: string) {
  if (profileId) {
    publicProfileCache.delete(profileId);
    authProfileCache.clear();
    return;
  }
  publicProfileCache.clear();
  authProfileCache.clear();
}

function toPublicProfile(profile: Profile, listingCount = 0): PublicProfile {
  return {
    id: profile.id,
    fullName: profile.fullName,
    campusId: profile.campusId,
    isVerified: profile.isVerified,
    joinedAt: profile.joinedAt,
    listingCount,
    responseReliability: profile.responseReliability,
    profileCompleteness: (profile as any).profileCompleteness ?? 40,
    trustBadges: (profile as any).trustBadges ?? [],
    avatarUrl: (profile as any).avatarUrl ?? null,
    bio: (profile as any).bio ?? null,
    contactNumber: (profile as any).contactNumber ?? null,
    hostel: (profile as any).hostel ?? null,
    department: (profile as any).department ?? null,
    sellerHeadline: (profile as any).sellerHeadline ?? null,
    preferredMeetupSpot: (profile as any).preferredMeetupSpot ?? null,
    favoriteCategories: (profile as any).favoriteCategories ?? [],
    setupCompleted: (profile as any).setupCompleted ?? false,
  };
}

function mapNotificationRow(row: any): UserNotification {
  return {
    id: row.id,
    profileId: row.profile_id,
    type: row.type,
    category: row.category ?? inferNotificationCategory(row.type),
    priority: row.priority ?? inferNotificationPriority(row.type),
    title: row.title,
    body: row.body,
    entityType: row.entity_type,
    entityId: row.entity_id,
    metadata: row.metadata ?? {},
    actionLabel: row.action_label ?? null,
    actionHref: row.action_href ?? null,
    readAt: row.read_at,
    dismissedAt: row.dismissed_at,
    createdAt: row.created_at,
  };
}

function inferNotificationCategory(type: UserNotification["type"]): NonNullable<UserNotification["category"]> {
  switch (type) {
    case "listing_sold":
    case "listing_updated":
    case "listing_deleted":
    case "saved_search_match":
    case "schedule_updated":
    case "hold_updated":
      return "buying";
    case "message_received":
    case "hold_requested":
    case "offer_received":
    case "offer_updated":
      return "selling";
    case "listing_moderated":
      return "admin";
    case "system":
    default:
      return "system";
  }
}

function inferNotificationPriority(type: UserNotification["type"]): NonNullable<UserNotification["priority"]> {
  switch (type) {
    case "listing_sold":
    case "listing_deleted":
    case "listing_moderated":
    case "hold_requested":
    case "offer_received":
    case "schedule_updated":
      return "high";
    case "message_received":
    case "hold_updated":
    case "offer_updated":
    case "saved_search_match":
    case "listing_updated":
      return "medium";
    case "system":
    default:
      return "low";
  }
}

function normalizeNotificationForInbox(notification: UserNotification): UserNotification {
  const metadata = notification.metadata ?? {};
  const listingThreadHref = metadata.listingId ? `/messages?listingId=${metadata.listingId}` : null;
  return {
    ...notification,
    actionLabel:
      notification.actionLabel ??
      (notification.type === "message_received"
        ? "Reply"
        : notification.type === "schedule_updated"
          ? "Review meetup"
          : notification.type === "hold_requested" || notification.type === "hold_updated"
            ? "Review hold"
            : notification.type === "offer_received" || notification.type === "offer_updated"
              ? "Review offer"
              : notification.type === "saved_search_match"
                ? "View match"
                : notification.type === "listing_moderated"
                  ? "Open moderation"
                  : "Open"),
    actionHref:
      notification.actionHref ??
      (notification.entityType === "conversation" && notification.entityId
        ? listingThreadHref ?? "/messages"
        : notification.entityType === "schedule" && notification.entityId
          ? listingThreadHref ?? `/schedules`
          : notification.entityType === "offer" && notification.entityId
            ? listingThreadHref ?? "/messages"
            : notification.entityType === "listing" && notification.entityId
              ? `/listings/${notification.entityId}`
              : notification.type === "listing_moderated" && notification.entityId
                ? `/moderation?listing=${notification.entityId}`
                : null),
    metadata: {
      ...metadata,
      roleLane: notification.category ?? inferNotificationCategory(notification.type),
      attentionLevel: notification.priority ?? inferNotificationPriority(notification.type),
    },
  };
}

export function buildNotificationInbox(notifications: UserNotification[]): NotificationInbox {
  const normalized = notifications.map(normalizeNotificationForInbox);
  const recentCutoff = Date.now() - 24 * 60 * 60 * 1000;
  const actionTypes = new Set<UserNotification["type"]>([
    "message_received",
    "schedule_updated",
    "hold_requested",
    "hold_updated",
    "offer_received",
    "offer_updated",
    "listing_moderated",
    "saved_search_match",
  ]);

  function groupNotifications(items: UserNotification[]): NotificationInboxGroup[] {
    const groupMap = new Map<string, UserNotification[]>();
    for (const item of items) {
      const metadata = item.metadata ?? {};
      const entityKey =
        item.type === "saved_search_match"
          ? `filter:${metadata.filterId ?? item.entityId ?? item.id}`
          : item.entityType && item.entityId
            ? `${item.entityType}:${item.entityId}`
            : `${item.type}:${item.id}`;
      const groupKey = `${item.category ?? inferNotificationCategory(item.type)}:${item.type}:${entityKey}`;
      const bucket = groupMap.get(groupKey) ?? [];
      bucket.push(item);
      groupMap.set(groupKey, bucket);
    }

    return [...groupMap.entries()]
      .map(([key, groupItems]) => {
        const sorted = [...groupItems].sort((left, right) => +new Date(right.createdAt) - +new Date(left.createdAt));
        const lead = sorted[0];
        const unreadCount = sorted.filter((item) => !item.readAt).length;
        const metadata = lead.metadata ?? {};
        const lane = lead.category ?? inferNotificationCategory(lead.type);

        const title =
          lead.type === "message_received"
            ? `${groupItems.length} message${groupItems.length === 1 ? "" : "s"} waiting`
            : lead.type === "saved_search_match"
              ? `${groupItems.length} match${groupItems.length === 1 ? "" : "es"} for ${String(metadata.filterLabel ?? "saved search")}`
              : lead.type === "hold_requested"
                ? `${groupItems.length} hold request${groupItems.length === 1 ? "" : "s"}`
                : lead.type === "hold_updated"
                  ? `${groupItems.length} hold update${groupItems.length === 1 ? "" : "s"}`
                  : lead.type === "offer_received"
                    ? `${groupItems.length} offer${groupItems.length === 1 ? "" : "s"} received`
                    : lead.type === "offer_updated"
                      ? `${groupItems.length} offer update${groupItems.length === 1 ? "" : "s"}`
                      : lead.type === "schedule_updated"
                        ? `${groupItems.length} meetup update${groupItems.length === 1 ? "" : "s"}`
                        : lead.title;

        const subtitle =
          typeof metadata.listingTitle === "string"
            ? metadata.listingTitle
            : typeof metadata.filterLabel === "string"
              ? metadata.filterLabel
              : lead.body;

        return {
          key,
          category: lane,
          priority: lead.priority ?? inferNotificationPriority(lead.type),
          title,
          subtitle,
          count: groupItems.length,
          unreadCount,
          latestAt: lead.createdAt,
          actionLabel: lead.actionLabel ?? null,
          actionHref: lead.actionHref ?? null,
          notificationIds: sorted.map((item) => item.id),
        } satisfies NotificationInboxGroup;
      })
      .sort((left, right) => +new Date(right.latestAt) - +new Date(left.latestAt));
  }

  function toSection(items: UserNotification[]): NotificationInboxSection {
    return {
      needsAction: items.filter((item) => !item.readAt && (actionTypes.has(item.type) || item.priority === "high")),
      recent: items.filter((item) => {
        const createdAt = new Date(item.createdAt).getTime();
        return !!item.readAt || createdAt >= recentCutoff;
      }),
      earlier: items.filter((item) => {
        const createdAt = new Date(item.createdAt).getTime();
        return !item.readAt && createdAt < recentCutoff;
      }),
      grouped: groupNotifications(items),
    };
  }

  const buying = normalized.filter((item) => item.category === "buying");
  const selling = normalized.filter((item) => item.category === "selling");
  const safety = normalized.filter((item) => item.category === "safety");
  const system = normalized.filter((item) => item.category === "system");
  const admin = normalized.filter((item) => item.category === "admin");

  return {
    all: toSection(normalized),
    buying: toSection(buying),
    selling: toSection(selling),
    safety: toSection(safety),
    system: toSection(system),
    admin: toSection(admin),
    highlights: ([
      { lane: "buying", title: "Buying", count: buying.length, unreadCount: buying.filter((item) => !item.readAt).length },
      { lane: "selling", title: "Selling", count: selling.length, unreadCount: selling.filter((item) => !item.readAt).length },
      { lane: "safety", title: "Safety", count: safety.length, unreadCount: safety.filter((item) => !item.readAt).length },
      { lane: "system", title: "System", count: system.length, unreadCount: system.filter((item) => !item.readAt).length },
      { lane: "admin", title: "Admin", count: admin.length, unreadCount: admin.filter((item) => !item.readAt).length },
    ] as const).filter((item) => item.count > 0 || item.unreadCount > 0),
    counts: {
      all: normalized.length,
      buying: buying.length,
      selling: selling.length,
      safety: safety.length,
      system: system.length,
      admin: admin.length,
      unread: normalized.filter((item) => !item.readAt).length,
    },
  };
}

function normalizeFilterPayload(payload: Record<string, unknown>) {
  return {
    search: String(payload.search ?? "").trim().toLowerCase(),
    category: String(payload.category ?? "").trim(),
    condition: String(payload.condition ?? "").trim(),
    mode: String(payload.mode ?? "").trim(),
    minPrice: Number(payload.minPrice ?? 0) || 0,
    maxPrice: Number(payload.maxPrice ?? 0) || 0,
    deliveryOnly: Boolean(payload.deliveryOnly ?? payload.deliveryAvailable ?? false),
    negotiableOnly: Boolean(payload.negotiableOnly ?? false),
  };
}

function listingMatchesFilterPayload(listing: Listing, payload: Record<string, unknown>) {
  const normalized = normalizeFilterPayload(payload);
  const haystack = `${listing.title} ${listing.description} ${(listing.tags || []).join(" ")}`.toLowerCase();

  if (normalized.search && !haystack.includes(normalized.search)) return false;
  if (normalized.category && listing.category !== normalized.category) return false;
  if (normalized.condition && listing.condition !== normalized.condition) return false;
  if (normalized.mode && (listing.mode ?? "sale") !== normalized.mode) return false;
  if (normalized.minPrice && Number(listing.price || 0) < normalized.minPrice) return false;
  if (normalized.maxPrice && Number(listing.price || 0) > normalized.maxPrice) return false;
  if (normalized.deliveryOnly && !(listing.fulfillmentModes || []).includes("campus-drop" as any)) return false;
  if (normalized.negotiableOnly && !listing.negotiable) return false;
  return true;
}

function mapProfileRecord(row: any): Profile {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    campusId: row.campus_id,
    isVerified: row.is_verified,
    joinedAt: row.joined_at,
    responseReliability: row.response_reliability,
    avatarUrl: row.avatar_url,
    bio: row.bio,
    contactNumber: row.contact_number,
    hostel: row.hostel,
    department: row.department,
    sellerHeadline: row.seller_headline,
    preferredMeetupSpot: row.preferred_meetup_spot,
    favoriteCategories: row.favorite_categories ?? [],
    notificationPreferences: row.notification_preferences ?? {
      buying: true,
      selling: true,
      safety: true,
      system: true,
      savedSearchAlerts: true,
    },
    profileCompleteness: row.profile_completeness,
    trustBadges: row.trust_badges ?? [],
    setupCompleted: row.setup_completed,
  };
}

function computeListingCompleteness(input: Pick<Listing, "title" | "description" | "imageUrls" | "tags" | "area">) {
  let score = 35;
  if (input.title.trim().length >= 12) score += 15;
  if (input.description.trim().length >= 80) score += 20;
  if (input.imageUrls.length >= 1) score += 10;
  if (input.imageUrls.length >= 3) score += 5;
  if (input.tags.length >= 3) score += 10;
  if (input.area.trim().length >= 4) score += 5;
  return Math.min(score, 100);
}

function buildSellerBreakdown(items: Array<{ listing: Listing | null; quantity: number }>) {
  const bySeller = new Map<string, { seller: string; total: number; count: number }>();
  for (const item of items) {
    const seller = item.listing?.seller?.fullName || "Unknown Seller";
    const total = (item.listing?.price || 0) * item.quantity;
    const current = bySeller.get(seller) || { seller, total: 0, count: 0 };
    current.total += total;
    current.count += item.quantity;
    bySeller.set(seller, current);
  }
  return [...bySeller.values()].sort((a, b) => b.total - a.total);
}

function isInlineMediaUrl(value: unknown) {
  return typeof value === "string" && value.trim().toLowerCase().startsWith("data:");
}

function toCartListingSnapshot(listing: Listing | null): Listing | null {
  if (!listing) return null;

  const thumbUrl =
    listing.mediaAssets?.find((item) => typeof item?.publicUrl === "string" && !isInlineMediaUrl(item.publicUrl))?.publicUrl ||
    listing.imageUrls?.find((url) => !isInlineMediaUrl(url)) ||
    "";

  return {
    ...listing,
    description: "",
    imageUrls: thumbUrl ? [thumbUrl] : [],
    mediaAssets: thumbUrl
      ? [
          {
            id: `cart-thumb-${listing.id}`,
            ownerProfileId: listing.sellerProfileId,
            listingId: listing.id,
            bucketId: "cart-thumb",
            objectPath: thumbUrl,
            publicUrl: thumbUrl,
            mediaKind: "image",
            mimeType: "",
            fileSizeBytes: 0,
            width: undefined,
            height: undefined,
            durationSeconds: undefined,
            sortOrder: 0,
            uploadStatus: "ready",
            originalFilename: "",
            checksum: "",
            createdAt: listing.updatedAt,
            updatedAt: listing.updatedAt,
          },
        ]
      : [],
  };
}

function mapHoldRow(row: any): ListingHold {
  return {
    id: row.id,
    listingId: row.listing_id,
    conversationId: row.conversation_id,
    buyerProfileId: row.buyer_profile_id,
    sellerProfileId: row.seller_profile_id,
    status: row.status,
    note: row.note,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapOfferRow(row: any): NegotiationOffer {
  return {
    id: row.id,
    listingId: row.listing_id,
    conversationId: row.conversation_id,
    buyerProfileId: row.buyer_profile_id,
    sellerProfileId: row.seller_profile_id,
    previousOfferId: row.previous_offer_id,
    amount: Number(row.amount),
    note: row.note,
    kind: row.kind,
    status: row.status,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMeetupLocation(input: any): DeliverySchedule["meetupLocation"] {
  if (!input || typeof input !== "object" || typeof input.label !== "string") return null;
  const latitude = Number(input.latitude);
  const longitude = Number(input.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  return {
    label: normalizeCampusText(input.label),
    latitude,
    longitude,
    campusId: input.campusId || "srm-ktr",
    zoneId: input.zoneId ?? null,
    zoneLabel: input.zoneLabel ?? null,
    placeType: input.placeType === "custom_pin" ? "custom_pin" : "campus_zone",
    addressHint: input.addressHint ? normalizeCampusText(input.addressHint) : null,
  };
}

function normalizeCampusText(input: string) {
  return String(input || "")
    .replace(/\btp\b/gi, "Tech Park")
    .replace(/\btp gate\b/gi, "Tech Park Gate")
    .replace(/\blib\b/gi, "Library")
    .replace(/\bfc\b/gi, "Food Court")
    .replace(/\badmin\b/gi, "Admin Block")
    .replace(/\bhs\b/gi, "Hostel Square")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function normalizeScheduleStatus(status: any): DeliverySchedule["status"] {
  if (status === "accepted") return "confirmed";
  if (status === "requested") return "proposed";
  if (status === "reschedule_requested") return "reschedule_requested";
  if (status === "completed") return "completed";
  if (status === "cancelled") return "cancelled";
  return "proposed";
}

function isFutureScheduleTime(value?: string | null) {
  if (!value) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp > Date.now();
}

function mapMeetupRoute(input: any): DeliverySchedule["meetupRoute"] {
  if (!input || typeof input !== "object") return null;
  const durationMinutes = Number(input.durationMinutes);
  const distanceMeters = Number(input.distanceMeters);
  const originLatitude = Number(input.originLatitude);
  const originLongitude = Number(input.originLongitude);
  const destinationLatitude = Number(input.destinationLatitude);
  const destinationLongitude = Number(input.destinationLongitude);
  if (
    !Number.isFinite(durationMinutes) ||
    !Number.isFinite(distanceMeters) ||
    !Number.isFinite(originLatitude) ||
    !Number.isFinite(originLongitude) ||
    !Number.isFinite(destinationLatitude) ||
    !Number.isFinite(destinationLongitude) ||
    typeof input.originLabel !== "string" ||
    typeof input.destinationLabel !== "string" ||
    !Array.isArray(input.path)
  ) {
    return null;
  }

  const path = input.path
    .map((point: any) => {
      const latitude = Number(point?.latitude);
      const longitude = Number(point?.longitude);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
      return {
        label: typeof point?.label === "string" ? point.label : null,
        latitude,
        longitude,
        x: Number.isFinite(Number(point?.x)) ? Number(point.x) : null,
        y: Number.isFinite(Number(point?.y)) ? Number(point.y) : null,
        kind:
          point?.kind === "origin" || point?.kind === "destination" || point?.kind === "waypoint"
            ? point.kind
            : "waypoint",
      };
    })
    .filter(Boolean);

  if (path.length < 2) return null;

  return {
    provider:
      input.provider === "google_maps"
        ? "google_maps"
        : input.provider === "tomtom"
          ? "tomtom"
          : "campus_graph",
    travelMode: "walking",
    originLabel: input.originLabel,
    originLatitude,
    originLongitude,
    destinationLabel: input.destinationLabel,
    destinationLatitude,
    destinationLongitude,
    durationMinutes,
    distanceMeters,
    summary: typeof input.summary === "string" ? input.summary : null,
    computedAt: typeof input.computedAt === "string" ? input.computedAt : new Date().toISOString(),
    path,
  };
}

function computeSimilarityScore(base: Listing, candidate: Listing) {
  let score = 0;
  if (base.category === candidate.category) score += 35;
  if ((base.mode ?? "sale") === (candidate.mode ?? "sale")) score += 18;
  if (base.condition === candidate.condition) score += 12;
  const baseTags = new Set(base.tags || []);
  const candidateTags = new Set(candidate.tags || []);
  for (const tag of baseTags) {
    if (candidateTags.has(tag)) score += 6;
  }
  const basePrice = Number(base.price || 0);
  const candidatePrice = Number(candidate.price || 0);
  const delta = Math.abs(basePrice - candidatePrice);
  if (delta <= 200) score += 18;
  else if (delta <= 500) score += 10;
  else if (delta <= 1000) score += 4;
  if ((base.area || "").toLowerCase() === (candidate.area || "").toLowerCase()) score += 8;
  return score;
}

function inferMessageRiskFlags(text: string) {
  const normalized = text.toLowerCase();
  const flags: string[] = [];
  if (normalized.includes("advance") || normalized.includes("pay first")) flags.push("advance_payment_request");
  if (normalized.includes("whatsapp") || normalized.includes("outside app")) flags.push("off_platform_push");
  if (normalized.includes("urgent") || normalized.includes("immediately")) flags.push("pressure_language");
  if (/\b\d{10,13}\b/.test(normalized)) flags.push("contact_disclosure");
  if (/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(normalized)) flags.push("contact_disclosure");
  if (/(?:room|hostel|block)\s*[a-z0-9-]{1,8}/i.test(normalized)) flags.push("private_location_disclosure");
  if (/\b(?:idiot|stupid|loser|shut up|moron|bitch|bastard|fuck|fucking)\b/i.test(normalized)) flags.push("abusive_language");
  return flags;
}

function validateMessageForSend(text: string) {
  const flags = inferMessageRiskFlags(text);
  if (flags.includes("abusive_language")) {
    return {
      blocked: true as const,
      warning: "Messages with abusive language are blocked.",
      flags,
    };
  }
  if (flags.includes("contact_disclosure") || flags.includes("private_location_disclosure")) {
    return {
      blocked: true as const,
      warning: "Private contact details and exact room or hostel references are blocked in chat.",
      flags,
    };
  }
  return {
    blocked: false as const,
    warning:
      flags.includes("off_platform_push")
        ? "Off-platform contact references are monitored. Keep payment and logistics on-platform."
        : "",
      flags,
  };
}

const THREAD_TERMINATED_FLAG = "thread_terminated";
const THREAD_TERMINATED_PREFIX = "[thread-terminated]";

function buildThreadTerminationText(actorLabel: string) {
  return `${THREAD_TERMINATED_PREFIX} ${actorLabel} has terminated the chat.`;
}

function parseSystemMessage(text: string, riskFlags?: string[] | null) {
  const normalizedText = String(text || "");
  const nextRiskFlags = Array.isArray(riskFlags) ? riskFlags.filter(Boolean) : [];
  const isTerminated =
    nextRiskFlags.includes(THREAD_TERMINATED_FLAG) || normalizedText.trim().toLowerCase().startsWith(THREAD_TERMINATED_PREFIX);

  if (!isTerminated) {
    return {
      kind: "user" as const,
      systemType: null,
      text: normalizedText,
      riskFlags: nextRiskFlags,
      terminatedAt: null,
    };
  }

  const visibleText = normalizedText.trim().toLowerCase().startsWith(THREAD_TERMINATED_PREFIX)
    ? normalizedText.trim().slice(THREAD_TERMINATED_PREFIX.length).trim()
    : normalizedText.trim();

  return {
    kind: "system" as const,
    systemType: "thread_terminated" as const,
    text: visibleText || "This chat has been terminated.",
    riskFlags: [...new Set([...nextRiskFlags, THREAD_TERMINATED_FLAG])],
    terminatedAt: null,
  };
}

function mapConversationMessageRow(message: any, sender: PublicProfile | null) {
  const parsed = parseSystemMessage(message.text, message.risk_flags ?? []);
  return {
    id: message.id,
    conversationId: message.conversation_id,
    senderProfileId: message.sender_profile_id,
    text: parsed.text,
    sentAt: message.created_at,
    riskFlags: parsed.riskFlags,
    kind: parsed.kind,
    systemType: parsed.systemType,
    sender,
  };
}

async function getLatestConversationMessageRow(conversationId: string) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw createServiceError("Failed to inspect latest conversation message in Supabase.", error);
  return data ?? null;
}

async function isConversationClosed(conversationId: string) {
  const latestMessage = await getLatestConversationMessageRow(conversationId);
  if (!latestMessage) return false;
  return parseSystemMessage(latestMessage.text, latestMessage.risk_flags ?? []).systemType === "thread_terminated";
}

function mapListingRow(row: any, isFavorited = false, activeHold?: ListingHold | null): Listing {
  const sellerProfile = row.seller_profile;
  return {
    id: row.id,
    sellerProfileId: row.seller_profile_id,
    title: row.title,
    description: row.description,
    price: Number(row.price),
    inventoryCount: Number(row.inventory_count ?? 1),
    currency: row.currency ?? "INR",
    category: row.category,
    condition: row.condition,
    status: row.status,
    mode: row.mode ?? "sale",
    negotiable: !!row.negotiable,
    fulfillmentModes: Array.isArray(row.fulfillment_modes) ? row.fulfillment_modes : [],
    area: row.area,
    campusId: row.campus_id,
    imageUrls: Array.isArray(row.image_urls) ? row.image_urls : [],
    tags: Array.isArray(row.tags) ? row.tags : [],
    rentDetails: row.rent_details ?? undefined,
    bundleDetails: row.bundle_details ?? undefined,
    listingMetadata: row.listing_metadata ?? undefined,
    trustScore: row.trust_score ?? 40,
    completenessScore: row.completeness_score ?? 45,
    activeHold: activeHold ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    seller: sellerProfile
      ? toPublicProfile(mapProfileRecord(sellerProfile), sellerProfile.listing_count ?? 0)
      : null,
    isFavorited,
  } as Listing & { seller: PublicProfile | null; isFavorited: boolean };
}

async function getProfileRowByAuthUserId(authUserId: string) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (error) {
    return null;
  }

  return data;
}

export async function ensureProfileForAuthUser(user: AuthUser): Promise<Profile> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return ensureProfileForAuthUserInMemory(user);
  }

  const cachedProfile = readCache(authProfileCache, user.id);
  if (
    cachedProfile &&
    cachedProfile.email === user.email &&
    cachedProfile.fullName === user.fullName &&
    cachedProfile.role === user.role &&
    cachedProfile.campusId === user.campusId &&
    cachedProfile.isVerified === user.isVerified
  ) {
    return cachedProfile;
  }

  const existingByAuthId = await getProfileRowByAuthUserId(user.id);
  if (existingByAuthId) {
    const needsSync =
      existingByAuthId.email !== user.email ||
      existingByAuthId.full_name !== user.fullName ||
      existingByAuthId.role !== user.role ||
      existingByAuthId.campus_id !== user.campusId ||
      !!existingByAuthId.is_verified !== user.isVerified;

    if (!needsSync) {
      const mapped = mapProfileRecord(existingByAuthId);
      writeCache(authProfileCache, user.id, mapped);
      return mapped;
    }

    const { data, error } = await supabase
      .from("profiles")
      .update({
        email: user.email,
        full_name: user.fullName,
        role: user.role,
        campus_id: user.campusId,
        is_verified: user.isVerified,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingByAuthId.id)
      .select("*")
      .single();

    if (!error && data) {
      const mapped = mapProfileRecord(data);
      writeCache(authProfileCache, user.id, mapped);
      publicProfileCache.delete(mapped.id);
      return mapped;
    }
  }

  const { data: existingByEmail } = await supabase
    .from("profiles")
    .select("*")
    .eq("email", user.email)
    .maybeSingle();

  if (existingByEmail) {
    const { data, error } = await supabase
      .from("profiles")
      .update({
        auth_user_id: user.id,
        full_name: user.fullName,
        role: user.role,
        campus_id: user.campusId,
        is_verified: user.isVerified,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingByEmail.id)
      .select("*")
      .single();

    if (!error && data) {
      const mapped = mapProfileRecord(data);
      writeCache(authProfileCache, user.id, mapped);
      publicProfileCache.delete(mapped.id);
      return mapped;
    }
  }

  const { data, error } = await supabase
    .from("profiles")
    .insert({
      auth_user_id: user.id,
      email: user.email,
      full_name: user.fullName,
      role: user.role,
      campus_id: user.campusId,
      is_verified: user.isVerified,
      trust_badges: user.isVerified ? ["verified-campus"] : [],
      profile_completeness: 60,
    })
    .select("*")
    .single();

  if (error || !data) {
    return ensureProfileForAuthUserInMemory(user);
  }

  const mapped = mapProfileRecord(data);
  writeCache(authProfileCache, user.id, mapped);
  publicProfileCache.delete(mapped.id);
  return mapped;
}

export async function getOwnProfile(user: AuthUser): Promise<Profile> {
  return ensureProfileForAuthUser(user);
}

export async function updateOwnProfile(
  user: AuthUser,
  input: {
    fullName?: string;
    bio?: string;
    avatarUrl?: string | null;
    contactNumber?: string;
    hostel?: string;
    department?: string;
    sellerHeadline?: string;
    preferredMeetupSpot?: string;
    favoriteCategories?: string[];
    notificationPreferences?: {
      buying?: boolean;
      selling?: boolean;
      safety?: boolean;
      system?: boolean;
      savedSearchAlerts?: boolean;
    };
    campusId?: string;
    setupCompleted?: boolean;
  },
): Promise<Profile> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return ensureProfileForAuthUserInMemory({
      ...user,
      fullName: input.fullName ?? user.fullName,
      campusId: input.campusId ?? user.campusId,
    } as AuthUser) as any;
  }

  const profile = await ensureProfileForAuthUser(user);
  const fullName = input.fullName?.trim() || profile.fullName;
  const bio = input.bio?.trim() || null;
  const contactNumber = input.contactNumber?.trim() || null;
  const hostel = input.hostel?.trim() || null;
  const department = input.department?.trim() || null;
  const sellerHeadline = input.sellerHeadline?.trim() || null;
  const preferredMeetupSpot = input.preferredMeetupSpot?.trim() || null;
  const favoriteCategories = (input.favoriteCategories || []).map((item) => item.trim()).filter(Boolean);
  const notificationPreferences = {
    buying: input.notificationPreferences?.buying ?? (profile as any).notificationPreferences?.buying ?? true,
    selling: input.notificationPreferences?.selling ?? (profile as any).notificationPreferences?.selling ?? true,
    safety: input.notificationPreferences?.safety ?? (profile as any).notificationPreferences?.safety ?? true,
    system: input.notificationPreferences?.system ?? (profile as any).notificationPreferences?.system ?? true,
    savedSearchAlerts:
      input.notificationPreferences?.savedSearchAlerts ??
      (profile as any).notificationPreferences?.savedSearchAlerts ??
      true,
  };
  const campusId = input.campusId?.trim() || profile.campusId;

  let profileCompleteness = 35;
  if (fullName) profileCompleteness += 15;
  if (bio) profileCompleteness += 10;
  if (contactNumber) profileCompleteness += 10;
  if (hostel) profileCompleteness += 10;
  if (department) profileCompleteness += 10;
  if (input.avatarUrl) profileCompleteness += 10;
  if (sellerHeadline) profileCompleteness += 5;
  if (preferredMeetupSpot) profileCompleteness += 5;
  if (favoriteCategories.length) profileCompleteness += 5;

  const { data, error } = await supabase
    .from("profiles")
    .update({
      full_name: fullName,
      bio,
      avatar_url: input.avatarUrl ?? null,
      contact_number: contactNumber,
      hostel,
      department,
      seller_headline: sellerHeadline,
      preferred_meetup_spot: preferredMeetupSpot,
      favorite_categories: favoriteCategories,
      notification_preferences: notificationPreferences,
      campus_id: campusId,
      profile_completeness: Math.min(profileCompleteness, 100),
      setup_completed: input.setupCompleted ?? true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", profile.id)
    .select("*")
    .single();

  if (error || !data) {
    throw createServiceError("Failed to update profile in Supabase.", error);
  }

  invalidateListingCaches();
  const mapped = mapProfileRecord(data);
  writeCache(authProfileCache, user.id, mapped);
  publicProfileCache.delete(mapped.id);
  return mapped;
}

export async function listPolicies() {
  return policyArticles;
}

export async function getPolicyById(policyId: string) {
  return policyArticles.find((article) => article.id === policyId) ?? null;
}

export async function listSavedFilters(user: AuthUser): Promise<SavedFilter[]> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return [];
  const profile = await ensureProfileForAuthUser(user);
  const { data, error } = await supabase
    .from("saved_filters")
    .select("*")
    .eq("profile_id", profile.id)
    .order("created_at", { ascending: false });

  if (error) throw createServiceError("Failed to load saved filters from Supabase.", error);
  return (data ?? []).map((item: any) => ({
    id: item.id,
    profileId: item.profile_id,
    label: item.label,
    filterPayload: item.filter_payload ?? {},
    alertEnabled: item.alert_enabled ?? false,
    updatedAt: item.updated_at ?? item.created_at,
    lastTriggeredAt: item.last_triggered_at ?? null,
    createdAt: item.created_at,
  }));
}

export async function saveFilter(
  user: AuthUser,
  input: { label: string; filterPayload: Record<string, unknown>; alertEnabled?: boolean },
): Promise<SavedFilter> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw createServiceError("Supabase client is unavailable for saving filters.");
  const profile = await ensureProfileForAuthUser(user);
  let result = await supabase
    .from("saved_filters")
    .insert({
      profile_id: profile.id,
      label: input.label,
      filter_payload: input.filterPayload,
      alert_enabled: input.alertEnabled ?? false,
      updated_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (result.error?.message?.includes("alert_enabled") || result.error?.message?.includes("updated_at")) {
    result = await supabase
      .from("saved_filters")
      .insert({
        profile_id: profile.id,
        label: input.label,
        filter_payload: input.filterPayload,
      })
      .select("*")
      .single();
  }

  if (result.error || !result.data) throw createServiceError("Failed to save filter in Supabase.", result.error);
  return {
    id: result.data.id,
    profileId: result.data.profile_id,
    label: result.data.label,
    filterPayload: result.data.filter_payload ?? {},
    alertEnabled: result.data.alert_enabled ?? false,
    updatedAt: result.data.updated_at ?? result.data.created_at,
    lastTriggeredAt: result.data.last_triggered_at ?? null,
    createdAt: result.data.created_at,
  };
}

export async function updateSavedFilter(
  filterId: string,
  user: AuthUser,
  input: { label?: string; filterPayload?: Record<string, unknown>; alertEnabled?: boolean },
): Promise<SavedFilter | null> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return null;
  const profile = await ensureProfileForAuthUser(user);
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (typeof input.label === "string") patch.label = input.label;
  if (input.filterPayload) patch.filter_payload = input.filterPayload;
  if (typeof input.alertEnabled === "boolean") patch.alert_enabled = input.alertEnabled;

  let result = await supabase
    .from("saved_filters")
    .update(patch)
    .eq("id", filterId)
    .eq("profile_id", profile.id)
    .select("*")
    .maybeSingle();

  if (result.error?.message?.includes("alert_enabled") || result.error?.message?.includes("updated_at")) {
    const fallbackPatch = { ...patch };
    delete fallbackPatch.alert_enabled;
    delete fallbackPatch.updated_at;
    result = await supabase
      .from("saved_filters")
      .update(fallbackPatch)
      .eq("id", filterId)
      .eq("profile_id", profile.id)
      .select("*")
      .maybeSingle();
  }

  if (result.error) throw createServiceError("Failed to update saved filter in Supabase.", result.error);
  if (!result.data) return null;
  return {
    id: result.data.id,
    profileId: result.data.profile_id,
    label: result.data.label,
    filterPayload: result.data.filter_payload ?? {},
    alertEnabled: result.data.alert_enabled ?? false,
    updatedAt: result.data.updated_at ?? result.data.created_at,
    lastTriggeredAt: result.data.last_triggered_at ?? null,
    createdAt: result.data.created_at,
  };
}

export async function deleteSavedFilter(filterId: string, user: AuthUser): Promise<boolean> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return false;
  const profile = await ensureProfileForAuthUser(user);
  const { error, count } = await supabase
    .from("saved_filters")
    .delete({ count: "exact" })
    .eq("id", filterId)
    .eq("profile_id", profile.id);
  if (error) throw createServiceError("Failed to delete saved filter in Supabase.", error);
  return (count ?? 0) > 0;
}

export async function clearSavedFilters(user: AuthUser): Promise<{ deleted: number }> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return { deleted: 0 };
  const profile = await ensureProfileForAuthUser(user);
  const { error, count } = await supabase
    .from("saved_filters")
    .delete({ count: "exact" })
    .eq("profile_id", profile.id);
  if (error) throw createServiceError("Failed to clear saved filters in Supabase.", error);
  return { deleted: count ?? 0 };
}

async function listCompareQueueFallback(profileId: string, user: AuthUser): Promise<CompareQueueItem[]> {
  const rows = (fallbackCompareQueues.get(profileId) ?? []).slice(0, 3);
  const listings = await Promise.all(rows.map((row) => getListingById(row.listingId, user).catch(() => null)));
  return rows.map((row, index) => ({
    ...row,
    listing: listings[index] ?? null,
  }));
}

export async function listCompareQueue(user: AuthUser): Promise<CompareQueueItem[]> {
  const supabase = getSupabaseAdminClient();
  const profile = await ensureProfileForAuthUser(user);
  if (!supabase) return listCompareQueueFallback(profile.id, user);
  const { data, error } = await supabase
    .from("compare_queue_items")
    .select("*")
    .eq("profile_id", profile.id)
    .order("created_at", { ascending: true })
    .limit(3);

  if (error) return listCompareQueueFallback(profile.id, user);

  const rows = (data ?? []).map(mapCompareQueueRow);
  const listings = await Promise.all(rows.map((row) => getListingById(row.listingId, user)));
  return rows.map((row, index) => ({
    ...row,
    listing: listings[index] ?? null,
  }));
}

export async function replaceCompareQueue(user: AuthUser, listingIds: string[]): Promise<CompareQueueItem[]> {
  const supabase = getSupabaseAdminClient();
  const profile = await ensureProfileForAuthUser(user);
  const uniqueIds = [...new Set(listingIds.map((item) => String(item).trim()).filter(Boolean))]
    .filter((item) => /^[0-9a-fA-F-]{36}$/.test(item))
    .slice(0, 3);

  const visibleListings = await Promise.all(uniqueIds.map((listingId) => getListingById(listingId, user)));
  const allowedIds = visibleListings.filter(Boolean).map((listing) => listing!.id);
  const persistedIds = allowedIds.length ? allowedIds : uniqueIds;

  if (!supabase) {
    fallbackCompareQueues.set(
      profile.id,
      persistedIds.map((listingId) => ({
        id: `compare-${profile.id}-${listingId}`,
        profileId: profile.id,
        listingId,
        createdAt: new Date().toISOString(),
      })),
    );
    return listCompareQueueFallback(profile.id, user);
  }

  const { error: deleteError } = await supabase.from("compare_queue_items").delete().eq("profile_id", profile.id);
  if (deleteError) {
    fallbackCompareQueues.set(
      profile.id,
      persistedIds.map((listingId) => ({
        id: `compare-${profile.id}-${listingId}`,
        profileId: profile.id,
        listingId,
        createdAt: new Date().toISOString(),
      })),
    );
    return listCompareQueueFallback(profile.id, user);
  }

  if (persistedIds.length) {
    const { error: insertError } = await supabase.from("compare_queue_items").insert(
      persistedIds.map((listingId) => ({
        profile_id: profile.id,
        listing_id: listingId,
      })),
    );
    if (insertError) {
      fallbackCompareQueues.set(
        profile.id,
        persistedIds.map((nextListingId) => ({
          id: `compare-${profile.id}-${nextListingId}`,
          profileId: profile.id,
          listingId: nextListingId,
          createdAt: new Date().toISOString(),
        })),
      );
      return listCompareQueueFallback(profile.id, user);
    }
  }

  return listCompareQueue(user);
}

export async function addToCompareQueue(user: AuthUser, listingId: string): Promise<CompareQueueItem[]> {
  const current = await listCompareQueue(user);
  const nextIds = [...new Set([...current.map((item) => item.listingId), String(listingId).trim()].filter(Boolean))].slice(0, 3);
  return replaceCompareQueue(user, nextIds);
}

export async function removeFromCompareQueue(user: AuthUser, listingId: string): Promise<CompareQueueItem[]> {
  const current = await listCompareQueue(user);
  return replaceCompareQueue(
    user,
    current.map((item) => item.listingId).filter((id) => id !== String(listingId).trim()),
  );
}

export async function clearCompareQueue(user: AuthUser): Promise<{ deleted: number }> {
  const supabase = getSupabaseAdminClient();
  const profile = await ensureProfileForAuthUser(user);
  if (!supabase) {
    const deleted = fallbackCompareQueues.get(profile.id)?.length ?? 0;
    fallbackCompareQueues.set(profile.id, []);
    return { deleted };
  }
  const { error, count } = await supabase
    .from("compare_queue_items")
    .delete({ count: "exact" })
    .eq("profile_id", profile.id);
  if (error) {
    const deleted = fallbackCompareQueues.get(profile.id)?.length ?? 0;
    fallbackCompareQueues.set(profile.id, []);
    return { deleted };
  }
  return { deleted: count ?? 0 };
}

export async function createListingMediaUploadTicket(
  user: AuthUser,
  input: {
    filename: string;
    mimeType: string;
    mediaKind: "image" | "video";
    fileSizeBytes?: number;
    listingId?: string;
    sortOrder?: number;
  },
): Promise<MediaUploadTicket> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    throw new Error("Supabase is required for media upload tickets.");
  }

  const profile = await ensureProfileForAuthUser(user);
  if (input.listingId) {
    const listing = await getListingById(input.listingId, user);
    if (!listing) throw new Error("LISTING_NOT_FOUND");
    if (listing.sellerProfileId !== profile.id && user.role !== "admin") throw new Error("FORBIDDEN");
  }

  const extension = guessFileExtension(input.filename, input.mimeType);
  const objectPath = `profiles/${profile.id}/${input.listingId ?? "drafts"}/${randomUUID()}-${slugifyFilenameSegment(input.filename.replace(/\\.[^.]+$/, ""))}.${extension}`;
  const publicUrl = buildStoragePublicUrl(LISTING_MEDIA_BUCKET, objectPath);
  const { data: signedUpload, error: signedUploadError } = await supabase.storage
    .from(LISTING_MEDIA_BUCKET)
    .createSignedUploadUrl(objectPath, {
      upsert: true,
    });

  if (signedUploadError || !signedUpload?.token) {
    throw createServiceError("Failed to create signed upload URL for listing media.", signedUploadError);
  }

  const { data, error } = await supabase
    .from("listing_media_assets")
    .insert({
      owner_profile_id: profile.id,
      listing_id: input.listingId ?? null,
      bucket_id: LISTING_MEDIA_BUCKET,
      object_path: objectPath,
      public_url: publicUrl,
      media_kind: input.mediaKind,
      mime_type: input.mimeType,
      file_size_bytes: input.fileSizeBytes ?? null,
      sort_order: input.sortOrder ?? 0,
      upload_status: "pending",
      original_filename: input.filename,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw createServiceError("Failed to register listing media asset in Supabase.", error);
  }

  return {
    asset: mapMediaAssetRow(data),
    bucketId: LISTING_MEDIA_BUCKET,
    objectPath,
    uploadToken: signedUpload.token,
    uploadUrl: `${env.SUPABASE_URL}/storage/v1/upload/resumable`,
    publicUrl,
  };
}

export async function completeListingMediaUpload(
  assetId: string,
  user: AuthUser,
  input: {
    width?: number;
    height?: number;
    durationSeconds?: number;
    fileSizeBytes?: number;
    checksum?: string;
    uploadStatus?: "uploaded" | "ready" | "failed";
  },
) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return null;
  const profile = await ensureProfileForAuthUser(user);
  const { data, error } = await supabase
    .from("listing_media_assets")
    .update({
      width: input.width ?? null,
      height: input.height ?? null,
      duration_seconds: input.durationSeconds ?? null,
      file_size_bytes: input.fileSizeBytes ?? null,
      checksum: input.checksum ?? null,
      upload_status: input.uploadStatus ?? "ready",
      updated_at: new Date().toISOString(),
    })
    .eq("id", assetId)
    .eq("owner_profile_id", profile.id)
    .select("*")
    .maybeSingle();

  if (error) throw createServiceError("Failed to finalize listing media asset.", error);
  return data ? mapMediaAssetRow(data) : null;
}

export async function listMediaAssetsForListing(listingId: string, user?: AuthUser) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return [];
  const viewerProfile = user ? await ensureProfileForAuthUser(user) : null;
  const listing = await getListingById(listingId, user);
  if (!listing) return [];
  const canViewPending = !!viewerProfile && (viewerProfile.id === listing.sellerProfileId || viewerProfile.role === "admin");
  let query = supabase
    .from("listing_media_assets")
    .select("*")
    .eq("listing_id", listingId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (!canViewPending) {
    query = query.in("upload_status", ["uploaded", "ready"]);
  }

  const { data, error } = await query;
  if (error) throw createServiceError("Failed to load listing media assets.", error);
  return (data ?? []).map(mapMediaAssetRow);
}

export async function deleteListingMediaAsset(assetId: string, user: AuthUser) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return false;
  const profile = await ensureProfileForAuthUser(user);
  const { data, error } = await supabase
    .from("listing_media_assets")
    .select("*")
    .eq("id", assetId)
    .eq("owner_profile_id", profile.id)
    .maybeSingle();

  if (error) throw createServiceError("Failed to inspect listing media asset.", error);
  if (!data) return false;

  const asset = mapMediaAssetRow(data);
  const { error: storageError } = await supabase.storage.from(asset.bucketId).remove([asset.objectPath]);
  if (storageError) {
    throw createServiceError("Failed to delete media object from storage.", storageError);
  }

  const { error: deleteError } = await supabase.from("listing_media_assets").delete().eq("id", assetId);
  if (deleteError) throw createServiceError("Failed to delete media asset record.", deleteError);
  invalidateListingCaches();
  return true;
}

export async function recordRecentlyViewed(user: AuthUser, listingId: string) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return null;
  const profile = await ensureProfileForAuthUser(user);
  const { error } = await supabase
    .from("recently_viewed")
    .upsert(
      {
        profile_id: profile.id,
        listing_id: listingId,
        viewed_at: new Date().toISOString(),
      },
      { onConflict: "profile_id,listing_id" },
    );

  if (error) throw createServiceError("Failed to record recently viewed listing in Supabase.", error);
  return true;
}

export async function listRecentlyViewed(user: AuthUser): Promise<Listing[]> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return [];
  const profile = await ensureProfileForAuthUser(user);
  const { data, error } = await supabase
    .from("recently_viewed")
    .select("viewed_at, listings(*, seller_profile:profiles!listings_seller_profile_id_fkey(*))")
    .eq("profile_id", profile.id)
    .order("viewed_at", { ascending: false })
    .limit(8);

  if (error) throw createServiceError("Failed to load recently viewed listings from Supabase.", error);
  const listings = (data ?? [])
    .map((row: any) => (row.listings ? mapListingRow(row.listings, false) : null))
    .filter(Boolean) as Listing[];
  return attachMediaToListings(listings);
}

export async function listNotifications(user: AuthUser): Promise<UserNotification[]> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return [];
  const profile = await ensureProfileForAuthUser(user);
  const { data, error } = await supabase
    .from("user_notifications")
    .select("*")
    .eq("profile_id", profile.id)
    .is("dismissed_at", null)
    .order("created_at", { ascending: false })
    .limit(60);

  if (error) throw createServiceError("Failed to load notifications from Supabase.", error);
  return (data ?? []).map(mapNotificationRow);
}

export async function markNotificationRead(notificationId: string, user: AuthUser): Promise<UserNotification | null> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return null;
  const profile = await ensureProfileForAuthUser(user);
  const { data, error } = await supabase
    .from("user_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("profile_id", profile.id)
    .select("*")
    .maybeSingle();

  if (error) throw createServiceError("Failed to mark notification as read in Supabase.", error);
  return data ? mapNotificationRow(data) : null;
}

export async function dismissNotification(notificationId: string, user: AuthUser): Promise<UserNotification | null> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return null;
  const profile = await ensureProfileForAuthUser(user);
  const now = new Date().toISOString();
  const result = await supabase
    .from("user_notifications")
    .update({ dismissed_at: now, read_at: now })
    .eq("id", notificationId)
    .eq("profile_id", profile.id)
    .select("*")
    .maybeSingle();

  if (result.error?.message?.includes("dismissed_at")) {
    const fallback = await supabase
      .from("user_notifications")
      .update({ read_at: now })
      .eq("id", notificationId)
      .eq("profile_id", profile.id)
      .select("*")
      .maybeSingle();
    if (fallback.error) throw createServiceError("Failed to dismiss notification in Supabase.", fallback.error);
    return fallback.data ? mapNotificationRow(fallback.data) : null;
  }

  if (result.error) throw createServiceError("Failed to dismiss notification in Supabase.", result.error);
  return result.data ? mapNotificationRow(result.data) : null;
}

export async function markAllNotificationsRead(user: AuthUser): Promise<{ updated: number }> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return { updated: 0 };
  const profile = await ensureProfileForAuthUser(user);
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("user_notifications")
    .update({ read_at: now })
    .eq("profile_id", profile.id)
    .is("read_at", null)
    .select("id");

  if (error) throw createServiceError("Failed to mark notifications as read in Supabase.", error);
  return { updated: (data ?? []).length };
}

async function createNotifications(
  notifications: Array<{
    profileId: string;
    type: UserNotification["type"];
    category?: UserNotification["category"];
    priority?: UserNotification["priority"];
    title: string;
    body: string;
    entityType?: UserNotification["entityType"];
    entityId?: string | null;
    actionLabel?: string | null;
    actionHref?: string | null;
    metadata?: Record<string, unknown>;
  }>,
) {
  const supabase = getSupabaseAdminClient();
  if (!supabase || !notifications.length) return;
  const profileIds = [...new Set(notifications.map((item) => item.profileId))];
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, notification_preferences")
    .in("id", profileIds);

  const preferenceMap = new Map(
    (profiles ?? []).map((profile: any) => [
      profile.id,
      profile.notification_preferences ?? {
        buying: true,
        selling: true,
        safety: true,
        system: true,
        savedSearchAlerts: true,
      },
    ]),
  );

  const filteredNotifications = notifications.filter((item) => {
    const preferences = preferenceMap.get(item.profileId) ?? {
      buying: true,
      selling: true,
      safety: true,
      system: true,
      savedSearchAlerts: true,
    };
    if (item.type === "saved_search_match" && preferences.savedSearchAlerts === false) return false;
    const category = item.category ?? inferNotificationCategory(item.type);
    if (category === "buying" && preferences.buying === false) return false;
    if (category === "selling" && preferences.selling === false) return false;
    if (category === "safety" && preferences.safety === false) return false;
    if ((category === "system" || category === "admin") && preferences.system === false) return false;
    return true;
  });

  if (!filteredNotifications.length) {
    return;
  }

  const dedupeWindowStart = new Date(Date.now() - NOTIFICATION_DEDUPE_WINDOW_HOURS * 60 * 60 * 1000).toISOString();
  const { data: existingNotifications, error: existingNotificationsError } = await supabase
    .from("user_notifications")
    .select("profile_id,type,entity_id,title,metadata,created_at")
    .in("profile_id", [...new Set(filteredNotifications.map((item) => item.profileId))])
    .gte("created_at", dedupeWindowStart)
    .is("dismissed_at", null);

  if (existingNotificationsError) {
    throw createServiceError("Failed to inspect existing notifications in Supabase.", existingNotificationsError);
  }

  const existingKeys = new Set(
    (existingNotifications ?? []).map((row: any) =>
      buildNotificationDedupKey({
        profileId: row.profile_id,
        type: row.type,
        entityId: row.entity_id,
        title: row.title,
        metadata: row.metadata ?? {},
      }),
    ),
  );

  const dedupedNotifications = filteredNotifications.filter((item) => !existingKeys.has(buildNotificationDedupKey(item)));

  if (!dedupedNotifications.length) {
    return;
  }

  let result = await supabase.from("user_notifications").insert(
    dedupedNotifications.map((item) => ({
      profile_id: item.profileId,
      type: item.type,
      category: item.category ?? inferNotificationCategory(item.type),
      priority: item.priority ?? inferNotificationPriority(item.type),
      title: item.title,
      body: item.body,
      entity_type: item.entityType ?? null,
      entity_id: item.entityId ?? null,
      action_label: item.actionLabel ?? null,
      action_href: item.actionHref ?? null,
      metadata: item.metadata ?? {},
    })),
  );
  if (
    result.error?.message?.includes("category") ||
    result.error?.message?.includes("priority") ||
    result.error?.message?.includes("action_label") ||
    result.error?.message?.includes("action_href")
  ) {
    result = await supabase.from("user_notifications").insert(
      dedupedNotifications.map((item) => ({
        profile_id: item.profileId,
        type: item.type,
        title: item.title,
        body: item.body,
        entity_type: item.entityType ?? null,
        entity_id: item.entityId ?? null,
        metadata: item.metadata ?? {},
      })),
    );
  }
  if (result.error) throw createServiceError("Failed to create user notifications in Supabase.", result.error);
}

export async function getDashboardSummary(user: AuthUser): Promise<DashboardSummary> {
  const profile = await ensureProfileForAuthUser(user);
  const [ownListings, favorites, cartView, compareQueue, conversations, schedules, reports, recentlyViewed, savedFilters, notifications] =
    await Promise.all([
      listOwnListings(user),
      listFavoriteListings(user),
      listCart(user),
      listCompareQueue(user),
      listConversations(user),
      listSchedules(user),
      listReports(),
      listRecentlyViewed(user),
      listSavedFilters(user),
      listNotifications(user),
    ]);

  const activeListings = ownListings.filter((listing) => listing.status === "active").length;
  const reservedListings = ownListings.filter((listing) => listing.status === "reserved").length;
  const soldListings = ownListings.filter((listing) => listing.status === "sold").length;
  const pendingModerationCount = reports.filter((report: Report) => report.status !== "resolved").length;
  const urgentActions: string[] = [];

  if (!ownListings.length) {
    urgentActions.push("Create your first listing to appear in the campus marketplace.");
  }
  if (ownListings.some((listing) => (listing.completenessScore ?? 0) < 70)) {
    urgentActions.push("Complete listing details and media to improve trust and conversion.");
  }
  if (favorites.length > 0 && cartView.items.length === 0) {
    urgentActions.push("Review saved favorites and move strong candidates into cart or chat.");
  }
  if (conversations.some((conversation) => !conversation.lastMessage)) {
    urgentActions.push("A listing conversation is open without a reply. Re-enter chat and respond.");
  }
  if (schedules.some((schedule) => ["proposed", "reschedule_requested"].includes(schedule.status))) {
    urgentActions.push("You have meetup proposals waiting on the other side to confirm.");
  }

  return {
    activeListings,
    reservedListings,
    soldListings,
    favoriteCount: favorites.length,
    cartCount: cartView.items.reduce((sum, item) => sum + item.quantity, 0),
    compareQueueCount: compareQueue.length,
    conversationCount: conversations.length,
    scheduleCount: schedules.length,
    unreadLikeCount: conversations.filter((conversation) => !!conversation.lastMessage).length,
    reportCount: reports.filter((report: Report) => report.reporterProfileId === profile.id).length,
    pendingModerationCount: user.role === "admin" ? pendingModerationCount : 0,
    recentlyPublished: ownListings.slice(0, 4),
    recentFavorites: favorites.slice(0, 4),
    recentlyViewed: recentlyViewed.slice(0, 4),
    notifications: notifications.slice(0, 6),
    unreadNotificationCount: notifications.filter((item) => !item.readAt).length,
    savedFilters: savedFilters.slice(0, 4).map((item) => ({
      id: item.id,
      label: item.label,
      filterPayload: item.filterPayload,
      alertEnabled: item.alertEnabled ?? false,
      updatedAt: item.updatedAt,
      lastTriggeredAt: item.lastTriggeredAt ?? null,
    })),
    urgentActions,
  };
}

export async function getUserAnalytics(user: AuthUser): Promise<UserAnalyticsSummary> {
  const profile = await ensureProfileForAuthUser(user);
  const supabase = getSupabaseAdminClient();
  const [ownListings, favorites, compareQueue, conversations, schedules, savedFilters, notifications, recentlyViewed, cartView] = await Promise.all([
    listOwnListings(user),
    listFavoriteListings(user),
    listCompareQueue(user),
    listConversations(user),
    listSchedules(user),
    listSavedFilters(user),
    listNotifications(user),
    listRecentlyViewed(user),
    listCart(user),
  ]);

  const listingBreakdown = await Promise.all(
    ownListings.map(async (listing) => {
      const [favoriteCountResult, conversationCountResult, holdCountResult, scheduleCountResult] = await Promise.all([
        getSupabaseAdminClient()
          ?.from("favorites")
          .select("id", { count: "exact", head: true })
          .eq("listing_id", listing.id),
        getSupabaseAdminClient()
          ?.from("conversations")
          .select("id", { count: "exact", head: true })
          .eq("listing_id", listing.id),
        getSupabaseAdminClient()
          ?.from("listing_holds")
          .select("id", { count: "exact", head: true })
          .eq("listing_id", listing.id),
        getSupabaseAdminClient()
          ?.from("delivery_schedules")
          .select("id", { count: "exact", head: true })
          .eq("listing_id", listing.id),
      ]);

      return {
        listingId: listing.id,
        title: listing.title,
        status: listing.status,
        favoriteCount: favoriteCountResult?.count ?? 0,
        conversationCount: conversationCountResult?.count ?? 0,
        holdCount: holdCountResult?.count ?? 0,
        scheduleCount: scheduleCountResult?.count ?? 0,
        inventoryCount: listing.inventoryCount || 1,
        updatedAt: listing.updatedAt,
      };
    }),
  );

  let sellerDailyTrends: SellerAnalyticsSummary["dailyTrends"] = [];
  let buyerDailyTrends: UserAnalyticsSummary["buyer"]["dailyTrends"] = [];
  if (supabase) {
    const [sellerTrendResult, buyerTrendResult] = await Promise.all([
      supabase
        .from("seller_daily_activity_v1")
        .select("*")
        .eq("seller_profile_id", profile.id)
        .order("day", { ascending: false })
        .limit(14),
      supabase
        .from("buyer_daily_activity_v1")
        .select("*")
        .eq("profile_id", profile.id)
        .order("day", { ascending: false })
        .limit(14),
    ]);

    if (sellerTrendResult.error) {
      throw createServiceError("Failed to load seller daily activity analytics from Supabase.", sellerTrendResult.error);
    }
    if (buyerTrendResult.error) {
      throw createServiceError("Failed to load buyer daily activity analytics from Supabase.", buyerTrendResult.error);
    }

    sellerDailyTrends = (sellerTrendResult.data ?? [])
      .map((row: any) => ({
        date: String(row.day),
        listingsCreated: Number(row.listings_created ?? 0),
        favoritesAdded: Number(row.favorites_added ?? 0),
        conversationsStarted: Number(row.conversations_started ?? 0),
        holdsCreated: Number(row.holds_created ?? 0),
        schedulesCreated: Number(row.schedules_created ?? 0),
      }))
      .sort((left, right) => left.date.localeCompare(right.date));

    buyerDailyTrends = (buyerTrendResult.data ?? [])
      .map((row: any) => ({
        date: String(row.day),
        savedListings: Number(row.saved_listings ?? 0),
        comparedListings: Number(row.compared_listings ?? 0),
        recentlyViewed: Number(row.recently_viewed ?? 0),
        buyingNotifications: Number(row.buying_notifications ?? 0),
        buyerConversations: Number(row.buyer_conversations ?? 0),
        buyerSchedules: Number(row.buyer_schedules ?? 0),
      }))
      .sort((left, right) => left.date.localeCompare(right.date));
  }

  return {
    seller: {
      activeListings: ownListings.filter((listing) => listing.status === "active").length,
      reservedListings: ownListings.filter((listing) => listing.status === "reserved").length,
      soldListings: ownListings.filter((listing) => listing.status === "sold").length,
      totalFavorites: listingBreakdown.reduce((sum, item) => sum + item.favoriteCount, 0),
      totalConversations: listingBreakdown.reduce((sum, item) => sum + item.conversationCount, 0),
      totalHolds: listingBreakdown.reduce((sum, item) => sum + item.holdCount, 0),
      totalSchedules: listingBreakdown.reduce((sum, item) => sum + item.scheduleCount, 0),
      listingBreakdown: listingBreakdown.sort((left, right) => right.favoriteCount - left.favoriteCount),
      dailyTrends: sellerDailyTrends,
    },
    buyer: {
      savedListings: favorites.length,
      comparedListings: compareQueue.length,
      cartItems: cartView.items.reduce((sum, item) => sum + item.quantity, 0),
      savedFilters: savedFilters.length,
      alertEnabledFilters: savedFilters.filter((item) => item.alertEnabled).length,
      unreadNotifications: notifications.filter((item) => !item.readAt).length,
      recentViews: recentlyViewed.length,
      dailyTrends: buyerDailyTrends,
    },
  };
}

export async function getAdminAnalytics(): Promise<AdminAnalyticsSummary> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return {
      totalReports: 0,
      openReports: 0,
      highSeverityReports: 0,
      moderationActions: 0,
      hiddenOrSuspendedListings: 0,
      activeListings: 0,
      soldListings: 0,
      aiArtifacts: 0,
      savedSearchMatches: 0,
      aiProviderEvents: 0,
      aiFallbackCount: 0,
      aiProviderErrors: 0,
      aiTimeouts: 0,
      aiAvgLatencyMs: 0,
      reportReasons: [],
      dailyTrends: [],
    };
  }

  const [reportsResult, actionsResult, listingsResult, aiArtifactsResult, savedSearchMatchesResult, aiEventsResult, aiDailyResult] = await Promise.all([
    supabase.from("reports").select("reason,status,severity,created_at"),
    supabase.from("moderation_actions").select("id,created_at"),
    supabase.from("listings").select("status,updated_at"),
    supabase.from("ai_artifacts").select("id", { count: "exact", head: true }),
    supabase.from("user_notifications").select("id", { count: "exact", head: true }).eq("type", "saved_search_match"),
    supabase.from("ai_provider_events").select("status,latency_ms"),
    supabase.from("ai_provider_daily_v1").select("*").order("day", { ascending: false }).limit(14),
  ]);

  if (reportsResult.error) throw createServiceError("Failed to load report analytics from Supabase.", reportsResult.error);
  if (actionsResult.error) throw createServiceError("Failed to load moderation analytics from Supabase.", actionsResult.error);
  if (listingsResult.error) throw createServiceError("Failed to load listing analytics from Supabase.", listingsResult.error);
  if (aiArtifactsResult.error) throw createServiceError("Failed to load AI artifact analytics from Supabase.", aiArtifactsResult.error);
  if (savedSearchMatchesResult.error) throw createServiceError("Failed to load saved-search analytics from Supabase.", savedSearchMatchesResult.error);
  if (aiEventsResult.error) throw createServiceError("Failed to load AI provider event analytics from Supabase.", aiEventsResult.error);
  if (aiDailyResult.error) throw createServiceError("Failed to load AI provider daily analytics from Supabase.", aiDailyResult.error);

  const reasonMap = new Map<string, number>();
  for (const report of reportsResult.data ?? []) {
    reasonMap.set(report.reason, (reasonMap.get(report.reason) ?? 0) + 1);
  }
  const aiEvents = aiEventsResult.data ?? [];
  const aiLatencyValues = aiEvents.map((row: any) => Number(row.latency_ms ?? 0)).filter((value: number) => Number.isFinite(value) && value > 0);
  const adminDailyMap = new Map<string, { date: string; reportsCreated: number; moderationActions: number; hiddenListings: number; aiRequests: number; aiFallbacks: number }>();

  for (const report of reportsResult.data ?? []) {
    const date = String(report.created_at ?? "").slice(0, 10);
    if (!date) continue;
    const bucket = adminDailyMap.get(date) ?? { date, reportsCreated: 0, moderationActions: 0, hiddenListings: 0, aiRequests: 0, aiFallbacks: 0 };
    bucket.reportsCreated += 1;
    adminDailyMap.set(date, bucket);
  }
  for (const action of actionsResult.data ?? []) {
    const date = String(action.created_at ?? "").slice(0, 10);
    if (!date) continue;
    const bucket = adminDailyMap.get(date) ?? { date, reportsCreated: 0, moderationActions: 0, hiddenListings: 0, aiRequests: 0, aiFallbacks: 0 };
    bucket.moderationActions += 1;
    adminDailyMap.set(date, bucket);
  }
  for (const listing of listingsResult.data ?? []) {
    if (!["hidden", "suspended"].includes(String(listing.status))) continue;
    const date = String(listing.updated_at ?? "").slice(0, 10);
    if (!date) continue;
    const bucket = adminDailyMap.get(date) ?? { date, reportsCreated: 0, moderationActions: 0, hiddenListings: 0, aiRequests: 0, aiFallbacks: 0 };
    bucket.hiddenListings += 1;
    adminDailyMap.set(date, bucket);
  }
  for (const row of aiDailyResult.data ?? []) {
    const date = String(row.day);
    const bucket = adminDailyMap.get(date) ?? { date, reportsCreated: 0, moderationActions: 0, hiddenListings: 0, aiRequests: 0, aiFallbacks: 0 };
    bucket.aiRequests += Number(row.total_requests ?? 0);
    bucket.aiFallbacks += Number(row.fallback_count ?? 0);
    adminDailyMap.set(date, bucket);
  }

  return {
    totalReports: reportsResult.data?.length ?? 0,
    openReports: (reportsResult.data ?? []).filter((report: any) => report.status !== "resolved").length,
    highSeverityReports: (reportsResult.data ?? []).filter((report: any) => report.severity === "high").length,
    moderationActions: actionsResult.data?.length ?? 0,
    hiddenOrSuspendedListings: (listingsResult.data ?? []).filter((listing: any) => ["hidden", "suspended"].includes(listing.status)).length,
    activeListings: (listingsResult.data ?? []).filter((listing: any) => listing.status === "active").length,
    soldListings: (listingsResult.data ?? []).filter((listing: any) => listing.status === "sold").length,
    aiArtifacts: aiArtifactsResult.count ?? 0,
    savedSearchMatches: savedSearchMatchesResult.count ?? 0,
    aiProviderEvents: aiEvents.length,
    aiFallbackCount: aiEvents.filter((event: any) => ["fallback", "parse_error", "config_bypass"].includes(event.status)).length,
    aiProviderErrors: aiEvents.filter((event: any) => event.status === "provider_error").length,
    aiTimeouts: aiEvents.filter((event: any) => event.status === "timeout").length,
    aiAvgLatencyMs: aiLatencyValues.length ? Number((aiLatencyValues.reduce((sum, value) => sum + value, 0) / aiLatencyValues.length).toFixed(2)) : 0,
    reportReasons: [...reasonMap.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count),
    dailyTrends: [...adminDailyMap.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-14),
  };
}

export async function getPlatformAnalytics(): Promise<PlatformAnalyticsSummary> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return {
      totalProfiles: 0,
      activeListings: 0,
      soldListings: 0,
      hiddenListings: 0,
      suspendedListings: 0,
      totalFavorites: 0,
      totalConversations: 0,
      totalSchedules: 0,
      totalOffers: 0,
      totalHolds: 0,
      totalSavedFilters: 0,
      totalCompareQueueItems: 0,
      totalAiArtifacts: 0,
      alertEnabledFilters: 0,
      unreadNotifications: 0,
      categoryBreakdown: [],
      featureUsage: [],
      funnel: { listings: 0, favorites: 0, conversations: 0, holds: 0, sold: 0 },
      dailyActivity: [],
    };
  }

  const [
    profilesResult,
    listingsResult,
    favoritesResult,
    conversationsResult,
    schedulesResult,
    offersResult,
    holdsResult,
    filtersResult,
    notificationsResult,
    compareQueueResult,
    aiArtifactsResult,
    dailyMetricsResult,
  ] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact" }),
    supabase.from("listings").select("status,category,created_at"),
    supabase.from("favorites").select("id", { count: "exact" }),
    supabase.from("conversations").select("id", { count: "exact" }),
    supabase.from("delivery_schedules").select("id", { count: "exact" }),
    supabase.from("transaction_offers").select("id", { count: "exact" }),
    supabase.from("listing_holds").select("id", { count: "exact" }),
    supabase.from("saved_filters").select("alert_enabled"),
    supabase.from("user_notifications").select("read_at"),
    supabase.from("compare_queue_items").select("id", { count: "exact", head: true }),
    supabase.from("ai_artifacts").select("id", { count: "exact", head: true }),
    supabase.from("platform_daily_metrics_v1").select("*").order("day", { ascending: false }).limit(14),
  ]);

  if (profilesResult.error) throw createServiceError("Failed to load platform profile analytics from Supabase.", profilesResult.error);
  if (listingsResult.error) throw createServiceError("Failed to load platform listing analytics from Supabase.", listingsResult.error);
  if (favoritesResult.error) throw createServiceError("Failed to load platform favorite analytics from Supabase.", favoritesResult.error);
  if (conversationsResult.error) throw createServiceError("Failed to load platform conversation analytics from Supabase.", conversationsResult.error);
  if (schedulesResult.error) throw createServiceError("Failed to load platform schedule analytics from Supabase.", schedulesResult.error);
  if (offersResult.error) throw createServiceError("Failed to load platform offer analytics from Supabase.", offersResult.error);
  if (holdsResult.error) throw createServiceError("Failed to load platform hold analytics from Supabase.", holdsResult.error);
  if (filtersResult.error) throw createServiceError("Failed to load platform filter analytics from Supabase.", filtersResult.error);
  if (notificationsResult.error) throw createServiceError("Failed to load platform notification analytics from Supabase.", notificationsResult.error);
  if (compareQueueResult.error) throw createServiceError("Failed to load platform compare analytics from Supabase.", compareQueueResult.error);
  if (aiArtifactsResult.error) throw createServiceError("Failed to load platform AI artifact analytics from Supabase.", aiArtifactsResult.error);
  if (dailyMetricsResult.error) throw createServiceError("Failed to load platform daily metrics from Supabase.", dailyMetricsResult.error);

  const listings = listingsResult.data ?? [];
  const categoryMap = new Map<string, number>();
  for (const listing of listings) {
    categoryMap.set(listing.category, (categoryMap.get(listing.category) ?? 0) + 1);
  }

  const totalFavorites = favoritesResult.count ?? 0;
  const totalConversations = conversationsResult.count ?? 0;
  const totalHolds = holdsResult.count ?? 0;
  const totalSchedules = schedulesResult.count ?? 0;
  const totalOffers = offersResult.count ?? 0;
  const totalSavedFilters = (filtersResult.data ?? []).length;
  const totalCompareQueueItems = compareQueueResult.count ?? 0;
  const dailyActivity = (dailyMetricsResult.data ?? [])
    .map((row: any) => ({
      date: String(row.day),
      listingsCreated: Number(row.listings_created ?? 0),
      notificationsCreated: Number(row.notifications_created ?? 0),
      reportsCreated: Number(row.reports_created ?? 0),
      aiArtifactsCreated: Number(row.ai_artifacts_created ?? 0),
      compareItemsAdded: Number(row.compare_items_added ?? 0),
      mediaAssetsCreated: Number(row.media_assets_created ?? 0),
    }))
    .sort((left, right) => left.date.localeCompare(right.date));

  return {
    totalProfiles: profilesResult.count ?? 0,
    activeListings: listings.filter((item: any) => item.status === "active").length,
    soldListings: listings.filter((item: any) => item.status === "sold").length,
    hiddenListings: listings.filter((item: any) => item.status === "hidden").length,
    suspendedListings: listings.filter((item: any) => item.status === "suspended").length,
    totalFavorites,
    totalConversations,
    totalSchedules,
    totalOffers,
    totalHolds,
    totalSavedFilters,
    totalCompareQueueItems,
    totalAiArtifacts: aiArtifactsResult.count ?? 0,
    alertEnabledFilters: (filtersResult.data ?? []).filter((item: any) => item.alert_enabled).length,
    unreadNotifications: (notificationsResult.data ?? []).filter((item: any) => !item.read_at).length,
    categoryBreakdown: [...categoryMap.entries()].map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count),
    featureUsage: [
      { feature: "favorites", count: totalFavorites },
      { feature: "conversations", count: totalConversations },
      { feature: "holds", count: totalHolds },
      { feature: "offers", count: totalOffers },
      { feature: "schedules", count: totalSchedules },
      { feature: "saved_filters", count: totalSavedFilters },
      { feature: "compare_queue", count: totalCompareQueueItems },
      { feature: "ai_artifacts", count: aiArtifactsResult.count ?? 0 },
      { feature: "media_assets", count: dailyActivity.reduce((sum, item) => sum + (item.mediaAssetsCreated ?? 0), 0) },
    ],
    funnel: {
      listings: listings.filter((item: any) => item.status === "active").length,
      favorites: totalFavorites,
      conversations: totalConversations,
      holds: totalHolds,
      sold: listings.filter((item: any) => item.status === "sold").length,
    },
    dailyActivity,
  };
}

export async function listListings(filters: ListingFilters = {}, viewerUser?: AuthUser) {
  const cacheKey = JSON.stringify({
    filters,
    viewer: viewerUser?.id ?? "guest",
  });
  const cached = readCache(listingCache, cacheKey);
  if (cached) {
    return cached;
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    const viewerProfileId = viewerUser ? ensureProfileForAuthUserInMemory(viewerUser).id : undefined;
    return listListingsInMemory(filters as any, viewerProfileId);
  }

  const viewerProfile = viewerUser ? await ensureProfileForAuthUser(viewerUser) : null;
  let query = supabase
    .from("listings")
    .select(LISTING_SUMMARY_SELECT)
    .in("status", [...PUBLIC_LISTING_STATUSES]);

  if (filters.search) query = query.ilike("title", `%${filters.search}%`);
  if (filters.category) query = query.eq("category", filters.category);
  if (filters.condition) query = query.eq("condition", filters.condition);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.mode) query = query.eq("mode", filters.mode);
  if (typeof filters.minPrice === "number") query = query.gte("price", filters.minPrice);
  if (typeof filters.maxPrice === "number") query = query.lte("price", filters.maxPrice);
  if (filters.negotiableOnly) query = query.eq("negotiable", true);
  if (filters.deliveryAvailable) query = query.contains("fulfillment_modes", ["campus-drop"]);

  if (filters.sort === "price_asc") query = query.order("price", { ascending: true });
  else if (filters.sort === "price_desc") query = query.order("price", { ascending: false });
  else if (filters.sort === "trust_desc") query = query.order("trust_score", { ascending: false });
  else query = query.order("created_at", { ascending: false });

  const { data, error } = await query.limit(filters.limit ?? 80);

  if (error) {
    throw createServiceError("Failed to load listings from Supabase.", error);
  }

  const listingIds = (data ?? []).map((row: any) => String(row.id));
  const [favoriteIds, holdMap] = await Promise.all([
    getFavoriteListingIdsForProfile(viewerProfile?.id, listingIds),
    getActiveHoldsForListings(listingIds),
  ]);

  const listings = (data ?? [])
    .map((row: any) => {
      const activeHold = holdMap.get(row.id) ?? null;
      const mapped = mapListingRow(row, favoriteIds.has(row.id), activeHold);
      if (activeHold && mapped.status === "active") {
        mapped.status = "reserved";
      }
      return mapped;
    })
    .filter((listing) => {
      if (!filters.status && listing.status === "sold") return false;
      if (!filters.status) return true;
      return listing.status === filters.status;
    });

  writeCache(listingCache, cacheKey, listings);
  return listings;
}

export async function getListingById(listingId: string, viewerUser?: AuthUser) {
  const supabase = getSupabaseAdminClient();
  const fallbackViewerProfileId = viewerUser ? ensureProfileForAuthUserInMemory(viewerUser).id : undefined;
  if (!supabase) {
    return getListingByIdInMemory(listingId, fallbackViewerProfileId);
  }

  let viewerProfile = null;
  if (viewerUser) {
    try {
      viewerProfile = await ensureProfileForAuthUser(viewerUser);
    } catch {
      viewerProfile = ensureProfileForAuthUserInMemory(viewerUser);
    }
  }

  const cacheKey = `${listingId}:${viewerProfile?.id || fallbackViewerProfileId || "guest"}`;
  const cached = readNullableCache(listingDetailCache, cacheKey);
  if (cached.hit) {
    return cached.data;
  }

  let data;
  try {
    const query = await supabase
      .from("listings")
      .select(LISTING_DETAIL_SELECT)
      .eq("id", listingId)
      .maybeSingle();
    if (query.error) {
      return getListingByIdInMemory(listingId, viewerProfile?.id || fallbackViewerProfileId);
    }
    data = query.data;
  } catch {
    return getListingByIdInMemory(listingId, viewerProfile?.id || fallbackViewerProfileId);
  }
  if (!data) return null;

  let isFavorited = false;
  if (viewerProfile) {
    const { data: favorite } = await supabase
      .from("favorites")
      .select("id")
      .eq("profile_id", viewerProfile.id)
      .eq("listing_id", listingId)
      .maybeSingle();
    isFavorited = !!favorite;
  }

  const holdMap = await getActiveHoldsForListings([listingId]);
  const activeHold = holdMap.get(listingId) ?? null;
  const mapped = mapListingRow(data, isFavorited, activeHold);
  const canViewNonPublicListing =
    !!viewerProfile && (viewerProfile.id === mapped.sellerProfileId || viewerProfile.role === "admin");
  if (NON_PUBLIC_LISTING_STATUSES.includes(mapped.status as (typeof NON_PUBLIC_LISTING_STATUSES)[number]) && !canViewNonPublicListing) {
    writeCache(listingDetailCache, cacheKey, null);
    return null;
  }
  if (activeHold && mapped.status === "active") {
    mapped.status = "reserved";
  }
  const [withMedia] = await attachMediaToListings([mapped]);
  writeCache(listingDetailCache, cacheKey, withMedia ?? null);
  return withMedia;
}

export async function getSellerProfileForListing(listingId: string) {
  const listing = await getListingById(listingId);
  return (listing as any)?.seller ?? getSellerProfileForListingInMemory(listingId);
}

export async function getPublicProfileById(profileId: string) {
  const cached = readNullableCache(publicProfileCache, profileId);
  if (cached.hit) {
    return cached.data;
  }
  const getFallbackProfile = () => {
    const fallbackListing = listListingsInMemory({}, undefined).find(
      (listing: any) => listing.seller?.id === profileId,
    );
    return fallbackListing?.seller ?? null;
  };

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    const fallback = getFallbackProfile();
    writeCache(publicProfileCache, profileId, fallback);
    return fallback;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", profileId)
    .maybeSingle();

  if (error || !data) {
    const fallback = getFallbackProfile();
    writeCache(publicProfileCache, profileId, fallback);
    return fallback;
  }

  const { count } = await supabase
    .from("listings")
    .select("*", { count: "exact", head: true })
    .eq("seller_profile_id", profileId);

  const publicProfile = toPublicProfile(
    mapProfileRecord(data),
    count ?? 0,
  );
  writeCache(publicProfileCache, profileId, publicProfile);
  return publicProfile;
}

async function getPublicProfilesByIds(profileIds: string[]) {
  const uniqueIds = [...new Set((profileIds ?? []).map((item) => String(item || "").trim()).filter(Boolean))];
  const profileMap = new Map<string, PublicProfile | null>();

  if (!uniqueIds.length) {
    return profileMap;
  }

  const missingIds: string[] = [];
  for (const profileId of uniqueIds) {
    const cached = readNullableCache(publicProfileCache, profileId);
    if (cached.hit) {
      profileMap.set(profileId, cached.data);
    } else {
      missingIds.push(profileId);
    }
  }

  if (!missingIds.length) {
    return profileMap;
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    await Promise.all(
      missingIds.map(async (profileId) => {
        profileMap.set(profileId, await getPublicProfileById(profileId));
      }),
    );
    return profileMap;
  }

  const [{ data: profileRows, error: profileError }, { data: listingRows, error: listingError }] = await Promise.all([
    supabase.from("profiles").select("*").in("id", missingIds),
    supabase.from("listings").select("seller_profile_id").in("seller_profile_id", missingIds),
  ]);

  if (profileError || listingError) {
    await Promise.all(
      missingIds.map(async (profileId) => {
        profileMap.set(profileId, await getPublicProfileById(profileId));
      }),
    );
    return profileMap;
  }

  const listingCountByProfileId = new Map<string, number>();
  for (const row of listingRows ?? []) {
    const profileId = String((row as { seller_profile_id?: string }).seller_profile_id || "");
    if (!profileId) continue;
    listingCountByProfileId.set(profileId, (listingCountByProfileId.get(profileId) ?? 0) + 1);
  }

  for (const row of profileRows ?? []) {
    const mapped = toPublicProfile(
      mapProfileRecord(row),
      listingCountByProfileId.get(row.id) ?? 0,
    );
    writeCache(publicProfileCache, row.id, mapped);
    profileMap.set(row.id, mapped);
  }

  for (const profileId of missingIds) {
    if (!profileMap.has(profileId)) {
      writeCache(publicProfileCache, profileId, null);
      profileMap.set(profileId, null);
    }
  }

  return profileMap;
}

async function findConversationForListing(
  listingId: string,
  user: AuthUser,
  options?: { actorProfileId?: string; sellerProfileId?: string },
) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return null;
  const actorProfileId = options?.actorProfileId ?? (await ensureProfileForAuthUser(user)).id;
  let sellerId = options?.sellerProfileId || "";
  if (!sellerId) {
    const listing = await getListingById(listingId, user);
    if (!listing) return null;
    sellerId = listing.sellerProfileId;
  }

  if (actorProfileId === sellerId) {
    const { data: sellerConversation, error: sellerConversationError } = await supabase
      .from("conversations")
      .select("*")
      .eq("listing_id", listingId)
      .eq("seller_profile_id", sellerId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (sellerConversationError) {
      throw createServiceError("Failed to inspect seller conversation in Supabase.", sellerConversationError);
    }
    return sellerConversation ?? null;
  }

  const { data: existingConversation, error: existingConversationError } = await supabase
    .from("conversations")
    .select("*")
    .eq("listing_id", listingId)
    .eq("buyer_profile_id", actorProfileId)
    .eq("seller_profile_id", sellerId)
    .maybeSingle();

  if (existingConversationError) {
    throw createServiceError("Failed to inspect existing conversation in Supabase.", existingConversationError);
  }

  return existingConversation ?? null;
}

async function ensureConversationForListing(listingId: string, user: AuthUser) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return null;
  const actor = await ensureProfileForAuthUser(user);
  const listing = await getListingById(listingId, user);
  if (!listing) return null;

  const sellerId = listing.sellerProfileId;
  const existingConversation = await findConversationForListing(listingId, user, {
    actorProfileId: actor.id,
    sellerProfileId: sellerId,
  });
  if (actor.id === sellerId) {
    return existingConversation;
  }

  const buyerId = actor.id;
  if (existingConversation) return existingConversation;

  const { data: newConversation, error: conversationInsertError } = await supabase
    .from("conversations")
    .insert({
      listing_id: listingId,
      buyer_profile_id: buyerId,
      seller_profile_id: sellerId,
    })
    .select("*")
    .single();

  if (conversationInsertError || !newConversation) {
    throw createServiceError("Failed to create conversation in Supabase.", conversationInsertError);
  }

  return newConversation;
}

async function expireActiveHoldsForListings(listingIds: string[]) {
  const supabase = getSupabaseAdminClient();
  if (!supabase || !listingIds.length) return;

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("listing_holds")
    .update({
      status: "expired",
      updated_at: now,
    })
    .in("listing_id", listingIds)
    .eq("status", "active")
    .lt("expires_at", now);

  if (error) {
    throw createServiceError("Failed to expire stale holds in Supabase.", error);
  }
}

async function getActiveHoldsForListings(listingIds: string[]) {
  const supabase = getSupabaseAdminClient();
  if (!supabase || !listingIds.length) return new Map<string, ListingHold>();

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("listing_holds")
    .select("*")
    .in("listing_id", listingIds)
    .eq("status", "active")
    .gte("expires_at", now);

  if (error) {
    throw createServiceError("Failed to load active holds from Supabase.", error);
  }

  return new Map(
    (data ?? []).map((row: any) => {
      const hold = mapHoldRow(row);
      return [hold.listingId, hold] as const;
    }),
  );
}

export async function listListingsBySeller(profileId: string, viewerUser?: AuthUser) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    const all = await listListings({}, viewerUser);
    return all.filter((listing) => listing.sellerProfileId === profileId);
  }

  const viewerProfile = viewerUser ? await ensureProfileForAuthUser(viewerUser) : null;
  const { data, error } = await supabase
    .from("listings")
    .select("*, seller_profile:profiles!listings_seller_profile_id_fkey(*)")
    .eq("seller_profile_id", profileId)
    .order("created_at", { ascending: false });

  if (error) {
    throw createServiceError("Failed to load seller listings from Supabase.", error);
  }
  if (!data?.length) {
    return [];
  }

  let favoriteIds = new Set<string>();
  if (viewerProfile) {
    const { data: favorites } = await supabase
      .from("favorites")
      .select("listing_id")
      .eq("profile_id", viewerProfile.id);
    favoriteIds = new Set((favorites ?? []).map((favorite: any) => favorite.listing_id));
  }

  const holdMap = await getActiveHoldsForListings((data ?? []).map((row: any) => row.id));
  const listings = data.map((row: any) => {
    const activeHold = holdMap.get(row.id) ?? null;
    const mapped = mapListingRow(row, favoriteIds.has(row.id), activeHold);
    if (activeHold && mapped.status === "active") {
      mapped.status = "reserved";
    }
    return mapped;
  });
  return attachMediaToListings(listings);
}

export async function listOwnListings(user: AuthUser) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return listOwnListingsInMemory(user);
  const profile = await ensureProfileForAuthUser(user);
  const { data, error } = await supabase
    .from("listings")
    .select("*, seller_profile:profiles!listings_seller_profile_id_fkey(*)")
    .eq("seller_profile_id", profile.id)
    .order("created_at", { ascending: false });

  if (error) throw createServiceError("Failed to load your listings from Supabase.", error);
  const holdMap = await getActiveHoldsForListings((data ?? []).map((row: any) => row.id));
  const listings = (data ?? []).map((row: any) => {
    const activeHold = holdMap.get(row.id) ?? null;
    const mapped = mapListingRow(row, false, activeHold);
    if (activeHold && mapped.status === "active") {
      mapped.status = "reserved";
    }
    return mapped;
  });
  return attachMediaToListings(listings);
}

async function resolveMediaUrlsForListingWrite(
  user: AuthUser,
  mediaAssetIds: string[] | undefined,
  fallbackUrls: string[],
  listingId?: string,
) {
  const supabase = getSupabaseAdminClient();
  if (!supabase || !mediaAssetIds?.length) {
    return fallbackUrls;
  }

  const profile = await ensureProfileForAuthUser(user);
  const uniqueIds = [...new Set(mediaAssetIds.map((id) => String(id).trim()).filter(Boolean))].slice(0, 7);
  if (!uniqueIds.length) return fallbackUrls;

  const { data, error } = await supabase
    .from("listing_media_assets")
    .select("*")
    .in("id", uniqueIds)
    .eq("owner_profile_id", profile.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw createServiceError("Failed to resolve listing media assets for write.", error);
  const rows = data ?? [];
  if (!rows.length) return fallbackUrls;

  const { error: updateError } = await supabase
    .from("listing_media_assets")
    .update({
      listing_id: listingId ?? null,
      upload_status: "ready",
      updated_at: new Date().toISOString(),
    })
    .in("id", uniqueIds)
    .eq("owner_profile_id", profile.id);

  if (updateError) throw createServiceError("Failed to bind media assets to listing.", updateError);
  return rows.map((row: any) => row.public_url);
}

export async function createListing(input: ListingWriteInput, user: AuthUser) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return createListingInMemory(input as any, user);
  const profile = await ensureProfileForAuthUser(user);
  const resolvedImageUrls = await resolveMediaUrlsForListingWrite(user, input.mediaAssetIds, input.imageUrls);
  const payload = {
    sellerProfileId: profile.id,
    title: input.title,
    description: input.description,
    price: input.price,
    inventoryCount: input.inventoryCount ?? 1,
    currency: "INR",
    category: input.category,
    condition: input.condition,
    status: input.status ?? "active",
    mode: input.mode ?? "sale",
    negotiable: input.negotiable,
    fulfillmentModes: input.fulfillmentModes,
    area: input.area,
    campusId: profile.campusId,
    imageUrls: resolvedImageUrls,
    tags: input.tags,
    rentDetails: input.rentDetails ?? null,
    bundleDetails: input.bundleDetails ?? null,
    listingMetadata: input.listingMetadata ?? {},
    completenessScore: computeListingCompleteness({
      title: input.title,
      description: input.description,
      imageUrls: resolvedImageUrls,
      tags: input.tags,
      area: input.area,
    } as Listing),
  };

  const { data, error } = await supabase.rpc("app_create_listing_text", {
    p_payload_text: JSON.stringify(payload),
  });

  if (error || !data) throw createServiceError("Failed to create listing in Supabase.", error);
  invalidateListingCaches();
  await resolveMediaUrlsForListingWrite(user, input.mediaAssetIds, resolvedImageUrls, String(data));
  const created = await getListingById(String(data), user);

  if (created && created.status === "active") {
    const savedFilterResult = await supabase
      .from("saved_filters")
      .select("id, profile_id, label, filter_payload, alert_enabled")
      .neq("profile_id", profile.id);

    if (!savedFilterResult.error && savedFilterResult.data?.length) {
      const matchingFilters = savedFilterResult.data.filter((item: any) => {
        if (!item.alert_enabled) return false;
        return listingMatchesFilterPayload(created, item.filter_payload ?? {});
      });

      if (matchingFilters.length) {
        await createNotifications(
          matchingFilters.map((item: any) => ({
            profileId: item.profile_id,
            type: "saved_search_match" as const,
            category: "buying" as const,
            priority: "medium" as const,
            title: `New match for "${item.label}"`,
            body: `${created.title} matches one of your saved campus searches.`,
            entityType: "listing" as const,
            entityId: created.id,
            actionLabel: "View match",
            actionHref: `/listings/${created.id}`,
            metadata: {
              listingTitle: created.title,
              filterId: item.id,
              filterLabel: item.label,
            },
          })),
        );

        const matchingIds = matchingFilters.map((item: any) => item.id);
        let updateResult = await supabase
          .from("saved_filters")
          .update({ last_triggered_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .in("id", matchingIds);
        if (updateResult.error?.message?.includes("last_triggered_at") || updateResult.error?.message?.includes("updated_at")) {
          updateResult = await supabase.from("saved_filters").update({}).in("id", matchingIds);
        }
      }
    }
  }

  return created;
}

export async function updateListing(listingId: string, input: Partial<ListingWriteInput>, user: AuthUser) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return updateListingInMemory(listingId, input as any, user);
  const profile = await ensureProfileForAuthUser(user);
  const existing = await getListingById(listingId, user);
  if (!existing) return null;
  if (existing.sellerProfileId !== profile.id && user.role !== "admin") throw new Error("FORBIDDEN");

  const nextImageUrls =
    input.mediaAssetIds !== undefined
      ? await resolveMediaUrlsForListingWrite(user, input.mediaAssetIds, input.imageUrls ?? existing.imageUrls, listingId)
      : input.imageUrls;

  const patchPayload = {
    ...input,
    imageUrls: nextImageUrls,
  };

  const { data, error } = await supabase.rpc("app_update_listing_text", {
    p_listing_id: listingId,
    p_patch_text: JSON.stringify(patchPayload),
  });

  if (error || !data) throw createServiceError("Failed to update listing in Supabase.", error);
  invalidateListingCaches();
  const updated = await getListingById(String(data), user);

  if (updated && existing.status !== "sold" && updated.status === "sold") {
    const { data: favoriteProfiles, error: favoritesError } = await supabase
      .from("favorites")
      .select("profile_id")
      .eq("listing_id", listingId);

    if (favoritesError) {
      throw createServiceError("Failed to load saved-listing followers for sold notifications.", favoritesError);
    }

    const sellerName = updated.seller?.fullName || profile.fullName;
    const notificationTargets = [...new Set((favoriteProfiles ?? []).map((row: any) => row.profile_id))]
      .filter((profileId: string) => profileId !== updated.sellerProfileId);

    await createNotifications(
      notificationTargets.map((profileId: string) => ({
        profileId,
        type: "listing_sold" as const,
        category: "buying" as const,
        priority: "high" as const,
        title: `${updated.title} was marked sold`,
        body: `${sellerName} has marked this saved listing as sold. Browse similar listings or compare alternatives.`,
        entityType: "listing" as const,
        entityId: updated.id,
        actionLabel: "View alternatives",
        actionHref: `/marketplace?search=${encodeURIComponent(updated.title)}`,
        metadata: {
          listingTitle: updated.title,
          sellerName,
          status: updated.status,
        },
      })),
    );
  } else if (updated) {
    const significantChange =
      existing.price !== updated.price ||
      existing.title !== updated.title ||
      existing.area !== updated.area ||
      existing.condition !== updated.condition ||
      existing.negotiable !== updated.negotiable;

    if (significantChange) {
      const { data: favoriteProfiles } = await supabase
        .from("favorites")
        .select("profile_id")
        .eq("listing_id", listingId);

      const notificationTargets = [...new Set((favoriteProfiles ?? []).map((row: any) => row.profile_id))]
        .filter((profileId: string) => profileId !== updated.sellerProfileId);

      if (notificationTargets.length) {
        await createNotifications(
          notificationTargets.map((profileId: string) => ({
            profileId,
            type: "listing_updated" as const,
            category: "buying" as const,
            priority: "medium" as const,
            title: `${updated.title} was updated`,
            body:
              existing.price !== updated.price
                ? `A saved listing changed price to ₹${updated.price}.`
                : "A saved listing changed materially. Review the latest details before buying.",
            entityType: "listing" as const,
            entityId: updated.id,
            actionLabel: "Review listing",
            actionHref: `/listings/${updated.id}`,
            metadata: {
              listingTitle: updated.title,
              previousPrice: existing.price,
              nextPrice: updated.price,
            },
          })),
        );
      }
    }
  }

  return updated;
}

export async function archiveListing(listingId: string, user: AuthUser) {
  return updateListing(listingId, { status: "hidden" }, user);
}

export async function markListingSold(listingId: string, user: AuthUser) {
  return updateListing(listingId, { status: "sold" }, user);
}

export async function relistListing(listingId: string, user: AuthUser) {
  const existing = await getListingById(listingId, user);
  if (!existing) return null;
  if (existing.status === "suspended" && user.role !== "admin") {
    throw new Error("FORBIDDEN");
  }
  return updateListing(listingId, { status: "active" }, user);
}

export async function duplicateListing(listingId: string, user: AuthUser) {
  const existing = await getListingById(listingId, user);
  if (!existing) return null;
  const profile = await ensureProfileForAuthUser(user);
  if (existing.sellerProfileId !== profile.id && user.role !== "admin") {
    throw new Error("FORBIDDEN");
  }

  return createListing(
    {
      title: `${existing.title} (Copy)`,
      description: existing.description,
      price: existing.price,
      inventoryCount: existing.inventoryCount,
      category: existing.category,
      condition: existing.condition,
      negotiable: existing.negotiable,
      fulfillmentModes: existing.fulfillmentModes,
      area: existing.area,
      imageUrls: existing.imageUrls,
      tags: existing.tags,
      status: "draft",
      mode: existing.mode ?? "sale",
      rentDetails: existing.rentDetails,
      bundleDetails: existing.bundleDetails,
      listingMetadata: existing.listingMetadata,
    },
    user,
  );
}

export async function deleteListing(listingId: string, user: AuthUser) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return deleteListingInMemory(listingId, user);
  const profile = await ensureProfileForAuthUser(user);
  const existing = await getListingById(listingId, user);
  if (!existing) return false;
  if (existing.sellerProfileId !== profile.id && user.role !== "admin") throw new Error("FORBIDDEN");

  const { data: favoriteProfiles } = await supabase
    .from("favorites")
    .select("profile_id")
    .eq("listing_id", listingId);

  const { error } = await supabase.from("listings").delete().eq("id", listingId);
  if (error) throw createServiceError("Failed to delete listing in Supabase.", error);

  await createNotifications(
    [...new Set((favoriteProfiles ?? []).map((row: any) => row.profile_id))]
      .filter((profileId: string) => profileId !== existing.sellerProfileId)
      .map((profileId: string) => ({
        profileId,
        type: "listing_deleted" as const,
        title: `${existing.title} is no longer available`,
        body: "A listing you saved was removed by the seller. Check similar listings for alternatives.",
        entityType: "listing" as const,
        entityId: existing.id,
        metadata: {
          listingTitle: existing.title,
        },
      })),
  );
  invalidateListingCaches();
  return true;
}

export async function favoriteListing(listingId: string, user: AuthUser) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return favoriteListingInMemory(listingId, user);
  const profile = await ensureProfileForAuthUser(user);
  const { data, error } = await supabase
    .from("favorites")
    .upsert({ listing_id: listingId, profile_id: profile.id }, { onConflict: "profile_id,listing_id" })
    .select("*")
    .single();

  if (error || !data) throw createServiceError("Failed to favorite listing in Supabase.", error);
  invalidateListingCaches();
  return {
    id: data.id,
    listingId: data.listing_id,
    profileId: data.profile_id,
    createdAt: data.created_at,
  };
}

export async function unfavoriteListing(listingId: string, user: AuthUser) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return unfavoriteListingInMemory(listingId, user);
  const profile = await ensureProfileForAuthUser(user);
  const { error, count } = await supabase
    .from("favorites")
    .delete({ count: "exact" })
    .eq("profile_id", profile.id)
    .eq("listing_id", listingId);

  if (error) throw createServiceError("Failed to unfavorite listing in Supabase.", error);
  invalidateListingCaches();
  return (count ?? 0) > 0;
}

export async function listFavoriteListings(user: AuthUser) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return listFavoriteListingsInMemory(user);
  const profile = await ensureProfileForAuthUser(user);
  const { data, error } = await supabase
    .from("favorites")
    .select("listing_id, listings(*, seller_profile:profiles!listings_seller_profile_id_fkey(*))")
    .eq("profile_id", profile.id);

  if (error) throw createServiceError("Failed to load favorite listings from Supabase.", error);
  if (!data?.length) return [];
  return attachMediaToListings(data.map((row: any) => mapListingRow(row.listings, true)));
}

export async function reportListing(listingId: string, user: AuthUser, reason: string, details?: string) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return reportListingInMemory(listingId, user, reason as any, details);
  const profile = await ensureProfileForAuthUser(user);
  const severity =
    reason === "fraudulent_listing" || reason === "prohibited_item"
      ? "high"
      : reason === "suspicious_payment_request" || reason === "impersonation"
        ? "medium"
        : "low";

  const { data, error } = await supabase
    .from("reports")
    .insert({
      target_type: "listing",
      target_id: listingId,
      reporter_profile_id: profile.id,
      reason,
      details,
      status: "open",
      severity,
    })
    .select("*")
    .single();

  if (error || !data) throw createServiceError("Failed to create report in Supabase.", error);
  return {
    id: data.id,
    targetType: data.target_type,
    targetId: data.target_id,
    reporterProfileId: data.reporter_profile_id,
    reason: data.reason,
    details: data.details,
    status: data.status,
    severity: data.severity,
    createdAt: data.created_at,
  };
}

async function getOrCreateCart(profileId: string): Promise<Cart> {
  const supabase = getCartSupabaseClient();
  if (!supabase) {
    return getFallbackCartState(profileId).cart;
  }

  const existingResult = await runCartSupabaseQuery("loading cart", () =>
    supabase
      .from("carts")
      .select("*")
      .eq("profile_id", profileId)
      .eq("status", "active")
      .maybeSingle(),
  );
  if (!existingResult) {
    return getFallbackCartState(profileId).cart;
  }

  const { data: existing, error: existingError } = existingResult;

  if (existingError) {
    disableCartPersistence("loading cart", existingError);
    return getFallbackCartState(profileId).cart;
  }

  if (existing) {
    return {
      id: existing.id,
      profileId: existing.profile_id,
      status: existing.status,
      createdAt: existing.created_at,
      updatedAt: existing.updated_at,
    };
  }

  const createResult = await runCartSupabaseQuery("creating cart", () =>
    supabase
      .from("carts")
      .insert({ profile_id: profileId, status: "active" })
      .select("*")
      .single(),
  );
  if (!createResult) {
    return getFallbackCartState(profileId).cart;
  }

  const { data, error } = createResult;

  if (error || !data) {
    disableCartPersistence("creating cart", error);
    return getFallbackCartState(profileId).cart;
  }

  return {
    id: data.id,
    profileId: data.profile_id,
    status: data.status,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function listCart(user: AuthUser): Promise<CartView> {
  const profile = await ensureProfileForAuthUser(user);
  const supabase = getCartSupabaseClient();
  const cart = await getOrCreateCart(profile.id);

  if (!supabase) {
    const local = getFallbackCartState(profile.id, cart);
    const items = await Promise.all(
      local.items.map(async (item) => ({
        id: item.id,
        quantity: item.quantity,
        listing: toCartListingSnapshot((await getListingById(item.listingId, user)) as any),
      })),
    );
    return {
      cart,
      items,
      totalAmount: items.reduce((sum: number, item) => sum + (item.listing?.price || 0) * item.quantity, 0),
      sellerBreakdown: buildSellerBreakdown(items),
    };
  }

  const itemsResult = await runCartSupabaseQuery("loading cart items", () =>
    supabase
      .from("cart_items")
      .select("id, quantity, listing_id, listings(*, seller_profile:profiles!listings_seller_profile_id_fkey(*))")
      .eq("cart_id", cart.id),
  );
  if (!itemsResult) {
    const local = getFallbackCartState(profile.id, cart);
    const items = await Promise.all(
      local.items.map(async (item) => ({
        id: item.id,
        quantity: item.quantity,
        listing: toCartListingSnapshot((await getListingById(item.listingId, user)) as any),
      })),
    );
    return {
      cart: local.cart,
      items,
      totalAmount: items.reduce((sum: number, item) => sum + (item.listing?.price || 0) * item.quantity, 0),
      sellerBreakdown: buildSellerBreakdown(items),
    };
  }

  const { data, error } = itemsResult;
  if (error) {
    disableCartPersistence("loading cart items", error);
    const local = getFallbackCartState(profile.id, cart);
    const items = await Promise.all(
      local.items.map(async (item) => ({
        id: item.id,
        quantity: item.quantity,
        listing: toCartListingSnapshot((await getListingById(item.listingId, user)) as any),
      })),
    );
    return {
      cart: local.cart,
      items,
      totalAmount: items.reduce((sum, item) => sum + (item.listing?.price || 0) * item.quantity, 0),
      sellerBreakdown: buildSellerBreakdown(items),
    };
  }

  const items =
    data?.map((row: any) => ({
      id: row.id,
      quantity: row.quantity,
      listing: row.listings ? toCartListingSnapshot(mapListingRow(row.listings, false)) : null,
    })) ?? [];

  return {
    cart,
    items,
    totalAmount: items.reduce((sum, item) => sum + (item.listing?.price || 0) * item.quantity, 0),
    sellerBreakdown: buildSellerBreakdown(items),
  };
}

export async function addCartItem(user: AuthUser, listingId: string, quantity = 1) {
  const profile = await ensureProfileForAuthUser(user);
  const supabase = getCartSupabaseClient();
  const cart = await getOrCreateCart(profile.id);
  const listing = await getListingById(listingId, user);

  if (!listing) {
    throw createServiceError("Listing could not be found.");
  }

  if (listing.status === "sold" || listing.status === "draft" || listing.status === "hidden" || listing.status === "suspended") {
    throw createServiceError("This listing is not available for cart actions right now.");
  }

  const maxQuantity = Math.max(1, Number(listing.inventoryCount || 1));

  if (!supabase) {
    const local = getFallbackCartState(profile.id, cart);
    const existing = local.items.find((item) => item.listingId === listingId);
    if (existing) {
      existing.quantity = Math.min(existing.quantity + quantity, maxQuantity);
    } else {
      local.items.push({
        id: `cart-item-${randomUUID()}`,
        listingId,
        quantity: Math.min(quantity, maxQuantity),
        createdAt: new Date().toISOString(),
      });
    }
    fallbackCarts.set(profile.id, local);
    return listCart(user);
  }

  const existingResult = await runCartSupabaseQuery("inspecting cart item", () =>
    supabase
      .from("cart_items")
      .select("*")
      .eq("cart_id", cart.id)
      .eq("listing_id", listingId)
      .maybeSingle(),
  );
  if (!existingResult) {
    const local = getFallbackCartState(profile.id, cart);
    const existing = local.items.find((item) => item.listingId === listingId);
    if (existing) {
      existing.quantity = Math.min(existing.quantity + quantity, maxQuantity);
    } else {
      local.items.push({
        id: `cart-item-${randomUUID()}`,
        listingId,
        quantity: Math.min(quantity, maxQuantity),
        createdAt: new Date().toISOString(),
      });
    }
    fallbackCarts.set(profile.id, local);
    return listCart(user);
  }

  const { data: existing, error: existingError } = existingResult;
  if (existingError) {
    disableCartPersistence("inspecting cart item", existingError);
    const local = getFallbackCartState(profile.id, cart);
    const fallbackExisting = local.items.find((item) => item.listingId === listingId);
    if (fallbackExisting) {
      fallbackExisting.quantity = Math.min(fallbackExisting.quantity + quantity, maxQuantity);
    } else {
      local.items.push({
        id: `cart-item-${randomUUID()}`,
        listingId,
        quantity: Math.min(quantity, maxQuantity),
        createdAt: new Date().toISOString(),
      });
    }
    fallbackCarts.set(profile.id, local);
    return listCart(user);
  }

  if (existing) {
    const nextQuantity = Math.min(existing.quantity + quantity, maxQuantity);
    const updateResult = await runCartSupabaseQuery("updating cart item", () =>
      supabase
        .from("cart_items")
        .update({ quantity: nextQuantity })
        .eq("id", existing.id),
    );
    if (!updateResult || updateResult.error) {
      disableCartPersistence("updating cart item", updateResult?.error);
      const local = getFallbackCartState(profile.id, cart);
      const fallbackExisting = local.items.find((item) => item.listingId === listingId);
      if (fallbackExisting) {
        fallbackExisting.quantity = nextQuantity;
      } else {
        local.items.push({
          id: `cart-item-${randomUUID()}`,
          listingId,
          quantity: nextQuantity,
          createdAt: new Date().toISOString(),
        });
      }
      fallbackCarts.set(profile.id, local);
      return listCart(user);
    }
  } else {
    const insertResult = await runCartSupabaseQuery("adding cart item", () =>
      supabase
        .from("cart_items")
        .insert({ cart_id: cart.id, listing_id: listingId, quantity: Math.min(quantity, maxQuantity) }),
    );
    if (!insertResult || insertResult.error) {
      disableCartPersistence("adding cart item", insertResult?.error);
      const local = getFallbackCartState(profile.id, cart);
      local.items.push({
        id: `cart-item-${randomUUID()}`,
        listingId,
        quantity: Math.min(quantity, maxQuantity),
        createdAt: new Date().toISOString(),
      });
      fallbackCarts.set(profile.id, local);
      return listCart(user);
    }
  }

  const cartTouchResult = await runCartSupabaseQuery("touching cart timestamp", () =>
    supabase
      .from("carts")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", cart.id),
  );
  if (!cartTouchResult || cartTouchResult.error) {
    disableCartPersistence("touching cart timestamp", cartTouchResult?.error);
  }
  return listCart(user);
}

export async function updateCartItemQuantity(user: AuthUser, cartItemId: string, quantity: number) {
  const profile = await ensureProfileForAuthUser(user);
  const supabase = getCartSupabaseClient();
  const cart = await getOrCreateCart(profile.id);

  if (!supabase) {
    const local = fallbackCarts.get(profile.id);
    if (!local) {
      return listCart(user);
    }
    const target = local.items.find((item) => item.id === cartItemId || item.listingId === cartItemId);
    if (!target) {
      return listCart(user);
    }
    const listing = await getListingById(target.listingId, user);
    const maxQuantity = Math.max(1, Number(listing?.inventoryCount || 1));
    target.quantity = Math.min(Math.max(1, quantity), maxQuantity);
    fallbackCarts.set(profile.id, local);
    return listCart(user);
  }

  const lookupResult = await runCartSupabaseQuery("locating cart item", () =>
    supabase
      .from("cart_items")
      .select("id, listing_id")
      .eq("cart_id", cart.id)
      .or(`id.eq.${cartItemId},listing_id.eq.${cartItemId}`)
      .maybeSingle(),
  );
  if (!lookupResult) {
    return listCart(user);
  }
  if (lookupResult.error) {
    disableCartPersistence("locating cart item", lookupResult.error);
    return listCart(user);
  }
  if (!lookupResult.data) throw createServiceError("Cart item not found.");
  const targetItem = lookupResult.data;

  const listing = await getListingById(targetItem.listing_id, user);
  const maxQuantity = Math.max(1, Number(listing?.inventoryCount || 1));
  const nextQuantity = Math.min(Math.max(1, quantity), maxQuantity);

  const updateResult = await runCartSupabaseQuery("updating cart quantity", () =>
    supabase
      .from("cart_items")
      .update({ quantity: nextQuantity })
      .eq("id", targetItem.id),
  );
  if (!updateResult || updateResult.error) {
    disableCartPersistence("updating cart quantity", updateResult?.error);
    return listCart(user);
  }

  const cartTouchResult = await runCartSupabaseQuery("touching cart timestamp", () =>
    supabase
      .from("carts")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", cart.id),
  );
  if (!cartTouchResult || cartTouchResult.error) {
    disableCartPersistence("touching cart timestamp", cartTouchResult?.error);
  }

  return listCart(user);
}

export async function removeCartItem(user: AuthUser, cartItemId: string) {
  const profile = await ensureProfileForAuthUser(user);
  const supabase = getCartSupabaseClient();
  const cart = await getOrCreateCart(profile.id);

  if (!supabase) {
    const local = fallbackCarts.get(profile.id);
    if (!local) return false;
    const before = local.items.length;
    local.items = local.items.filter((item) => item.id !== cartItemId && item.listingId !== cartItemId);
    fallbackCarts.set(profile.id, local);
    return before !== local.items.length;
  }

  const removeResult = await runCartSupabaseQuery("removing cart item", () =>
    supabase
      .from("cart_items")
      .delete({ count: "exact" })
      .eq("cart_id", cart.id)
      .or(`id.eq.${cartItemId},listing_id.eq.${cartItemId}`),
  );
  if (!removeResult) {
    const local = fallbackCarts.get(profile.id);
    if (!local) return false;
    const before = local.items.length;
    local.items = local.items.filter((item) => item.id !== cartItemId && item.listingId !== cartItemId);
    fallbackCarts.set(profile.id, local);
    return before !== local.items.length;
  }
  if (removeResult.error) {
    disableCartPersistence("removing cart item", removeResult.error);
    const local = fallbackCarts.get(profile.id);
    if (!local) return false;
    const before = local.items.length;
    local.items = local.items.filter((item) => item.id !== cartItemId && item.listingId !== cartItemId);
    fallbackCarts.set(profile.id, local);
    return before !== local.items.length;
  }

  const cartTouchResult = await runCartSupabaseQuery("touching cart timestamp", () =>
    supabase
      .from("carts")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", cart.id),
  );
  if (!cartTouchResult || cartTouchResult.error) {
    disableCartPersistence("touching cart timestamp", cartTouchResult?.error);
  }
  return (removeResult.count ?? 0) > 0;
}

export async function clearCart(user: AuthUser) {
  const profile = await ensureProfileForAuthUser(user);
  const supabase = getCartSupabaseClient();
  const cart = await getOrCreateCart(profile.id);
  if (!supabase) {
    fallbackCarts.set(profile.id, { cart, items: [] });
    return true;
  }

  const clearResult = await runCartSupabaseQuery("clearing cart items", () =>
    supabase.from("cart_items").delete().eq("cart_id", cart.id),
  );
  if (!clearResult || clearResult.error) {
    disableCartPersistence("clearing cart items", clearResult?.error);
    fallbackCarts.set(profile.id, { cart: getFallbackCartState(profile.id, cart).cart, items: [] });
    return true;
  }

  const cartTouchResult = await runCartSupabaseQuery("touching cart timestamp", () =>
    supabase
      .from("carts")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", cart.id),
  );
  if (!cartTouchResult || cartTouchResult.error) {
    disableCartPersistence("touching cart timestamp", cartTouchResult?.error);
  }
  return true;
}

export async function simulateCheckout(user: AuthUser) {
  const cartView = await listCart(user);
  return {
    orderCount: cartView.items.length,
    totalAmount: cartView.totalAmount,
    sellerSettlements: cartView.sellerBreakdown,
    paymentMode: "grouped-checkout-simulator",
    note: "Checkout remains simulated until payment orchestration is added, but seller grouping and totals are now derived from persisted cart state.",
  };
}

export async function listConversations(user: AuthUser): Promise<ConversationView[]> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return listConversationsInMemory(user) as any;
  const profile = await ensureProfileForAuthUser(user);

  const { data, error } = await supabase
    .from("conversations")
    .select("*, listing:listings(*, seller_profile:profiles!listings_seller_profile_id_fkey(*))")
    .or(`buyer_profile_id.eq.${profile.id},seller_profile_id.eq.${profile.id}`)
    .order("updated_at", { ascending: false });

  if (error) throw createServiceError("Failed to load conversations from Supabase.", error);
  if (!data) return [];

  const rows = data ?? [];
  if (!rows.length) return [];
  const conversationIds = rows.map((conversation: any) => conversation.id);
  const holdMap = await getActiveHoldsForListings(rows.map((conversation: any) => conversation.listing_id));
  const participantIds = rows.map((conversation: any) =>
    conversation.buyer_profile_id === profile.id ? conversation.seller_profile_id : conversation.buyer_profile_id,
  );
  const { data: messageRows, error: messageError } = await supabase
    .from("messages")
    .select("id, conversation_id, sender_profile_id, text, created_at, risk_flags")
    .in("conversation_id", conversationIds)
    .order("created_at", { ascending: false });

  if (messageError) {
    throw createServiceError("Failed to load conversation previews from Supabase.", messageError);
  }

  const latestMessageByConversationId = new Map<string, any>();
  for (const row of messageRows ?? []) {
    if (!latestMessageByConversationId.has(row.conversation_id)) {
      latestMessageByConversationId.set(row.conversation_id, row);
    }
  }

  const senderIds = [...new Set((messageRows ?? []).map((row: any) => row.sender_profile_id).filter(Boolean))];
  const [participantMap, senderMap] = await Promise.all([
    getPublicProfilesByIds(participantIds),
    getPublicProfilesByIds(senderIds),
  ]);

  return rows.map((conversation: any) => {
    const participantId =
      conversation.buyer_profile_id === profile.id
        ? conversation.seller_profile_id
        : conversation.buyer_profile_id;
    const lastMessageRow = latestMessageByConversationId.get(conversation.id) ?? null;
    const parsedLastMessage = lastMessageRow ? parseSystemMessage(lastMessageRow.text, lastMessageRow.risk_flags ?? []) : null;

    return {
      id: conversation.id,
      listingId: conversation.listing_id,
      buyerProfileId: conversation.buyer_profile_id,
      sellerProfileId: conversation.seller_profile_id,
      status: parsedLastMessage?.systemType === "thread_terminated" ? "closed" : "open",
      closedAt: parsedLastMessage?.systemType === "thread_terminated" ? lastMessageRow.created_at : null,
      createdAt: conversation.created_at,
      updatedAt: conversation.updated_at,
      listingTitle: conversation.listing?.title ?? "Listing unavailable",
      listing: conversation.listing
        ? (() => {
            const activeHold = holdMap.get(conversation.listing_id) ?? null;
            const mapped = mapListingRow(conversation.listing, false, activeHold);
            if (activeHold && mapped.status === "active") mapped.status = "reserved";
            return mapped;
          })()
        : null,
      participant: participantMap.get(participantId) ?? null,
      lastMessage: lastMessageRow
        ? mapConversationMessageRow(lastMessageRow, senderMap.get(lastMessageRow.sender_profile_id) ?? null)
        : null,
      safetyReminder:
        "Meet in public campus areas, inspect the item before payment, and report any off-platform pressure.",
    };
  });
}

export async function listMessagesForListing(listingId: string, user: AuthUser) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return listMessagesForListingInMemory(listingId, user) as any;
  const profile = await ensureProfileForAuthUser(user);

  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .select("*")
    .eq("listing_id", listingId)
    .or(`buyer_profile_id.eq.${profile.id},seller_profile_id.eq.${profile.id}`)
    .maybeSingle();

  if (conversationError) throw createServiceError("Failed to load conversation from Supabase.", conversationError);
  if (!conversation) return [];

  const { data: messages, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: true });

  if (error) throw createServiceError("Failed to load messages from Supabase.", error);
  if (!messages) return [];

  const senderMap = await getPublicProfilesByIds(messages.map((message: any) => message.sender_profile_id));
  return messages.map((message: any) => mapConversationMessageRow(message, senderMap.get(message.sender_profile_id) ?? null));
}

export async function sendMessageToListing(listingId: string, user: AuthUser, text: string) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return sendMessageToListingInMemory(listingId, user, text) as any;
  const sender = await ensureProfileForAuthUser(user);
  const listing = await getListingById(listingId, user);
  if (!listing) return null;
  const moderation = validateMessageForSend(text);
  if (moderation.blocked) {
    return { error: "MESSAGE_BLOCKED" as const, warning: moderation.warning, flags: moderation.flags };
  }
  const conversation = await ensureConversationForListing(listingId, user);
  if (!conversation) return { error: "SELF_MESSAGE" as const };
  if (await isConversationClosed(conversation.id)) return { error: "TERMINATED" as const };
  const receiverId =
    sender.id === conversation.seller_profile_id
      ? conversation.buyer_profile_id
      : conversation.seller_profile_id;
  if (await isBlockedBetween(sender.id, receiverId)) return { error: "BLOCKED" as const };
  const conversationId = conversation.id;
  const riskFlags = moderation.flags;

  const { data: inserted, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_profile_id: sender.id,
      text,
      risk_flags: riskFlags,
    })
    .select("*")
    .single();

  if (error || !inserted) throw createServiceError("Failed to create message in Supabase.", error);
  const { error: conversationTouchError } = await supabase
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId);
  if (conversationTouchError) {
    throw createServiceError("Failed to update conversation timestamp in Supabase.", conversationTouchError);
  }

  const senderProfile = await getPublicProfileById(sender.id);
  const notifications = filterSelfNotifications(sender.id, [
    {
      profileId: receiverId,
      type: "message_received",
      category: sender.id === conversation.seller_profile_id ? "buying" : "selling",
      priority: riskFlags.length ? "high" : "medium",
      title: `New message about ${listing.title}`,
      body: `${senderProfile?.fullName || "A UniKart user"} sent a new message in your listing thread.`,
      entityType: "conversation",
      entityId: conversationId,
      actionLabel: "Reply",
      actionHref: `/messages?listingId=${listingId}`,
      metadata: {
        messageId: inserted.id,
        listingId,
        listingTitle: listing.title,
        senderName: senderProfile?.fullName || sender.fullName,
        riskFlags,
      },
    },
  ]);
  if (notifications.length) {
    await createNotifications(notifications as any);
  }

  return {
    ...mapConversationMessageRow(inserted, await getPublicProfileById(sender.id)),
  };
}

export async function terminateConversationForListing(listingId: string, user: AuthUser) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return null;
  const actor = await ensureProfileForAuthUser(user);
  const listing = await getListingById(listingId, user);
  if (!listing) return null;
  const conversation = await ensureConversationForListing(listingId, user);
  if (!conversation) return null;

  const latestMessage = await getLatestConversationMessageRow(conversation.id);
  if (latestMessage && parseSystemMessage(latestMessage.text, latestMessage.risk_flags ?? []).systemType === "thread_terminated") {
    return mapConversationMessageRow(latestMessage, await getPublicProfileById(latestMessage.sender_profile_id));
  }

  const actorLabel =
    actor.id === conversation.seller_profile_id ? "Seller" : actor.id === conversation.buyer_profile_id ? "Buyer" : "Admin";
  const receiverId =
    actor.id === conversation.seller_profile_id ? conversation.buyer_profile_id : conversation.seller_profile_id;

  const { data: inserted, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversation.id,
      sender_profile_id: actor.id,
      text: buildThreadTerminationText(actorLabel),
      risk_flags: [THREAD_TERMINATED_FLAG],
    })
    .select("*")
    .single();

  if (error || !inserted) throw createServiceError("Failed to terminate conversation in Supabase.", error);

  const { error: conversationTouchError } = await supabase
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversation.id);
  if (conversationTouchError) {
    throw createServiceError("Failed to update terminated conversation timestamp in Supabase.", conversationTouchError);
  }

  const notifications = filterSelfNotifications(actor.id, [
    {
      profileId: receiverId,
      type: "system",
      category: "safety",
      priority: "high",
      title: `${listing.title} chat closed`,
      body: `${actorLabel} has terminated the chat for this listing. Further messages are disabled.`,
      entityType: "conversation",
      entityId: conversation.id,
      actionLabel: "Review thread",
      actionHref: `/messages?listingId=${listingId}`,
      metadata: {
        listingId,
        listingTitle: listing.title,
        status: "closed",
      },
    },
  ]);
  if (notifications.length) {
    await createNotifications(notifications as any);
  }

  return mapConversationMessageRow(inserted, await getPublicProfileById(actor.id));
}

export async function listOffersForListing(listingId: string, user: AuthUser): Promise<NegotiationOffer[]> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return [];
  const conversation = await ensureConversationForListing(listingId, user);
  if (!conversation) return [];

  const now = new Date().toISOString();
  await supabase
    .from("transaction_offers")
    .update({ status: "expired", updated_at: now })
    .eq("conversation_id", conversation.id)
    .eq("status", "pending")
    .lt("expires_at", now);

  const { data, error } = await supabase
    .from("transaction_offers")
    .select("*")
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: false });

  if (error) throw createServiceError("Failed to load offers from Supabase.", error);

  const rows = data ?? [];
  const actorIds = rows.map((row: any) => (row.kind === "counter_offer" ? row.seller_profile_id : row.buyer_profile_id));
  const actorMap = await getPublicProfilesByIds(actorIds);

  return rows.map((row: any) => {
    const mapped = mapOfferRow(row);
    const actorId = mapped.kind === "counter_offer" ? mapped.sellerProfileId : mapped.buyerProfileId;
    return {
      ...mapped,
      actor: actorMap.get(actorId) ?? null,
    };
  });
}

export async function getConversationWorkspaceForListing(
  listingId: string,
  user: AuthUser,
): Promise<ConversationWorkspaceView | null> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return null;

  const [profile, listing] = await Promise.all([
    ensureProfileForAuthUser(user),
    getListingById(listingId, user),
  ]);

  if (!listing) {
    return null;
  }

  const conversation = await findConversationForListing(listingId, user, {
    actorProfileId: profile.id,
    sellerProfileId: listing.sellerProfileId,
  });
  if (!conversation) {
    return {
      listing,
      conversation: null,
      messages: [],
      offers: [],
      schedules: [],
    };
  }

  const now = new Date().toISOString();
  await supabase
    .from("transaction_offers")
    .update({ status: "expired", updated_at: now })
    .eq("conversation_id", conversation.id)
    .eq("status", "pending")
    .lt("expires_at", now);

  const [messagesResult, offersResult, schedulesResult] = await Promise.all([
    supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("transaction_offers")
      .select("*")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("delivery_schedules")
      .select("*")
      .eq("listing_id", listingId)
      .or(`buyer_profile_id.eq.${profile.id},seller_profile_id.eq.${profile.id}`)
      .order("updated_at", { ascending: false }),
  ]);

  if (messagesResult.error) {
    throw createServiceError("Failed to load workspace messages from Supabase.", messagesResult.error);
  }
  if (offersResult.error) {
    throw createServiceError("Failed to load workspace offers from Supabase.", offersResult.error);
  }
  if (schedulesResult.error) {
    throw createServiceError("Failed to load workspace schedules from Supabase.", schedulesResult.error);
  }

  const messageRows = messagesResult.data ?? [];
  const offerRows = offersResult.data ?? [];
  const scheduleRows = schedulesResult.data ?? [];
  const otherParticipantId =
    conversation.buyer_profile_id === profile.id ? conversation.seller_profile_id : conversation.buyer_profile_id;
  const profileMap = await getPublicProfilesByIds([
    otherParticipantId,
    ...messageRows.map((row: any) => row.sender_profile_id),
    ...offerRows.map((row: any) => (row.kind === "counter_offer" ? row.seller_profile_id : row.buyer_profile_id)),
    ...scheduleRows.flatMap((row: any) => [row.buyer_profile_id, row.seller_profile_id]),
  ]);

  const messages = messageRows.map((row: any) =>
    mapConversationMessageRow(row, profileMap.get(row.sender_profile_id) ?? null),
  );
  const offers = offerRows.map((row: any) => {
    const mapped = mapOfferRow(row);
    const actorId = mapped.kind === "counter_offer" ? mapped.sellerProfileId : mapped.buyerProfileId;
    return {
      ...mapped,
      actor: profileMap.get(actorId) ?? null,
    };
  });
  const schedules = scheduleRows.map((row: any) => ({
    id: row.id,
    listingId: row.listing_id,
    buyerProfileId: row.buyer_profile_id,
    sellerProfileId: row.seller_profile_id,
    proposerProfileId: row.proposer_profile_id ?? row.buyer_profile_id,
    requestedMode: row.requested_mode,
    proposedTime: row.proposed_time,
    confirmedTime: row.confirmed_time,
    status: normalizeScheduleStatus(row.status),
    notes: row.notes,
    meetupLocation: mapMeetupLocation(row.meetup_location),
    meetupRoute: mapMeetupRoute(row.meetup_route),
    buyerConfirmedAt: row.buyer_confirmed_at ?? null,
    sellerConfirmedAt: row.seller_confirmed_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    listingTitle: listing.title,
    listing,
    buyer: profileMap.get(row.buyer_profile_id) ?? null,
    seller: profileMap.get(row.seller_profile_id) ?? null,
    safetyChecklist: [
      "Meet in a visible campus location.",
      "Confirm the item and price in chat before meeting.",
      "Avoid sending full payment before inspection unless trust is established.",
    ],
  }));

  const lastMessage = messages[messages.length - 1] ?? null;
  const parsedLastMessage = lastMessage
    ? parseSystemMessage(lastMessage.text, lastMessage.riskFlags ?? [])
    : null;

  return {
    listing,
    conversation: {
      id: conversation.id,
      listingId: conversation.listing_id,
      buyerProfileId: conversation.buyer_profile_id,
      sellerProfileId: conversation.seller_profile_id,
      status: parsedLastMessage?.systemType === "thread_terminated" ? "closed" : "open",
      closedAt: parsedLastMessage?.systemType === "thread_terminated" ? lastMessage?.sentAt ?? null : null,
      createdAt: conversation.created_at,
      updatedAt: conversation.updated_at,
      listingTitle: listing.title,
      listing,
      participant: profileMap.get(otherParticipantId) ?? null,
      lastMessage,
      unreadCount: 0,
      safetyReminder:
        "Meet in public campus areas, inspect the item before payment, and report any off-platform pressure.",
    },
    messages,
    offers,
    schedules,
  };
}

async function createHoldRecord(input: {
  listingId: string;
  conversationId?: string | null;
  buyerProfileId: string;
  sellerProfileId: string;
  hours: number;
  note?: string;
}) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return null;

  await expireActiveHoldsForListings([input.listingId]);

  const expiresAt = new Date(Date.now() + input.hours * 60 * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  const { data: existing, error: existingError } = await supabase
    .from("listing_holds")
    .select("*")
    .eq("listing_id", input.listingId)
    .eq("status", "active")
    .gte("expires_at", now)
    .maybeSingle();
  if (existingError) throw createServiceError("Failed to inspect active hold in Supabase.", existingError);

  if (existing) {
    const { data: updated, error: updateError } = await supabase
      .from("listing_holds")
      .update({
        buyer_profile_id: input.buyerProfileId,
        seller_profile_id: input.sellerProfileId,
        conversation_id: input.conversationId ?? null,
        note: input.note ?? existing.note,
        expires_at: expiresAt,
        status: "active",
        updated_at: now,
      })
      .eq("id", existing.id)
      .select("*")
      .single();
    if (updateError || !updated) throw createServiceError("Failed to refresh active hold in Supabase.", updateError);
    invalidateListingCaches();
    return mapHoldRow(updated);
  }

  const { data, error } = await supabase
    .from("listing_holds")
    .insert({
      listing_id: input.listingId,
      conversation_id: input.conversationId ?? null,
      buyer_profile_id: input.buyerProfileId,
      seller_profile_id: input.sellerProfileId,
      note: input.note,
      expires_at: expiresAt,
      status: "active",
    })
    .select("*")
    .single();

  if (error || !data) throw createServiceError("Failed to create listing hold in Supabase.", error);
  invalidateListingCaches();
  return mapHoldRow(data);
}

export async function requestListingHold(
  listingId: string,
  user: AuthUser,
  input: { hours?: number; note?: string },
): Promise<ListingHold | { error: "LISTING_UNAVAILABLE" | "SELF_HOLD" | "BLOCKED" } | null> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return null;
  const buyer = await ensureProfileForAuthUser(user);
  const listing = await getListingById(listingId, user);
  if (!listing) return null;
  if (["sold", "hidden", "suspended", "draft"].includes(listing.status)) return { error: "LISTING_UNAVAILABLE" as const };
  if (buyer.id === listing.sellerProfileId) return { error: "SELF_HOLD" as const };
  if (await isBlockedBetween(buyer.id, listing.sellerProfileId)) return { error: "BLOCKED" as const };

  const conversation = await ensureConversationForListing(listingId, user);
  const hold = await createHoldRecord({
    listingId,
    conversationId: conversation?.id ?? null,
    buyerProfileId: buyer.id,
    sellerProfileId: listing.sellerProfileId,
    hours: Math.max(1, Math.min(input.hours ?? 24, 72)),
    note: input.note,
  });

  if (!hold) return null;
  await createNotifications([
    {
      profileId: listing.sellerProfileId,
      type: "hold_requested",
      category: "selling",
      priority: "high",
      title: `24h hold requested for ${listing.title}`,
      body: `${buyer.fullName} requested a temporary hold on this listing.`,
      entityType: "listing",
      entityId: listing.id,
      actionLabel: "Review hold",
      actionHref: `/listings/${listing.id}`,
      metadata: {
        holdId: hold.id,
        listingTitle: listing.title,
        buyerName: buyer.fullName,
        expiresAt: hold.expiresAt,
        status: "active",
      },
    },
    {
      profileId: buyer.id,
      type: "hold_updated",
      category: "buying",
      priority: "medium",
      title: `Hold request sent for ${listing.title}`,
      body: `Your hold request is active until ${new Date(hold.expiresAt).toLocaleString("en-IN")}.`,
      entityType: "listing",
      entityId: listing.id,
      actionLabel: "Track hold",
      actionHref: `/listings/${listing.id}`,
      metadata: {
        holdId: hold.id,
        listingTitle: listing.title,
        expiresAt: hold.expiresAt,
        status: "active",
      },
    },
  ]);
  return {
    ...hold,
    buyer: await getPublicProfileById(hold.buyerProfileId),
    seller: await getPublicProfileById(hold.sellerProfileId),
  };
}

export async function listHoldsForListing(listingId: string, user: AuthUser): Promise<ListingHold[]> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return [];
  const profile = await ensureProfileForAuthUser(user);
  await expireActiveHoldsForListings([listingId]);
  const { data, error } = await supabase
    .from("listing_holds")
    .select("*")
    .eq("listing_id", listingId)
    .or(`buyer_profile_id.eq.${profile.id},seller_profile_id.eq.${profile.id}`)
    .order("created_at", { ascending: false });

  if (error) throw createServiceError("Failed to load listing holds from Supabase.", error);

  return Promise.all(
    (data ?? []).map(async (row: any) => {
      const mapped = mapHoldRow(row);
      return {
        ...mapped,
        buyer: await getPublicProfileById(mapped.buyerProfileId),
        seller: await getPublicProfileById(mapped.sellerProfileId),
      };
    }),
  );
}

export async function updateHoldStatus(
  holdId: string,
  user: AuthUser,
  input: { status: "released" | "converted"; note?: string },
): Promise<ListingHold | { error: "FORBIDDEN" } | null> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return null;
  const actor = await ensureProfileForAuthUser(user);
  const { data: existing, error: existingError } = await supabase
    .from("listing_holds")
    .select("*")
    .eq("id", holdId)
    .maybeSingle();
  if (existingError) throw createServiceError("Failed to load hold from Supabase.", existingError);
  if (!existing) return null;
  if (![existing.buyer_profile_id, existing.seller_profile_id].includes(actor.id) && actor.role !== "admin") {
    return { error: "FORBIDDEN" as const };
  }

  const { data, error } = await supabase
    .from("listing_holds")
    .update({
      status: input.status,
      note: input.note ?? existing.note,
      updated_at: new Date().toISOString(),
    })
    .eq("id", holdId)
    .select("*")
    .single();

  if (error || !data) throw createServiceError("Failed to update hold status in Supabase.", error);
  invalidateListingCaches();
  const mapped = mapHoldRow(data);
  const listing = await getListingById(mapped.listingId, user);
  const buyerProfile = await getPublicProfileById(mapped.buyerProfileId);
  const sellerProfile = await getPublicProfileById(mapped.sellerProfileId);
  await createNotifications([
    {
      profileId: mapped.buyerProfileId,
      type: "hold_updated",
      category: "buying",
      priority: input.status === "converted" ? "high" : "medium",
      title: `${listing?.title || "Listing"} hold ${input.status}`,
      body:
        input.status === "converted"
          ? `${sellerProfile?.fullName || "Seller"} converted the hold into a confirmed reservation.`
          : `${sellerProfile?.fullName || "Seller"} released the hold for this listing.`,
      entityType: "listing",
      entityId: mapped.listingId,
      actionLabel: "View listing",
      actionHref: `/listings/${mapped.listingId}`,
      metadata: {
        holdId: mapped.id,
        status: input.status,
        listingTitle: listing?.title,
      },
    },
    {
      profileId: mapped.sellerProfileId,
      type: "hold_updated",
      category: "selling",
      priority: "medium",
      title: `${listing?.title || "Listing"} hold ${input.status}`,
      body: `${buyerProfile?.fullName || "Buyer"} now sees this hold as ${input.status}.`,
      entityType: "listing",
      entityId: mapped.listingId,
      actionLabel: "Open listing",
      actionHref: `/listings/${mapped.listingId}`,
      metadata: {
        holdId: mapped.id,
        status: input.status,
        listingTitle: listing?.title,
      },
    },
  ]);
  return {
    ...mapped,
    buyer: buyerProfile,
    seller: sellerProfile,
  };
}

export async function createOffer(
  listingId: string,
  user: AuthUser,
  input: { amount: number; note?: string; previousOfferId?: string; expiresInHours?: number },
): Promise<NegotiationOffer | { error: "LISTING_NOT_FOUND" | "SELF_OFFER" | "BLOCKED" | "INVALID_COUNTER" | "THREAD_CLOSED" } | null> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return null;
  const actor = await ensureProfileForAuthUser(user);
  const listing = await getListingById(listingId, user);
  if (!listing) return { error: "LISTING_NOT_FOUND" as const };
  const actorIsSeller = actor.id === listing.sellerProfileId;
  if (actorIsSeller && !input.previousOfferId) {
    return { error: "INVALID_COUNTER" as const };
  }
  const conversation = await ensureConversationForListing(listingId, user);
  if (!conversation) return actorIsSeller ? { error: "INVALID_COUNTER" as const } : { error: "SELF_OFFER" as const };
  if (await isConversationClosed(conversation.id)) return { error: "THREAD_CLOSED" as const };
  if (await isBlockedBetween(conversation.buyer_profile_id, listing.sellerProfileId)) {
    return { error: "BLOCKED" as const };
  }

  const kind = actorIsSeller ? "counter_offer" : "offer";
  const buyerProfileId = actorIsSeller ? conversation.buyer_profile_id : actor.id;
  const sellerProfileId = listing.sellerProfileId;
  const nowIso = new Date().toISOString();
  const expiresAt = new Date(Date.now() + Math.max(1, Math.min(input.expiresInHours ?? 24, 72)) * 60 * 60 * 1000).toISOString();

  const { error: supersedeError } = await supabase
    .from("transaction_offers")
    .update({ status: "superseded", updated_at: nowIso })
    .eq("conversation_id", conversation.id)
    .eq("status", "pending");
  if (supersedeError) throw createServiceError("Failed to supersede earlier offers in Supabase.", supersedeError);

  const { data, error } = await supabase
    .from("transaction_offers")
    .insert({
      listing_id: listingId,
      conversation_id: conversation.id,
      buyer_profile_id: buyerProfileId,
      seller_profile_id: sellerProfileId,
      previous_offer_id: input.previousOfferId ?? null,
      amount: input.amount,
      note: input.note ?? null,
      kind,
      status: "pending",
      expires_at: expiresAt,
    })
    .select("*")
    .single();

  if (error || !data) throw createServiceError("Failed to create transaction offer in Supabase.", error);

  const mapped = mapOfferRow(data);
  const actorProfile = await getPublicProfileById(kind === "counter_offer" ? sellerProfileId : buyerProfileId);
  const recipientProfileId = kind === "counter_offer" ? buyerProfileId : sellerProfileId;
  const notifications = filterSelfNotifications(actor.id, [
    {
      profileId: recipientProfileId,
      type: kind === "counter_offer" ? "offer_updated" : "offer_received",
      category: kind === "counter_offer" ? "buying" : "selling",
      priority: "high",
      title: `${kind === "counter_offer" ? "Counter-offer" : "New offer"} for ${listing.title}`,
      body: `${actorProfile?.fullName || "A UniKart user"} proposed ₹${input.amount} for this listing.`,
      entityType: "offer",
      entityId: mapped.id,
      actionLabel: "Review offer",
      actionHref: `/messages?listingId=${listingId}`,
      metadata: {
        amount: input.amount,
        listingId,
        listingTitle: listing.title,
        offerId: mapped.id,
        kind,
        status: "pending",
      },
    },
  ]);
  if (notifications.length) {
    await createNotifications(notifications as any);
  }
  return {
    ...mapped,
    actor: actorProfile,
  };
}

export async function updateOfferStatus(
  offerId: string,
  user: AuthUser,
  input: { status: "accepted" | "rejected" | "withdrawn"; note?: string },
): Promise<NegotiationOffer | { error: "FORBIDDEN" } | null> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return null;
  const actor = await ensureProfileForAuthUser(user);

  const { data: existing, error: existingError } = await supabase
    .from("transaction_offers")
    .select("*")
    .eq("id", offerId)
    .maybeSingle();
  if (existingError) throw createServiceError("Failed to load offer from Supabase.", existingError);
  if (!existing) return null;

  const isSeller = actor.id === existing.seller_profile_id;
  const isBuyer = actor.id === existing.buyer_profile_id;
  const canAccept =
    (existing.kind === "offer" && isSeller) ||
    (existing.kind === "counter_offer" && isBuyer) ||
    actor.role === "admin";
  const canReject =
    canAccept || (input.status === "withdrawn" && ((existing.kind === "offer" && isBuyer) || (existing.kind === "counter_offer" && isSeller)));

  if ((input.status === "accepted" && !canAccept) || ((input.status === "rejected" || input.status === "withdrawn") && !canReject)) {
    return { error: "FORBIDDEN" as const };
  }

  const { data, error } = await supabase
    .from("transaction_offers")
    .update({
      status: input.status,
      note: input.note ?? existing.note,
      updated_at: new Date().toISOString(),
    })
    .eq("id", offerId)
    .select("*")
    .single();
  if (error || !data) throw createServiceError("Failed to update offer status in Supabase.", error);

  if (input.status === "accepted") {
    await createHoldRecord({
      listingId: existing.listing_id,
      conversationId: existing.conversation_id,
      buyerProfileId: existing.buyer_profile_id,
      sellerProfileId: existing.seller_profile_id,
      hours: 24,
      note: "Soft hold created from an accepted offer.",
    });
  }

  const mapped = mapOfferRow(data);
  const listing = await getListingById(existing.listing_id, user);
  const counterpartProfileId = actor.id === existing.seller_profile_id ? existing.buyer_profile_id : existing.seller_profile_id;
  const notifications = filterSelfNotifications(actor.id, [
    {
      profileId: counterpartProfileId,
      type: "offer_updated",
      category: actor.id === existing.seller_profile_id ? "buying" : "selling",
      priority: input.status === "accepted" ? "high" : "medium",
      title: `${listing?.title || "Listing"} offer ${input.status}`,
      body:
        input.status === "accepted"
          ? `Your offer flow for ${listing?.title || "this listing"} was accepted.`
          : `The offer flow for ${listing?.title || "this listing"} is now ${input.status}.`,
      entityType: "offer",
      entityId: mapped.id,
      actionLabel: input.status === "accepted" ? "Open reservation" : "Review thread",
      actionHref: `/messages?listingId=${existing.listing_id}`,
      metadata: {
        offerId: mapped.id,
        listingId: existing.listing_id,
        status: input.status,
        amount: mapped.amount,
      },
    },
  ]);
  if (notifications.length) {
    await createNotifications(notifications as any);
  }
  return {
    ...mapped,
    actor: await getPublicProfileById(mapped.kind === "counter_offer" ? mapped.sellerProfileId : mapped.buyerProfileId),
  };
}

export async function compareListings(listingIds: string[], viewerUser?: AuthUser) {
  const uniqueIds = [...new Set(listingIds.map((item) => String(item).trim()).filter(Boolean))]
    .filter((item) => /^[0-9a-fA-F-]{36}$/.test(item))
    .slice(0, 3);
  const listings = await Promise.all(uniqueIds.map((id) => getListingById(id, viewerUser).catch(() => null)));
  return listings.filter(Boolean) as Listing[];
}

export async function listSimilarListings(listingId: string, viewerUser?: AuthUser) {
  const base = await getListingById(listingId, viewerUser);
  if (!base) return [];
  const candidates = await listListings(
    {
      category: base.category,
      mode: base.mode,
      limit: 40,
    },
    viewerUser,
  );

  return candidates
    .filter((candidate) => candidate.id !== base.id && !["sold", "hidden", "suspended", "draft"].includes(candidate.status))
    .map((candidate) => ({
      ...candidate,
      comparisonScore: computeSimilarityScore(base, candidate),
    }))
    .sort((left, right) => (right.comparisonScore ?? 0) - (left.comparisonScore ?? 0))
    .slice(0, 6);
}

async function isBlockedBetween(firstProfileId: string, secondProfileId: string) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return false;
  const { data, error } = await supabase
    .from("blocked_users")
    .select("id")
    .or(
      `and(blocker_profile_id.eq.${firstProfileId},blocked_profile_id.eq.${secondProfileId}),and(blocker_profile_id.eq.${secondProfileId},blocked_profile_id.eq.${firstProfileId})`,
    );
  if (error) throw createServiceError("Failed to inspect block state in Supabase.", error);
  return !!data?.length;
}

export async function listSchedules(user: AuthUser): Promise<ScheduleView[]> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return listSchedulesInMemory(user) as any;
  const profile = await ensureProfileForAuthUser(user);
  const { data, error } = await supabase
    .from("delivery_schedules")
    .select("*")
    .or(`buyer_profile_id.eq.${profile.id},seller_profile_id.eq.${profile.id}`)
    .order("updated_at", { ascending: false });

  if (error) throw createServiceError("Failed to load schedules from Supabase.", error);
  if (!data) return [];

  const uniqueListingIds = [...new Set((data ?? []).map((schedule: any) => schedule.listing_id).filter(Boolean))];
  const uniqueProfileIds = [...new Set((data ?? []).flatMap((schedule: any) => [schedule.buyer_profile_id, schedule.seller_profile_id]).filter(Boolean))];
  const [listingEntries, profileMap] = await Promise.all([
    Promise.all(uniqueListingIds.map(async (listingId) => [listingId, await getListingById(listingId, user)] as const)),
    getPublicProfilesByIds(uniqueProfileIds),
  ]);
  const listingMap = new Map(listingEntries);

  return data.map((schedule: any) => {
      const listing = listingMap.get(schedule.listing_id) ?? null;
      return {
      id: schedule.id,
      listingId: schedule.listing_id,
      buyerProfileId: schedule.buyer_profile_id,
      sellerProfileId: schedule.seller_profile_id,
      proposerProfileId: schedule.proposer_profile_id ?? schedule.buyer_profile_id,
      requestedMode: schedule.requested_mode,
      proposedTime: schedule.proposed_time,
      confirmedTime: schedule.confirmed_time,
      status: normalizeScheduleStatus(schedule.status),
      notes: schedule.notes,
      meetupLocation: mapMeetupLocation(schedule.meetup_location),
      meetupRoute: mapMeetupRoute(schedule.meetup_route),
      buyerConfirmedAt: schedule.buyer_confirmed_at ?? null,
      sellerConfirmedAt: schedule.seller_confirmed_at ?? null,
      createdAt: schedule.created_at,
      updatedAt: schedule.updated_at,
      listingTitle: listing?.title ?? "Listing unavailable",
      listing,
      buyer: profileMap.get(schedule.buyer_profile_id) ?? null,
      seller: profileMap.get(schedule.seller_profile_id) ?? null,
      safetyChecklist: [
        "Meet in a visible campus location.",
        "Confirm the item and price in chat before meeting.",
        "Avoid sending full payment before inspection unless trust is established.",
      ],
    };
  });
}

export async function createSchedule(
  user: AuthUser,
  input: {
    listingId: string;
    requestedMode: any;
    proposedTime: string;
    notes?: string;
    meetupLocation?: DeliverySchedule["meetupLocation"];
    meetupRoute?: DeliverySchedule["meetupRoute"];
  },
) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return createScheduleInMemory(user, input as any) as any;
  const buyer = await ensureProfileForAuthUser(user);
  const listing = await getListingById(input.listingId, user);
  if (!listing) return null;
  if (buyer.id === listing.sellerProfileId) return { error: "SELF_SCHEDULE" as const };
  if (await isBlockedBetween(buyer.id, listing.sellerProfileId)) return { error: "BLOCKED" as const };
  if (!isFutureScheduleTime(input.proposedTime)) return { error: "PAST_DATE" as const };

  const { data, error } = await supabase
    .from("delivery_schedules")
    .insert({
      listing_id: input.listingId,
      buyer_profile_id: buyer.id,
      seller_profile_id: listing.sellerProfileId,
      proposer_profile_id: buyer.id,
      requested_mode: input.requestedMode,
      proposed_time: input.proposedTime,
      notes: input.notes,
      meetup_location: input.meetupLocation ? mapMeetupLocation(input.meetupLocation) : null,
      meetup_route: input.meetupRoute ?? null,
      buyer_confirmed_at: null,
      seller_confirmed_at: null,
      status: "proposed",
    })
    .select("*")
    .single();

  if (error || !data) throw createServiceError("Failed to create schedule in Supabase.", error);
  const notifications = filterSelfNotifications(buyer.id, [
    {
      profileId: listing.sellerProfileId,
      type: "schedule_updated",
      category: "selling",
      priority: "high",
      title: `Meetup proposed for ${listing.title}`,
      body: `${buyer.fullName} proposed a ${input.requestedMode} handoff on ${new Date(input.proposedTime).toLocaleString("en-IN")}${input.meetupLocation?.label ? ` at ${normalizeCampusText(input.meetupLocation.label)}` : ""}${input.meetupRoute?.durationMinutes ? `, around ${Math.max(1, Math.round(input.meetupRoute.durationMinutes))} min from ${input.meetupRoute.originLabel || "the selected start"}` : ""}.`,
      entityType: "schedule",
      entityId: data.id,
      actionLabel: "Review meetup",
      actionHref: `/schedules?listingId=${listing.id}`,
      metadata: {
        listingId: listing.id,
        listingTitle: listing.title,
        requestedMode: input.requestedMode,
        proposedTime: input.proposedTime,
        meetupLocationLabel: input.meetupLocation?.label ? normalizeCampusText(input.meetupLocation.label) : null,
        meetupRouteSummary: input.meetupRoute?.summary ?? null,
        meetupRouteDurationMinutes: input.meetupRoute?.durationMinutes ?? null,
        meetupRouteDistanceMeters: input.meetupRoute?.distanceMeters ?? null,
        scheduleId: data.id,
        status: "proposed",
      },
    },
    {
      profileId: buyer.id,
      type: "schedule_updated",
      category: "buying",
      priority: "medium",
      title: `Meetup proposal sent for ${listing.title}`,
      body: `Your meetup proposal${input.meetupLocation?.label ? ` at ${normalizeCampusText(input.meetupLocation.label)}` : ""} is waiting for both buyer and seller confirmation.`,
      entityType: "schedule",
      entityId: data.id,
      actionLabel: "Track meetup",
      actionHref: `/schedules?listingId=${listing.id}`,
      metadata: {
        listingId: listing.id,
        listingTitle: listing.title,
        requestedMode: input.requestedMode,
        proposedTime: input.proposedTime,
        meetupLocationLabel: input.meetupLocation?.label ? normalizeCampusText(input.meetupLocation.label) : null,
        meetupRouteSummary: input.meetupRoute?.summary ?? null,
        meetupRouteDurationMinutes: input.meetupRoute?.durationMinutes ?? null,
        meetupRouteDistanceMeters: input.meetupRoute?.distanceMeters ?? null,
        scheduleId: data.id,
        status: "proposed",
      },
    },
  ]);
  if (notifications.length) {
    await createNotifications(notifications as any);
  }
  return (await listSchedules(user)).find((schedule) => schedule.id === data.id) ?? null;
}

export async function updateScheduleStatus(
  scheduleId: string,
  user: AuthUser,
  input: {
    status: any;
    proposedTime?: string;
    confirmedTime?: string;
    notes?: string;
    meetupLocation?: DeliverySchedule["meetupLocation"];
    meetupRoute?: DeliverySchedule["meetupRoute"];
  },
) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return updateScheduleStatusInMemory(scheduleId, user, input as any) as any;
  const actor = await ensureProfileForAuthUser(user);
  const { data: existing, error: existingError } = await supabase
    .from("delivery_schedules")
    .select("*")
    .eq("id", scheduleId)
    .maybeSingle();

  if (existingError) throw createServiceError("Failed to load schedule from Supabase.", existingError);
  if (!existing) return null;
  const canManage =
    actor.id === existing.buyer_profile_id ||
    actor.id === existing.seller_profile_id ||
    actor.role === "admin";
  if (!canManage) return { error: "FORBIDDEN" as const };

  if (input.proposedTime !== undefined && !isFutureScheduleTime(input.proposedTime)) {
    return { error: "PAST_DATE" as const };
  }

  const normalizedExistingStatus = normalizeScheduleStatus(existing.status);
  const nextMeetupLocation = input.meetupLocation ? mapMeetupLocation(input.meetupLocation) : mapMeetupLocation(existing.meetup_location);
  const nextMeetupRoute = input.meetupRoute ?? existing.meetup_route ?? null;
  let buyerConfirmedAt = existing.buyer_confirmed_at ?? null;
  let sellerConfirmedAt = existing.seller_confirmed_at ?? null;
  let nextStatus = normalizedExistingStatus;
  let nextConfirmedTime = existing.confirmed_time ?? null;
  let nextNotes = input.notes ?? existing.notes ?? null;

  if (input.status === "confirmed") {
    if (!["proposed", "reschedule_requested", "confirmed"].includes(normalizedExistingStatus)) {
      return { error: "INVALID_TRANSITION" as const };
    }
    if (actor.id === existing.buyer_profile_id) buyerConfirmedAt = buyerConfirmedAt || new Date().toISOString();
    if (actor.id === existing.seller_profile_id) sellerConfirmedAt = sellerConfirmedAt || new Date().toISOString();
    nextStatus = buyerConfirmedAt && sellerConfirmedAt ? "confirmed" : normalizedExistingStatus === "reschedule_requested" ? "reschedule_requested" : "proposed";
    nextConfirmedTime = buyerConfirmedAt && sellerConfirmedAt ? existing.confirmed_time ?? existing.proposed_time : null;
  } else if (input.status === "reschedule_requested" || input.status === "proposed") {
    buyerConfirmedAt = null;
    sellerConfirmedAt = null;
    nextStatus = input.status;
    nextConfirmedTime = null;
  } else if (input.status === "completed") {
    if (normalizedExistingStatus !== "confirmed") return { error: "INVALID_TRANSITION" as const };
    nextStatus = "completed";
    nextConfirmedTime = input.confirmedTime ?? existing.confirmed_time ?? existing.proposed_time;
  } else if (input.status === "cancelled") {
    nextStatus = "cancelled";
  }

  if (
    input.proposedTime !== undefined ||
    input.meetupLocation !== undefined ||
    input.meetupRoute !== undefined
  ) {
    buyerConfirmedAt = nextStatus === "completed" || nextStatus === "cancelled" ? buyerConfirmedAt : null;
    sellerConfirmedAt = nextStatus === "completed" || nextStatus === "cancelled" ? sellerConfirmedAt : null;
    if (!["completed", "cancelled"].includes(nextStatus)) {
      nextStatus = input.status === "reschedule_requested" ? "reschedule_requested" : "proposed";
      nextConfirmedTime = null;
    }
  }

  if (input.confirmedTime !== undefined) {
    nextConfirmedTime = input.confirmedTime;
  }

  const { data, error } = await supabase
    .from("delivery_schedules")
    .update({
      status: nextStatus,
      proposed_time: input.proposedTime ?? existing.proposed_time,
      confirmed_time: nextConfirmedTime,
      notes: nextNotes,
      meetup_location: nextMeetupLocation ?? null,
      meetup_route: nextMeetupRoute,
      buyer_confirmed_at: buyerConfirmedAt,
      seller_confirmed_at: sellerConfirmedAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", scheduleId)
    .select("*")
    .single();

  if (error || !data) throw createServiceError("Failed to update schedule in Supabase.", error);
  const listing = await getListingById(data.listing_id, user);
  const counterpartProfileId = actor.id === data.seller_profile_id ? data.buyer_profile_id : data.seller_profile_id;
  const category = actor.id === data.seller_profile_id ? "buying" : "selling";
  const notifications = filterSelfNotifications(actor.id, [
    {
      profileId: counterpartProfileId,
      type: "schedule_updated",
      category,
      priority: nextStatus === "confirmed" ? "high" : "medium",
      title: `${listing?.title || "Listing"} meetup ${nextStatus}`,
      body:
        nextStatus === "confirmed"
          ? `The meetup is fully confirmed${nextConfirmedTime ? ` for ${new Date(nextConfirmedTime).toLocaleString("en-IN")}` : ""}${nextMeetupLocation?.label ? ` at ${nextMeetupLocation.label}` : ""}${nextMeetupRoute?.durationMinutes ? `, about ${Math.max(1, Math.round(nextMeetupRoute.durationMinutes))} min from ${nextMeetupRoute.originLabel || "the selected start"}` : ""}.`
          : input.status === "confirmed"
            ? `${actor.fullName} confirmed this meetup. It will lock in once both buyer and seller confirm.`
            : `The meetup for ${listing?.title || "this listing"} is now ${nextStatus}.`,
      entityType: "schedule",
      entityId: data.id,
      actionLabel: "Review meetup",
      actionHref: `/schedules?listingId=${data.listing_id}`,
      metadata: {
        listingId: data.listing_id,
        listingTitle: listing?.title,
        scheduleId: data.id,
        status: nextStatus,
        confirmedTime: nextConfirmedTime,
        meetupLocationLabel: nextMeetupLocation?.label ?? mapMeetupLocation(data.meetup_location)?.label ?? null,
        meetupRouteSummary: nextMeetupRoute?.summary ?? null,
        meetupRouteDurationMinutes: nextMeetupRoute?.durationMinutes ?? null,
        meetupRouteDistanceMeters: nextMeetupRoute?.distanceMeters ?? null,
      },
    },
  ]);
  if (notifications.length) {
    await createNotifications(notifications as any);
  }
  return (await listSchedules(user)).find((schedule) => schedule.id === data.id) ?? null;
}

export async function blockUser(user: AuthUser, blockedProfileId: string) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return blockUserInMemory(user, blockedProfileId) as any;
  const blocker = await ensureProfileForAuthUser(user);
  if (blocker.id === blockedProfileId) return { error: "SELF_BLOCK" as const };
  const blockedProfile = await getPublicProfileById(blockedProfileId);
  if (!blockedProfile) return null;

  const { data, error } = await supabase
    .from("blocked_users")
    .upsert({ blocker_profile_id: blocker.id, blocked_profile_id: blockedProfileId }, { onConflict: "blocker_profile_id,blocked_profile_id" })
    .select("*")
    .single();

  if (error || !data) throw createServiceError("Failed to block user in Supabase.", error);
  return {
    id: data.id,
    blockerProfileId: data.blocker_profile_id,
    blockedProfileId: data.blocked_profile_id,
    createdAt: data.created_at,
    blockedProfile,
  };
}

export async function listBlocks(user: AuthUser) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return listBlocksInMemory(user) as any;
  const blocker = await ensureProfileForAuthUser(user);
  const { data, error } = await supabase
    .from("blocked_users")
    .select("*")
    .eq("blocker_profile_id", blocker.id)
    .order("created_at", { ascending: false });

  if (error) throw createServiceError("Failed to load blocked users from Supabase.", error);
  if (!data) return [];
  return Promise.all(
    data.map(async (item: any) => ({
      id: item.id,
      blockerProfileId: item.blocker_profile_id,
      blockedProfileId: item.blocked_profile_id,
      createdAt: item.created_at,
      blockedProfile: await getPublicProfileById(item.blocked_profile_id),
    })),
  );
}

export async function listReports() {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return listReportsInMemory() as any;
  const { data, error } = await supabase.from("reports").select("*").order("created_at", { ascending: false });
  if (error) throw createServiceError("Failed to load reports from Supabase.", error);
  return (data ?? []).map((report: any) => ({
    id: report.id,
    targetType: report.target_type,
    targetId: report.target_id,
    reporterProfileId: report.reporter_profile_id,
    reason: report.reason,
    details: report.details,
    status: report.status,
    severity: report.severity,
    createdAt: report.created_at,
  })) as Report[];
}

export async function getReportById(reportId: string) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return getReportByIdInMemory(reportId) as any;
  const { data, error } = await supabase.from("reports").select("*").eq("id", reportId).maybeSingle();
  if (error) throw createServiceError("Failed to load report from Supabase.", error);
  if (!data) return null;
  return {
    id: data.id,
    targetType: data.target_type,
    targetId: data.target_id,
    reporterProfileId: data.reporter_profile_id,
    reason: data.reason,
    details: data.details,
    status: data.status,
    severity: data.severity,
    createdAt: data.created_at,
  } as Report;
}

export async function addModerationAction(
  reportId: string,
  user: AuthUser,
  input: { action: any; note?: string },
) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return addModerationActionInMemory(reportId, user, input as any) as any;
  const admin = await ensureProfileForAuthUser(user);
  const report = await getReportById(reportId);
  if (!report) return null;

  const { data, error } = await supabase
    .from("moderation_actions")
    .insert({
      report_id: reportId,
      admin_profile_id: admin.id,
      action: input.action,
      note: input.note,
    })
    .select("*")
    .single();

  const { error: reportUpdateError } = await supabase
    .from("reports")
    .update({ status: input.action === "warn_user" ? "reviewing" : "resolved" })
    .eq("id", reportId);
  if (reportUpdateError) {
    throw createServiceError("Failed to update report status in Supabase.", reportUpdateError);
  }

  if ((input.action === "hide_listing" || input.action === "suspend_listing") && report.targetType === "listing") {
    const moderatedListing = await getListingById(report.targetId, user);
    const { error: listingUpdateError } = await supabase
      .from("listings")
      .update({
        status: input.action === "hide_listing" ? "hidden" : "suspended",
        updated_at: new Date().toISOString(),
      })
      .eq("id", report.targetId);

    if (listingUpdateError) {
      throw createServiceError("Failed to apply moderation visibility to the listing in Supabase.", listingUpdateError);
    }
    invalidateListingCaches();

    if (moderatedListing?.sellerProfileId) {
      await createNotifications([
        {
          profileId: moderatedListing.sellerProfileId,
          type: "listing_moderated" as const,
          category: "admin" as const,
          priority: "high" as const,
          title: `${moderatedListing.title} was moderated`,
          body:
            input.action === "hide_listing"
              ? "Your listing was hidden by moderation review. Check the moderation desk or support context for the latest status."
              : "Your listing was suspended by moderation review. Check the moderation desk or support context for the latest status.",
          entityType: "listing" as const,
          entityId: moderatedListing.id,
          actionLabel: "Review listing",
          actionHref: `/listings/${moderatedListing.id}`,
          metadata: {
            action: input.action,
            note: input.note ?? "",
          },
        },
      ]);
    }
  }

  if (error || !data) throw createServiceError("Failed to create moderation action in Supabase.", error);
  return {
    id: data.id,
    reportId: data.report_id,
    adminProfileId: data.admin_profile_id,
    action: data.action,
    note: data.note,
    createdAt: data.created_at,
    admin: await getPublicProfileById(admin.id),
  };
}

export async function listModerationActions() {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return listModerationActionsInMemory() as any;
  const { data, error } = await supabase
    .from("moderation_actions")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw createServiceError("Failed to load moderation actions from Supabase.", error);
  return Promise.all(
    (data ?? []).map(async (action: any) => ({
      id: action.id,
      reportId: action.report_id,
      adminProfileId: action.admin_profile_id,
      action: action.action,
      note: action.note,
      createdAt: action.created_at,
      admin: await getPublicProfileById(action.admin_profile_id),
    })),
  );
}
