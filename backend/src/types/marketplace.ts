export type ListingFulfillmentMode = "meetup" | "pickup" | "campus-drop" | "hostel-meetup";
export type ListingMode = "sale" | "rent" | "bundle";

export type ListingCondition = "like_new" | "good" | "fair";

export type ListingStatus = "draft" | "active" | "reserved" | "sold" | "hidden" | "suspended";

export type ListingCategory =
  | "electronics"
  | "books"
  | "hostel-essentials"
  | "cycle"
  | "furniture"
  | "fashion"
  | "appliances"
  | "lab-equipment";

export type CurrencyCode = "INR";

export type ReportReason =
  | "fraudulent_listing"
  | "fake_seller"
  | "abusive_chat"
  | "suspicious_payment_request"
  | "prohibited_item"
  | "harassment"
  | "impersonation";

export type ScheduleStatus =
  | "proposed"
  | "confirmed"
  | "reschedule_requested"
  | "completed"
  | "cancelled";

export type ModerationActionType =
  | "warn_user"
  | "hide_listing"
  | "suspend_listing"
  | "suspend_account"
  | "ban_account";

export interface Profile {
  id: string;
  email: string;
  fullName: string;
  role: "buyer" | "seller" | "admin";
  campusId: string;
  isVerified: boolean;
  joinedAt: string;
  responseReliability: "high" | "medium" | "new";
  avatarUrl?: string | null;
  bio?: string | null;
  contactNumber?: string | null;
  hostel?: string | null;
  department?: string | null;
  sellerHeadline?: string | null;
  preferredMeetupSpot?: string | null;
  favoriteCategories?: string[];
  notificationPreferences?: {
    buying?: boolean;
    selling?: boolean;
    safety?: boolean;
    system?: boolean;
    savedSearchAlerts?: boolean;
  };
  profileCompleteness?: number;
  trustBadges?: string[];
  setupCompleted?: boolean;
}

export interface Listing {
  id: string;
  sellerProfileId: string;
  title: string;
  description: string;
  price: number;
  inventoryCount: number;
  currency: CurrencyCode;
  category: ListingCategory;
  condition: ListingCondition;
  status: ListingStatus;
  mode?: ListingMode;
  negotiable: boolean;
  fulfillmentModes: ListingFulfillmentMode[];
  area: string;
  campusId: string;
  imageUrls: string[];
  tags: string[];
  rentDetails?: {
    dailyRate?: number;
    weeklyRate?: number;
    deposit?: number;
    minDurationDays?: number;
    availabilitySummary?: string;
  };
  bundleDetails?: {
    itemCount?: number;
    summary?: string;
  };
  listingMetadata?: {
    brand?: string;
    originalPrice?: number;
    ageMonths?: number;
    reasonForSelling?: string;
    includedItems?: string;
    meetupNotes?: string;
    usageHighlights?: string;
    preferredContactWindow?: string;
    exactLocationHint?: string;
  };
  trustScore?: number;
  completenessScore?: number;
  activeHold?: {
    id: string;
    buyerProfileId: string;
    sellerProfileId: string;
    status: "active" | "released" | "converted" | "expired";
    expiresAt: string;
    note?: string;
  } | null;
  comparisonScore?: number;
  mediaAssets?: ListingMediaAsset[];
  seller?: PublicProfile | null;
  isFavorited?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ListingMediaAsset {
  id: string;
  ownerProfileId: string;
  listingId?: string | null;
  bucketId: string;
  objectPath: string;
  publicUrl: string;
  mediaKind: "image" | "video";
  mimeType: string;
  fileSizeBytes?: number | null;
  width?: number | null;
  height?: number | null;
  durationSeconds?: number | null;
  sortOrder: number;
  uploadStatus: "pending" | "uploaded" | "ready" | "failed";
  originalFilename?: string | null;
  checksum?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MediaUploadTicket {
  asset: ListingMediaAsset;
  bucketId: string;
  objectPath: string;
  uploadToken: string;
  uploadUrl: string;
  publicUrl: string;
}

export interface Favorite {
  id: string;
  listingId: string;
  profileId: string;
  createdAt: string;
}

export interface Report {
  id: string;
  targetType: "listing";
  targetId: string;
  reporterProfileId: string;
  reason: ReportReason;
  details?: string;
  status: "open" | "reviewing" | "resolved";
  severity: "low" | "medium" | "high";
  createdAt: string;
}

export interface PublicProfile {
  id: string;
  fullName: string;
  campusId: string;
  isVerified: boolean;
  joinedAt: string;
  listingCount: number;
  responseReliability: Profile["responseReliability"];
  profileCompleteness?: number;
  trustBadges?: string[];
  avatarUrl?: string | null;
  bio?: string | null;
  contactNumber?: string | null;
  hostel?: string | null;
  department?: string | null;
  sellerHeadline?: string | null;
  preferredMeetupSpot?: string | null;
  favoriteCategories?: string[];
  setupCompleted?: boolean;
}

export interface Conversation {
  id: string;
  listingId: string;
  buyerProfileId: string;
  sellerProfileId: string;
  status?: "open" | "closed";
  closedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderProfileId: string;
  text: string;
  sentAt: string;
  kind?: "user" | "system";
  systemType?: "thread_terminated" | null;
  riskFlags?: string[];
}

export interface NegotiationOffer {
  id: string;
  listingId: string;
  conversationId: string;
  buyerProfileId: string;
  sellerProfileId: string;
  previousOfferId?: string | null;
  amount: number;
  note?: string | null;
  kind: "offer" | "counter_offer";
  status: "pending" | "accepted" | "rejected" | "withdrawn" | "expired" | "superseded";
  expiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
  actor?: PublicProfile | null;
}

export interface ListingHold {
  id: string;
  listingId: string;
  conversationId?: string | null;
  buyerProfileId: string;
  sellerProfileId: string;
  status: "active" | "released" | "converted" | "expired";
  note?: string | null;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  buyer?: PublicProfile | null;
  seller?: PublicProfile | null;
}

export interface MeetupLocation {
  label: string;
  latitude: number;
  longitude: number;
  campusId?: string;
  zoneId?: string | null;
  zoneLabel?: string | null;
  placeType?: "campus_zone" | "custom_pin";
  addressHint?: string | null;
}

export interface MeetupRoutePoint {
  label?: string | null;
  latitude: number;
  longitude: number;
  x?: number | null;
  y?: number | null;
  kind?: "origin" | "waypoint" | "destination";
}

export interface MeetupRoute {
  provider: "campus_graph" | "google_maps" | "tomtom";
  travelMode: "walking";
  originLabel: string;
  originLatitude: number;
  originLongitude: number;
  destinationLabel: string;
  destinationLatitude: number;
  destinationLongitude: number;
  durationMinutes: number;
  distanceMeters: number;
  summary?: string | null;
  computedAt: string;
  path: MeetupRoutePoint[];
}

export interface DeliverySchedule {
  id: string;
  listingId: string;
  buyerProfileId: string;
  sellerProfileId: string;
  proposerProfileId: string;
  requestedMode: ListingFulfillmentMode;
  proposedTime: string;
  confirmedTime?: string;
  status: ScheduleStatus;
  notes?: string;
  meetupLocation?: MeetupLocation | null;
  meetupRoute?: MeetupRoute | null;
  buyerConfirmedAt?: string | null;
  sellerConfirmedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BlockedUser {
  id: string;
  blockerProfileId: string;
  blockedProfileId: string;
  createdAt: string;
}

export interface ModerationAction {
  id: string;
  reportId: string;
  adminProfileId: string;
  action: ModerationActionType;
  note?: string;
  createdAt: string;
}

export interface CartItem {
  id: string;
  cartId: string;
  listingId: string;
  quantity: number;
  createdAt: string;
}

export interface Cart {
  id: string;
  profileId: string;
  status: "active" | "checked_out" | "abandoned";
  createdAt: string;
  updatedAt: string;
}

export interface PolicyArticle {
  id: string;
  title: string;
  summary: string;
  body: string[];
  category: "safety" | "policy" | "payments" | "meetups";
}

export interface DashboardSummary {
  activeListings: number;
  reservedListings: number;
  soldListings: number;
  favoriteCount: number;
  cartCount: number;
  compareQueueCount?: number;
  conversationCount: number;
  scheduleCount: number;
  unreadLikeCount: number;
  reportCount: number;
  pendingModerationCount: number;
  recentlyPublished: Listing[];
  recentFavorites: Listing[];
  recentlyViewed: Listing[];
  notifications: UserNotification[];
  unreadNotificationCount: number;
  savedFilters: Array<{
    id: string;
    label: string;
    filterPayload: Record<string, unknown>;
    alertEnabled?: boolean;
    updatedAt?: string;
    lastTriggeredAt?: string | null;
  }>;
  urgentActions: string[];
}

export interface SellerListingAnalytics {
  listingId: string;
  title: string;
  status: ListingStatus;
  favoriteCount: number;
  conversationCount: number;
  holdCount: number;
  scheduleCount: number;
  inventoryCount: number;
  updatedAt: string;
}

export interface SellerAnalyticsSummary {
  activeListings: number;
  reservedListings: number;
  soldListings: number;
  totalFavorites: number;
  totalConversations: number;
  totalHolds: number;
  totalSchedules: number;
  listingBreakdown: SellerListingAnalytics[];
  dailyTrends?: Array<{
    date: string;
    listingsCreated: number;
    favoritesAdded: number;
    conversationsStarted: number;
    holdsCreated: number;
    schedulesCreated: number;
  }>;
}

export interface BuyerAnalyticsSummary {
  savedListings: number;
  comparedListings: number;
  cartItems: number;
  savedFilters: number;
  alertEnabledFilters: number;
  unreadNotifications: number;
  recentViews: number;
  dailyTrends?: Array<{
    date: string;
    savedListings: number;
    comparedListings: number;
    recentlyViewed: number;
    buyingNotifications: number;
    buyerConversations: number;
    buyerSchedules: number;
  }>;
}

export interface UserAnalyticsSummary {
  seller: SellerAnalyticsSummary;
  buyer: BuyerAnalyticsSummary;
}

export interface AdminAnalyticsSummary {
  totalReports: number;
  openReports: number;
  highSeverityReports: number;
  moderationActions: number;
  hiddenOrSuspendedListings: number;
  activeListings: number;
  soldListings: number;
  aiArtifacts?: number;
  savedSearchMatches?: number;
  aiProviderEvents?: number;
  aiFallbackCount?: number;
  aiProviderErrors?: number;
  aiTimeouts?: number;
  aiAvgLatencyMs?: number;
  reportReasons: Array<{ reason: string; count: number }>;
  dailyTrends?: Array<{
    date: string;
    reportsCreated: number;
    moderationActions: number;
    hiddenListings: number;
    aiRequests: number;
    aiFallbacks: number;
  }>;
}

export interface PlatformAnalyticsSummary {
  totalProfiles: number;
  activeListings: number;
  soldListings: number;
  hiddenListings: number;
  suspendedListings: number;
  totalFavorites: number;
  totalConversations: number;
  totalSchedules: number;
  totalOffers: number;
  totalHolds: number;
  totalSavedFilters: number;
  totalCompareQueueItems?: number;
  totalAiArtifacts?: number;
  alertEnabledFilters: number;
  unreadNotifications: number;
  categoryBreakdown: Array<{ category: string; count: number }>;
  featureUsage: Array<{ feature: string; count: number }>;
  funnel: {
    listings: number;
    favorites: number;
    conversations: number;
    holds: number;
    sold: number;
  };
  dailyActivity?: Array<{
    date: string;
    listingsCreated: number;
    notificationsCreated: number;
    reportsCreated: number;
    aiArtifactsCreated: number;
    compareItemsAdded?: number;
    mediaAssetsCreated?: number;
  }>;
}

export interface AiProviderEvent {
  id: string;
  provider: string;
  operation: string;
  model?: string | null;
  status: "success" | "fallback" | "provider_error" | "timeout" | "parse_error" | "config_bypass";
  usedFallback: boolean;
  httpStatus?: number | null;
  latencyMs?: number | null;
  subjectType: string;
  subjectId: string;
  errorMessage?: string | null;
  requestMeta: Record<string, unknown>;
  responseMeta: Record<string, unknown>;
  createdAt: string;
}

export interface AiDiagnosticsSummary {
  totalRequests: number;
  successCount: number;
  fallbackCount: number;
  providerErrorCount: number;
  timeoutCount: number;
  parseErrorCount: number;
  configBypassCount: number;
  avgLatencyMs: number;
  successRate: number;
  fallbackRate: number;
  lastEventAt?: string | null;
  byOperation: Array<{
    operation: string;
    totalRequests: number;
    successCount: number;
    fallbackCount: number;
    avgLatencyMs: number;
  }>;
  recentEvents: AiProviderEvent[];
  dailyTrends: Array<{
    date: string;
    totalRequests: number;
    successCount: number;
    fallbackCount: number;
    providerErrorCount: number;
    timeoutCount: number;
    parseErrorCount: number;
    avgLatencyMs: number;
  }>;
}

export interface SavedFilter {
  id: string;
  profileId: string;
  label: string;
  filterPayload: Record<string, unknown>;
  alertEnabled?: boolean;
  updatedAt?: string;
  lastTriggeredAt?: string | null;
  createdAt: string;
}

export interface CompareQueueItem {
  id: string;
  profileId: string;
  listingId: string;
  createdAt: string;
  listing?: Listing | null;
}

export interface UserNotification {
  id: string;
  profileId: string;
  type:
    | "listing_sold"
    | "listing_updated"
    | "listing_deleted"
    | "saved_search_match"
    | "listing_moderated"
    | "message_received"
    | "schedule_updated"
    | "hold_updated"
    | "offer_updated"
    | "hold_requested"
    | "offer_received"
    | "system";
  category?: "buying" | "selling" | "safety" | "system" | "admin";
  priority?: "low" | "medium" | "high";
  title: string;
  body: string;
  entityType?: "listing" | "profile" | "conversation" | "schedule" | "offer" | "system" | null;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  actionLabel?: string | null;
  actionHref?: string | null;
  readAt?: string | null;
  dismissedAt?: string | null;
  createdAt: string;
}

export interface NotificationInboxSection {
  needsAction: UserNotification[];
  recent: UserNotification[];
  earlier: UserNotification[];
  grouped: NotificationInboxGroup[];
}

export interface NotificationInboxGroup {
  key: string;
  category: NonNullable<UserNotification["category"]>;
  priority: NonNullable<UserNotification["priority"]>;
  title: string;
  subtitle?: string | null;
  count: number;
  unreadCount: number;
  latestAt: string;
  actionLabel?: string | null;
  actionHref?: string | null;
  notificationIds: string[];
}

export interface NotificationInbox {
  all: NotificationInboxSection;
  buying: NotificationInboxSection;
  selling: NotificationInboxSection;
  safety: NotificationInboxSection;
  system: NotificationInboxSection;
  admin: NotificationInboxSection;
  highlights: Array<{
    lane: "buying" | "selling" | "safety" | "system" | "admin";
    title: string;
    count: number;
    unreadCount: number;
  }>;
  counts: {
    all: number;
    buying: number;
    selling: number;
    safety: number;
    system: number;
    admin: number;
    unread: number;
  };
}
