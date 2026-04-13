import { randomUUID } from "node:crypto";

import type { AuthUser } from "../types/auth";
import type {
  BlockedUser,
  Conversation,
  DeliverySchedule,
  Favorite,
  Listing,
  ListingCategory,
  ListingCondition,
  ListingFulfillmentMode,
  ListingStatus,
  Message,
  ModerationAction,
  ModerationActionType,
  Profile,
  PublicProfile,
  Report,
  ReportReason,
  ScheduleStatus,
} from "../types/marketplace";

interface ListingFilters {
  search?: string;
  category?: ListingCategory;
  condition?: ListingCondition;
  status?: ListingStatus;
  minPrice?: number;
  maxPrice?: number;
  deliveryAvailable?: boolean;
  sort?: "newest" | "price_asc" | "price_desc";
}

interface CreateListingInput {
  title: string;
  description: string;
  price: number;
  inventoryCount?: number;
  category: ListingCategory;
  condition: ListingCondition;
  negotiable: boolean;
  fulfillmentModes: ListingFulfillmentMode[];
  area: string;
  imageUrls: string[];
  tags: string[];
  status?: ListingStatus;
  mode?: "sale" | "rent" | "bundle";
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
}

interface UpdateListingInput extends Partial<CreateListingInput> {
  status?: ListingStatus;
}

const now = new Date().toISOString();

const profiles: Profile[] = [
  {
    id: "profile-arjun",
    email: "arjun.narayanan@srmist.edu.in",
    fullName: "Arjun Narayanan",
    role: "seller",
    campusId: "srm-ktr",
    isVerified: true,
    joinedAt: "2025-08-11T09:00:00.000Z",
    responseReliability: "high",
  },
  {
    id: "profile-meghana",
    email: "meghana.ravi@srmist.edu.in",
    fullName: "Meghana Ravi",
    role: "seller",
    campusId: "srm-ktr",
    isVerified: true,
    joinedAt: "2025-09-02T10:30:00.000Z",
    responseReliability: "high",
  },
  {
    id: "profile-nisha",
    email: "nisha.kapoor@srmist.edu.in",
    fullName: "Nisha Kapoor",
    role: "seller",
    campusId: "srm-ktr",
    isVerified: true,
    joinedAt: "2025-10-05T12:15:00.000Z",
    responseReliability: "medium",
  },
  {
    id: "profile-pranav",
    email: "pranav.iyer@srmist.edu.in",
    fullName: "Pranav Iyer",
    role: "seller",
    campusId: "srm-ktr",
    isVerified: true,
    joinedAt: "2025-11-14T14:10:00.000Z",
    responseReliability: "medium",
  },
];

const listings: Listing[] = [
  {
    id: "listing-calculator-fx991",
    sellerProfileId: "profile-arjun",
    title: "Casio fx-991ES Plus Calculator",
    description:
      "Lightly used scientific calculator, perfect for first-year engineering maths and physics courses at SRM KTR. Comes with protective cover and original box.",
    price: 850,
    inventoryCount: 1,
    currency: "INR",
    category: "electronics",
    condition: "like_new",
    status: "active",
    negotiable: true,
    fulfillmentModes: ["meetup", "pickup"],
    area: "Tech Park",
    campusId: "srm-ktr",
    imageUrls: ["/images/fx991-front.jpg", "/images/fx991-box.jpg"],
    tags: ["calculator", "engineering", "semester-1"],
    createdAt: "2026-03-10T09:15:00.000Z",
    updatedAt: "2026-03-10T09:15:00.000Z",
  },
  {
    id: "listing-dsa-textbook",
    sellerProfileId: "profile-meghana",
    title: "Data Structures and Algorithms Textbook Bundle",
    description:
      "Includes C programming notes, DSA reference book, and handwritten lab prep sheets. Useful for CSE students preparing for internals and semester exams.",
    price: 1200,
    inventoryCount: 1,
    currency: "INR",
    category: "books",
    condition: "good",
    status: "active",
    negotiable: false,
    fulfillmentModes: ["meetup", "campus-drop"],
    area: "Library Gate",
    campusId: "srm-ktr",
    imageUrls: ["/images/dsa-bundle-1.jpg"],
    tags: ["dsa", "cse", "textbook"],
    createdAt: "2026-03-14T14:40:00.000Z",
    updatedAt: "2026-03-14T14:40:00.000Z",
  },
  {
    id: "listing-hostel-kettle",
    sellerProfileId: "profile-nisha",
    title: "Portable Electric Kettle for Hostel Room",
    description:
      "1 litre kettle in good working condition. Ideal for late-night maggi, tea, or quick hot water in the hostel. Slight marks on the outside, no functional issues.",
    price: 600,
    inventoryCount: 1,
    currency: "INR",
    category: "hostel-essentials",
    condition: "good",
    status: "reserved",
    negotiable: true,
    fulfillmentModes: ["pickup", "campus-drop", "hostel-meetup"],
    area: "Girls Hostel Block C",
    campusId: "srm-ktr",
    imageUrls: ["/images/kettle-1.jpg"],
    tags: ["hostel", "kitchen", "kettle"],
    createdAt: "2026-03-18T18:05:00.000Z",
    updatedAt: "2026-03-22T08:00:00.000Z",
  },
  {
    id: "listing-geared-cycle",
    sellerProfileId: "profile-pranav",
    title: "21-Speed Geared Bicycle",
    description:
      "Used for commuting between hostel, tech park, and main academic block. Brakes and gears serviced recently. Best for students who want faster campus travel.",
    price: 4800,
    inventoryCount: 1,
    currency: "INR",
    category: "cycle",
    condition: "fair",
    status: "active",
    negotiable: true,
    fulfillmentModes: ["meetup", "pickup"],
    area: "Main Gate",
    campusId: "srm-ktr",
    imageUrls: ["/images/cycle-1.jpg", "/images/cycle-2.jpg"],
    tags: ["cycle", "commute", "geared"],
    createdAt: "2026-03-21T07:50:00.000Z",
    updatedAt: "2026-03-21T07:50:00.000Z",
  },
];

const favorites: Favorite[] = [];
const reports: Report[] = [];
const conversations: Conversation[] = [];
const messages: Message[] = [];
const deliverySchedules: DeliverySchedule[] = [];
const blockedUsers: BlockedUser[] = [];
const moderationActions: ModerationAction[] = [];

function getProfileById(profileId: string): Profile | undefined {
  return profiles.find((profile) => profile.id === profileId);
}

function getProfileByEmail(email: string): Profile | undefined {
  return profiles.find((profile) => profile.email.toLowerCase() === email.toLowerCase());
}

function toPublicProfile(profile: Profile): PublicProfile {
  return {
    id: profile.id,
    fullName: profile.fullName,
    campusId: profile.campusId,
    isVerified: profile.isVerified,
    joinedAt: profile.joinedAt,
    listingCount: listings.filter((listing) => listing.sellerProfileId === profile.id).length,
    responseReliability: profile.responseReliability,
  };
}

function getSeverityForReason(reason: ReportReason): Report["severity"] {
  if (reason === "fraudulent_listing" || reason === "prohibited_item") {
    return "high";
  }

  if (reason === "suspicious_payment_request" || reason === "impersonation") {
    return "medium";
  }

  return "low";
}

function sortListings(items: Listing[], sort: ListingFilters["sort"]): Listing[] {
  if (sort === "price_asc") {
    return [...items].sort((left, right) => left.price - right.price);
  }

  if (sort === "price_desc") {
    return [...items].sort((left, right) => right.price - left.price);
  }

  return [...items].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function ensureProfileForAuthUser(user: AuthUser): Profile {
  const existing = getProfileByEmail(user.email);

  if (existing) {
    existing.fullName = user.fullName;
    existing.role = user.role;
    existing.campusId = user.campusId;
    existing.isVerified = user.isVerified;
    return existing;
  }

  const profile: Profile = {
    id: `profile-${randomUUID()}`,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    campusId: user.campusId,
    isVerified: user.isVerified,
    joinedAt: now,
    responseReliability: "new",
  };

  profiles.push(profile);
  return profile;
}

export function listListings(filters: ListingFilters = {}, viewerProfileId?: string) {
  let filtered = listings.filter((listing) => listing.status !== "draft");

  if (filters.search) {
    const search = filters.search.trim().toLowerCase();
    filtered = filtered.filter(
      (listing) =>
        listing.title.toLowerCase().includes(search) ||
        listing.description.toLowerCase().includes(search) ||
        listing.tags.some((tag) => tag.toLowerCase().includes(search)),
    );
  }

  if (filters.category) {
    filtered = filtered.filter((listing) => listing.category === filters.category);
  }

  if (filters.condition) {
    filtered = filtered.filter((listing) => listing.condition === filters.condition);
  }

  if (filters.status) {
    filtered = filtered.filter((listing) => listing.status === filters.status);
  }

  if (typeof filters.minPrice === "number") {
    filtered = filtered.filter((listing) => listing.price >= filters.minPrice!);
  }

  if (typeof filters.maxPrice === "number") {
    filtered = filtered.filter((listing) => listing.price <= filters.maxPrice!);
  }

  if (filters.deliveryAvailable) {
    filtered = filtered.filter((listing) =>
      listing.fulfillmentModes.some((mode) => mode === "campus-drop"),
    );
  }

  return sortListings(filtered, filters.sort).map((listing) => hydrateListing(listing, viewerProfileId));
}

export function getListingById(listingId: string, viewerProfileId?: string) {
  const listing = listings.find((item) => item.id === listingId);
  return listing ? hydrateListing(listing, viewerProfileId) : null;
}

export function createListing(input: CreateListingInput, user: AuthUser) {
  const seller = ensureProfileForAuthUser(user);
  const timestamp = new Date().toISOString();
  const listing: Listing = {
    id: `listing-${randomUUID()}`,
    sellerProfileId: seller.id,
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
    campusId: seller.campusId,
    imageUrls: input.imageUrls,
    tags: input.tags,
    rentDetails: input.rentDetails,
    bundleDetails: input.bundleDetails,
    trustScore: 44,
    completenessScore: 58,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  listings.unshift(listing);
  return hydrateListing(listing, seller.id);
}

export function updateListing(listingId: string, input: UpdateListingInput, user: AuthUser) {
  const seller = ensureProfileForAuthUser(user);
  const listing = listings.find((item) => item.id === listingId);

  if (!listing) {
    return null;
  }

  if (listing.sellerProfileId !== seller.id && user.role !== "admin") {
    throw new Error("FORBIDDEN");
  }

  if (input.title !== undefined) listing.title = input.title;
  if (input.description !== undefined) listing.description = input.description;
  if (input.price !== undefined) listing.price = input.price;
  if (input.inventoryCount !== undefined) listing.inventoryCount = input.inventoryCount;
  if (input.category !== undefined) listing.category = input.category;
  if (input.condition !== undefined) listing.condition = input.condition;
  if (input.negotiable !== undefined) listing.negotiable = input.negotiable;
  if (input.fulfillmentModes !== undefined) listing.fulfillmentModes = input.fulfillmentModes;
  if (input.area !== undefined) listing.area = input.area;
  if (input.imageUrls !== undefined) listing.imageUrls = input.imageUrls;
  if (input.tags !== undefined) listing.tags = input.tags;
  if (input.status !== undefined) listing.status = input.status;
  if (input.mode !== undefined) listing.mode = input.mode;
  if (input.rentDetails !== undefined) listing.rentDetails = input.rentDetails;
  if (input.bundleDetails !== undefined) listing.bundleDetails = input.bundleDetails;

  listing.updatedAt = new Date().toISOString();

  return hydrateListing(listing, seller.id);
}

export function deleteListing(listingId: string, user: AuthUser) {
  const seller = ensureProfileForAuthUser(user);
  const index = listings.findIndex((item) => item.id === listingId);

  if (index === -1) {
    return false;
  }

  if (listings[index].sellerProfileId !== seller.id && user.role !== "admin") {
    throw new Error("FORBIDDEN");
  }

  listings.splice(index, 1);
  return true;
}

export function getSellerProfileForListing(listingId: string) {
  const listing = listings.find((item) => item.id === listingId);

  if (!listing) {
    return null;
  }

  const seller = getProfileById(listing.sellerProfileId);
  return seller ? toPublicProfile(seller) : null;
}

export function favoriteListing(listingId: string, user: AuthUser) {
  const profile = ensureProfileForAuthUser(user);
  const listing = listings.find((item) => item.id === listingId);

  if (!listing) {
    return null;
  }

  const existing = favorites.find(
    (favorite) => favorite.listingId === listingId && favorite.profileId === profile.id,
  );

  if (existing) {
    return existing;
  }

  const favorite: Favorite = {
    id: `favorite-${randomUUID()}`,
    listingId,
    profileId: profile.id,
    createdAt: new Date().toISOString(),
  };

  favorites.push(favorite);
  return favorite;
}

export function listFavoriteListings(user: AuthUser) {
  const profile = ensureProfileForAuthUser(user);
  const favoriteListingIds = favorites
    .filter((favorite) => favorite.profileId === profile.id)
    .map((favorite) => favorite.listingId);

  return listings
    .filter((listing) => favoriteListingIds.includes(listing.id))
    .map((listing) => hydrateListing(listing, profile.id));
}

export function unfavoriteListing(listingId: string, user: AuthUser) {
  const profile = ensureProfileForAuthUser(user);
  const index = favorites.findIndex(
    (favorite) => favorite.listingId === listingId && favorite.profileId === profile.id,
  );

  if (index === -1) {
    return false;
  }

  favorites.splice(index, 1);
  return true;
}

export function reportListing(listingId: string, user: AuthUser, reason: ReportReason, details?: string) {
  const profile = ensureProfileForAuthUser(user);
  const listing = listings.find((item) => item.id === listingId);

  if (!listing) {
    return null;
  }

  const report: Report = {
    id: `report-${randomUUID()}`,
    targetType: "listing",
    targetId: listingId,
    reporterProfileId: profile.id,
    reason,
    details,
    status: "open",
    severity: getSeverityForReason(reason),
    createdAt: new Date().toISOString(),
  };

  reports.unshift(report);
  return report;
}

export function listReports() {
  return reports;
}

export function getReportById(reportId: string) {
  return reports.find((report) => report.id === reportId) ?? null;
}

export function getSeedListings() {
  return listings;
}

export function listOwnListings(user: AuthUser) {
  const profile = ensureProfileForAuthUser(user);
  return listings
    .filter((listing) => listing.sellerProfileId === profile.id)
    .map((listing) => hydrateListing(listing, profile.id))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function listConversations(user: AuthUser) {
  const profile = ensureProfileForAuthUser(user);

  return conversations
    .filter(
      (conversation) =>
        conversation.buyerProfileId === profile.id || conversation.sellerProfileId === profile.id,
    )
    .map((conversation) => {
      const listing = listings.find((item) => item.id === conversation.listingId) ?? null;
      const participantId =
        conversation.buyerProfileId === profile.id
          ? conversation.sellerProfileId
          : conversation.buyerProfileId;
      const participant = getProfileById(participantId);
      const conversationMessages = messages
        .filter((message) => message.conversationId === conversation.id)
        .sort((left, right) => left.sentAt.localeCompare(right.sentAt));
      const lastMessage = conversationMessages[conversationMessages.length - 1] ?? null;

      return {
        ...conversation,
        listingTitle: listing?.title ?? "Listing unavailable",
        participant: participant ? toPublicProfile(participant) : null,
        lastMessage: lastMessage
          ? {
              ...lastMessage,
              sender: getProfileById(lastMessage.senderProfileId)
                ? toPublicProfile(getProfileById(lastMessage.senderProfileId)!)
                : null,
            }
          : null,
        safetyReminder:
          "Meet in a public campus location and avoid sharing sensitive personal details.",
      };
    })
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function listMessagesForListing(listingId: string, user: AuthUser) {
  const profile = ensureProfileForAuthUser(user);
  const conversation = conversations.find(
    (item) =>
      item.listingId === listingId &&
      (item.buyerProfileId === profile.id || item.sellerProfileId === profile.id),
  );

  if (!conversation) {
    return null;
  }

  return messages
    .filter((message) => message.conversationId === conversation.id)
    .sort((left, right) => left.sentAt.localeCompare(right.sentAt))
    .map((message) => ({
      ...message,
      sender: getProfileById(message.senderProfileId)
        ? toPublicProfile(getProfileById(message.senderProfileId)!)
        : null,
    }));
}

export function sendMessageToListing(listingId: string, user: AuthUser, text: string) {
  const sender = ensureProfileForAuthUser(user);
  const listing = listings.find((item) => item.id === listingId);

  if (!listing) {
    return null;
  }

  const sellerId = listing.sellerProfileId;
  const buyerId = sender.id === sellerId ? sellerId : sender.id;
  const receiverId = sender.id === sellerId ? buyerId : sellerId;

  if (buyerId === sellerId) {
    return { error: "SELF_MESSAGE" as const };
  }

  if (isBlockedBetween(sender.id, receiverId)) {
    return { error: "BLOCKED" as const };
  }

  let conversation = conversations.find(
    (item) => item.listingId === listingId && item.buyerProfileId === buyerId && item.sellerProfileId === sellerId,
  );

  const timestamp = new Date().toISOString();

  if (!conversation) {
    conversation = {
      id: `conversation-${randomUUID()}`,
      listingId,
      buyerProfileId: buyerId,
      sellerProfileId: sellerId,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    conversations.push(conversation);
  }

  conversation.updatedAt = timestamp;

  const message: Message = {
    id: `message-${randomUUID()}`,
    conversationId: conversation.id,
    senderProfileId: sender.id,
    text,
    sentAt: timestamp,
  };

  messages.push(message);

  return {
    ...message,
    conversationId: conversation.id,
    sender: toPublicProfile(sender),
  };
}

export function listSchedules(user: AuthUser) {
  const profile = ensureProfileForAuthUser(user);

  return deliverySchedules
    .filter(
      (schedule) => schedule.buyerProfileId === profile.id || schedule.sellerProfileId === profile.id,
    )
    .map(hydrateSchedule)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function createSchedule(
  user: AuthUser,
  input: {
    listingId: string;
    requestedMode: ListingFulfillmentMode;
    proposedTime: string;
    notes?: string;
    meetupLocation?: DeliverySchedule["meetupLocation"];
    meetupRoute?: DeliverySchedule["meetupRoute"];
  },
) {
  const buyer = ensureProfileForAuthUser(user);
  const listing = listings.find((item) => item.id === input.listingId);

  if (!listing) {
    return null;
  }

  if (buyer.id === listing.sellerProfileId) {
    return { error: "SELF_SCHEDULE" as const };
  }

  if (isBlockedBetween(buyer.id, listing.sellerProfileId)) {
    return { error: "BLOCKED" as const };
  }

  if (!Number.isFinite(Date.parse(input.proposedTime)) || Date.parse(input.proposedTime) <= Date.now()) {
    return { error: "PAST_DATE" as const };
  }

  const timestamp = new Date().toISOString();
  const schedule: DeliverySchedule = {
    id: `schedule-${randomUUID()}`,
    listingId: listing.id,
    buyerProfileId: buyer.id,
    sellerProfileId: listing.sellerProfileId,
    proposerProfileId: buyer.id,
    requestedMode: input.requestedMode,
    proposedTime: input.proposedTime,
    notes: input.notes,
    meetupLocation: input.meetupLocation ?? null,
    meetupRoute: input.meetupRoute ?? null,
    status: "proposed",
    buyerConfirmedAt: null,
    sellerConfirmedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  deliverySchedules.unshift(schedule);
  return hydrateSchedule(schedule);
}

export function updateScheduleStatus(
  scheduleId: string,
  user: AuthUser,
  input: {
    status: ScheduleStatus;
    proposedTime?: string;
    confirmedTime?: string;
    notes?: string;
    meetupLocation?: DeliverySchedule["meetupLocation"];
    meetupRoute?: DeliverySchedule["meetupRoute"];
  },
) {
  const actor = ensureProfileForAuthUser(user);
  const schedule = deliverySchedules.find((item) => item.id === scheduleId);

  if (!schedule) {
    return null;
  }

  const canManage =
    actor.id === schedule.buyerProfileId ||
    actor.id === schedule.sellerProfileId ||
    actor.role === "admin";

  if (!canManage) {
    return { error: "FORBIDDEN" as const };
  }

  if (input.proposedTime !== undefined) {
    if (!Number.isFinite(Date.parse(input.proposedTime)) || Date.parse(input.proposedTime) <= Date.now()) {
      return { error: "PAST_DATE" as const };
    }
    schedule.proposedTime = input.proposedTime;
    schedule.status = "reschedule_requested";
    schedule.confirmedTime = undefined;
    schedule.buyerConfirmedAt = null;
    schedule.sellerConfirmedAt = null;
  }

  if (input.status === "confirmed") {
    if (!["proposed", "reschedule_requested", "confirmed"].includes(schedule.status)) {
      return { error: "INVALID_TRANSITION" as const };
    }
    if (actor.id === schedule.buyerProfileId) schedule.buyerConfirmedAt = schedule.buyerConfirmedAt || new Date().toISOString();
    if (actor.id === schedule.sellerProfileId) schedule.sellerConfirmedAt = schedule.sellerConfirmedAt || new Date().toISOString();
    schedule.status = schedule.buyerConfirmedAt && schedule.sellerConfirmedAt ? "confirmed" : schedule.status === "reschedule_requested" ? "reschedule_requested" : "proposed";
    schedule.confirmedTime = schedule.status === "confirmed" ? schedule.confirmedTime || schedule.proposedTime : undefined;
  } else if (input.status === "reschedule_requested" || input.status === "proposed") {
    schedule.status = input.status;
    schedule.confirmedTime = undefined;
    schedule.buyerConfirmedAt = null;
    schedule.sellerConfirmedAt = null;
  } else if (input.status === "completed") {
    if (schedule.status !== "confirmed") return { error: "INVALID_TRANSITION" as const };
    schedule.status = "completed";
    schedule.confirmedTime = schedule.confirmedTime || schedule.proposedTime;
  } else {
    schedule.status = input.status;
  }

  if (input.confirmedTime !== undefined) {
    schedule.confirmedTime = input.confirmedTime;
  }
  if (input.notes !== undefined) {
    schedule.notes = input.notes;
  }
  if (input.meetupLocation !== undefined) {
    schedule.meetupLocation = input.meetupLocation;
  }
  if (input.meetupRoute !== undefined) {
    schedule.meetupRoute = input.meetupRoute;
  }
  schedule.updatedAt = new Date().toISOString();

  return hydrateSchedule(schedule);
}

export function blockUser(user: AuthUser, blockedProfileId: string) {
  const blocker = ensureProfileForAuthUser(user);

  if (blocker.id === blockedProfileId) {
    return { error: "SELF_BLOCK" as const };
  }

  const blockedProfile = getProfileById(blockedProfileId);

  if (!blockedProfile) {
    return null;
  }

  const existing = blockedUsers.find(
    (item) => item.blockerProfileId === blocker.id && item.blockedProfileId === blockedProfileId,
  );

  if (existing) {
    return existing;
  }

  const block: BlockedUser = {
    id: `block-${randomUUID()}`,
    blockerProfileId: blocker.id,
    blockedProfileId,
    createdAt: new Date().toISOString(),
  };

  blockedUsers.push(block);
  return block;
}

export function listBlocks(user: AuthUser) {
  const blocker = ensureProfileForAuthUser(user);

  return blockedUsers
    .filter((item) => item.blockerProfileId === blocker.id)
    .map((item) => ({
      ...item,
      blockedProfile: getProfileById(item.blockedProfileId)
        ? toPublicProfile(getProfileById(item.blockedProfileId)!)
        : null,
    }));
}

export function addModerationAction(
  reportId: string,
  user: AuthUser,
  input: { action: ModerationActionType; note?: string },
) {
  const admin = ensureProfileForAuthUser(user);
  const report = reports.find((item) => item.id === reportId);

  if (!report) {
    return null;
  }

  const moderationAction: ModerationAction = {
    id: `moderation-${randomUUID()}`,
    reportId,
    adminProfileId: admin.id,
    action: input.action,
    note: input.note,
    createdAt: new Date().toISOString(),
  };

  moderationActions.unshift(moderationAction);
  report.status = input.action === "warn_user" ? "reviewing" : "resolved";

  return {
    ...moderationAction,
    admin: toPublicProfile(admin),
  };
}

export function listModerationActions() {
  return moderationActions.map((action) => ({
    ...action,
    admin: getProfileById(action.adminProfileId)
      ? toPublicProfile(getProfileById(action.adminProfileId)!)
      : null,
  }));
}

function hydrateSchedule(schedule: DeliverySchedule) {
  const listing = listings.find((item) => item.id === schedule.listingId) ?? null;
  const buyer = getProfileById(schedule.buyerProfileId);
  const seller = getProfileById(schedule.sellerProfileId);

  return {
    ...schedule,
    listingTitle: listing?.title ?? "Listing unavailable",
    buyer: buyer ? toPublicProfile(buyer) : null,
    seller: seller ? toPublicProfile(seller) : null,
  };
}

function isBlockedBetween(firstProfileId: string, secondProfileId: string) {
  return blockedUsers.some(
    (item) =>
      (item.blockerProfileId === firstProfileId && item.blockedProfileId === secondProfileId) ||
      (item.blockerProfileId === secondProfileId && item.blockedProfileId === firstProfileId),
  );
}

function hydrateListing(listing: Listing, viewerProfileId?: string) {
  const seller = getProfileById(listing.sellerProfileId);

  return {
    ...listing,
    seller: seller ? toPublicProfile(seller) : null,
    isFavorited: viewerProfileId
      ? favorites.some(
          (favorite) => favorite.listingId === listing.id && favorite.profileId === viewerProfileId,
        )
      : false,
  };
}
