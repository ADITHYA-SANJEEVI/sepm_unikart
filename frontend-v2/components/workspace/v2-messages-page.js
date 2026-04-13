"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useV2AppState } from "@/components/v2-app-providers";
import { Button, EmptyBlock, Icon, MetricTile, NoticeBanner, PageHeader, StatusPill, Surface } from "@/components/system/primitives";
import { apiFetch, formatCurrency, peekApiCache } from "@/lib/api";

const CHAT_CACHE_OPTIONS = { cacheMs: 120000, staleMs: 900000 };

const THREAD_TERMINATED_FLAG = "thread_terminated";

function statusLabel(value) {
  return String(value || "active").replaceAll("_", " ");
}

function formatDate(value) {
  if (!value) return "Recent";
  try {
    return new Date(value).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "Recent";
  }
}

function formatMeetupRoute(route) {
  if (!route) return "";
  const duration = Number(route.durationMinutes || 0);
  const distanceMeters = Number(route.distanceMeters || 0);
  const distanceLabel = distanceMeters >= 1000 ? `${(distanceMeters / 1000).toFixed(1)} km` : `${Math.round(distanceMeters)} m`;
  const providerLabel = route.provider === "tomtom" ? "TomTom" : route.provider === "google_maps" ? "Google" : "Campus";
  return `${providerLabel} / ${route.originLabel || "Route"} / ${Math.max(1, Math.round(duration))} min / ${distanceLabel}`;
}

function sanitizeMessageText(text = "") {
  return String(text)
    .replace(/\b\d{10,13}\b/g, "[contact removed]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email removed]")
    .replace(/(?:whatsapp|telegram|instagram|snapchat|outside app)/gi, "[off-app contact removed]");
}

function reviewLocalChatDraft(text = "") {
  const normalized = String(text || "").trim();
  if (!normalized) return { blocked: false, warning: "", flags: [] };

  const flags = [];
  if (/\b\d{10,13}\b/.test(normalized)) flags.push("contact_disclosure");
  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi.test(normalized)) flags.push("contact_disclosure");
  if (/(?:room|hostel|block)\s*[a-z0-9-]{1,8}/i.test(normalized)) flags.push("private_location_disclosure");
  if (/\b(?:idiot|stupid|loser|shut up|moron|bitch|bastard|fuck|fucking)\b/i.test(normalized)) flags.push("abusive_language");
  if (/(?:whatsapp|telegram|instagram|snapchat|outside app)/i.test(normalized)) flags.push("off_platform_push");

  if (flags.includes("abusive_language")) {
    return {
      blocked: true,
      warning: "Messages with abusive language are blocked.",
      flags,
    };
  }

  if (flags.includes("contact_disclosure") || flags.includes("private_location_disclosure")) {
    return {
      blocked: true,
      warning: "Private contact details and exact room or hostel references are blocked in chat.",
      flags,
    };
  }

  if (flags.includes("off_platform_push")) {
    return {
      blocked: false,
      warning: "Off-platform contact references are redacted and monitored.",
      flags,
    };
  }

  return { blocked: false, warning: "", flags };
}

function isHighRiskModerationResult(moderation) {
  const payload = moderation?.data || moderation || null;
  const riskScore = Number(payload?.riskScore || 0);
  const flags = Array.isArray(payload?.flags) ? payload.flags : [];
  return riskScore >= 65 || flags.includes("abusive_language");
}

function getListingThumb(listing) {
  return listing?.mediaAssets?.find((item) => item.publicUrl)?.publicUrl || listing?.imageUrls?.[0] || "";
}

function isThreadTermination(entry) {
  return entry?.systemType === "thread_terminated" || (entry?.riskFlags || []).includes(THREAD_TERMINATED_FLAG);
}

function bubbleTone(entry, currentProfileId) {
  if (isThreadTermination(entry)) return "v2-message-bubble-system";
  if (entry.pending) return "v2-message-bubble-pending";
  if (entry.senderProfileId === currentProfileId) return "v2-message-bubble-self";
  if ((entry.riskFlags || []).length) return "v2-message-bubble-risk";
  return "";
}

function buildThreadPreview(listing, auth) {
  if (!listing) return null;
  return {
    id: `listing-${listing.id}`,
    listingId: listing.id,
    buyerProfileId: auth.profile?.id || "",
    sellerProfileId: listing.sellerProfileId || listing.seller?.id || "",
    status: "open",
    closedAt: null,
    createdAt: listing.createdAt || new Date().toISOString(),
    updatedAt: listing.updatedAt || listing.createdAt || new Date().toISOString(),
    listingTitle: listing.title || "Campus listing",
    listing,
    participant: listing.seller || null,
    lastMessage: null,
    unreadCount: 0,
    safetyReminder:
      "Meet in public campus areas, inspect the item before payment, and report any off-platform pressure.",
  };
}

function buildOptimisticMessage(auth, text) {
  const timestamp = new Date().toISOString();
  return {
    id: `pending-${Date.now()}`,
    conversationId: "",
    senderProfileId: auth.profile?.id || auth.user?.id || auth.devEmail || "local-user",
    text,
    sentAt: timestamp,
    sender: auth.profile
      ? {
          id: auth.profile.id,
          fullName: auth.profile.fullName,
        }
      : {
          id: "",
          fullName: auth.devFullName || auth.user?.user_metadata?.full_name || auth.devEmail || "You",
        },
    riskFlags: [],
    kind: "user",
    systemType: null,
    pending: true,
  };
}

function threadPreviewText(conversation, currentProfileId = "") {
  if (conversation?.lastMessage?.text) {
    const senderLabel = conversation.lastMessage.kind === "system"
      ? "System"
      : conversation.lastMessage.senderProfileId === currentProfileId
        ? "You"
        : conversation.lastMessage.sender?.fullName || "Them";
    return `${senderLabel}: ${sanitizeMessageText(conversation.lastMessage.text)}`;
  }
  if (conversation?.status === "closed") return "Chat terminated.";
  return "No messages yet";
}

function sortThreads(items) {
  return [...items].sort((left, right) => +new Date(right.updatedAt || 0) - +new Date(left.updatedAt || 0));
}

function hydrateLoadedMessages(entries = [], currentProfileId = "") {
  return entries.map((entry) => (
    entry?.senderProfileId === currentProfileId && !isThreadTermination(entry)
      ? { ...entry, deliveryState: "delivered" }
      : entry
  ));
}

function canRespondToOffer(offer, currentProfileId) {
  if (!offer || !currentProfileId || offer.status !== "pending") return false;
  if (currentProfileId === offer.buyerProfileId && currentProfileId === offer.sellerProfileId) return false;
  if (offer.kind === "offer") return currentProfileId === offer.sellerProfileId;
  if (offer.kind === "counter_offer") return currentProfileId === offer.buyerProfileId;
  return false;
}

function offerStatusTone(status) {
  if (status === "accepted") return "success";
  if (status === "rejected") return "danger";
  if (status === "withdrawn" || status === "expired" || status === "superseded") return "muted";
  return "active";
}

function isScheduleParticipant(schedule, currentProfileId) {
  return !!schedule && !!currentProfileId && [schedule.buyerProfileId, schedule.sellerProfileId].includes(currentProfileId);
}

function hasParticipantConfirmed(schedule, currentProfileId) {
  if (!schedule || !currentProfileId) return false;
  if (currentProfileId === schedule.buyerProfileId) return !!schedule.buyerConfirmedAt;
  if (currentProfileId === schedule.sellerProfileId) return !!schedule.sellerConfirmedAt;
  return false;
}

function scheduleConfirmationSummary(schedule) {
  if (!schedule) return "";
  const buyerReady = !!schedule.buyerConfirmedAt;
  const sellerReady = !!schedule.sellerConfirmedAt;
  if (buyerReady && sellerReady) return "Buyer and seller confirmed";
  if (buyerReady) return "Buyer confirmed, waiting on seller";
  if (sellerReady) return "Seller confirmed, waiting on buyer";
  return "Waiting on both sides to confirm";
}

function canConfirmSchedule(schedule, currentProfileId) {
  if (!schedule || !currentProfileId) return false;
  if (currentProfileId === schedule.buyerProfileId && currentProfileId === schedule.sellerProfileId) return false;
  return ["proposed", "reschedule_requested", "confirmed"].includes(schedule.status) && isScheduleParticipant(schedule, currentProfileId) && !hasParticipantConfirmed(schedule, currentProfileId);
}

function canCompleteSchedule(schedule, currentProfileId) {
  if (!schedule || !currentProfileId) return false;
  return schedule.status === "confirmed" && isScheduleParticipant(schedule, currentProfileId);
}

export function V2MessagesPage() {
  const { auth, signedInLike, refreshNotifications } = useV2AppState();
  const searchParams = useSearchParams();
  const threadRef = useRef(null);
  const workspaceRequestRef = useRef(0);
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [offers, setOffers] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [draft, setDraft] = useState("");
  const [offerAmount, setOfferAmount] = useState("");
  const [offerNote, setOfferNote] = useState("");
  const [warning, setWarning] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [workspaceLoading, setWorkspaceLoading] = useState(true);

  const requestedListingId = searchParams.get("listingId") || searchParams.get("listing") || "";
  const activeListingId = selectedConversation?.listingId || "";
  const currentProfileId = auth.profile?.id || "";
  const userIsSeller = !!(selectedConversation?.listing && auth.profile?.id === selectedConversation.listing.sellerProfileId);
  const isOwnListingThread = !!(selectedConversation?.listing?.sellerProfileId && auth.profile?.id === selectedConversation.listing.sellerProfileId);
  const threadClosed = !!(
    selectedConversation?.status === "closed" ||
    isThreadTermination(selectedConversation?.lastMessage) ||
    messages.some((entry) => isThreadTermination(entry))
  );

  function applyClosedThreadState(closureMessage = null) {
    const closedAt = closureMessage?.sentAt || closureMessage?.createdAt || new Date().toISOString();
    if (closureMessage) {
      setMessages((current) => (current.some((entry) => entry.id === closureMessage.id) ? current : [...current, closureMessage]));
    }
    mergeConversation({
      ...(selectedConversation || {}),
      listingId: activeListingId,
      updatedAt: closedAt,
      lastMessage: closureMessage || selectedConversation?.lastMessage || null,
      status: "closed",
      closedAt,
    });
    setWarning("This thread is closed. Messages, offers, and meetup actions are disabled.");
  }

  function mergeConversation(nextConversation) {
    if (!nextConversation?.listingId) return;
    const normalizedConversation = {
      ...nextConversation,
      status: nextConversation.status || "open",
      closedAt: nextConversation.closedAt || null,
      updatedAt: nextConversation.updatedAt || new Date().toISOString(),
    };

    setSelectedConversation(normalizedConversation);
    setConversations((current) => {
      const remaining = current.filter((item) => item.listingId !== normalizedConversation.listingId);
      return sortThreads([normalizedConversation, ...remaining]);
    });
  }

  function applyWorkspaceSnapshot(workspace, listingId, sourceConversations = conversations, seededConversation = null) {
    const nextMessages = hydrateLoadedMessages(workspace?.messages || [], currentProfileId);
    const nextOffers = workspace?.offers || [];
    const nextSchedules = workspace?.schedules || [];
    const discoveredConversation = workspace?.conversation || null;
    const selected =
      discoveredConversation ||
      sourceConversations.find((item) => item.listingId === listingId) ||
      seededConversation ||
      buildThreadPreview(workspace?.listing || null, auth) ||
      null;
    const nextStatus = nextMessages.some((entry) => isThreadTermination(entry))
      ? "closed"
      : discoveredConversation?.status || selected?.status || "open";

    setMessages(nextMessages);
    setOffers(nextOffers);
    setSchedules(nextSchedules);

    if (selected) {
      mergeConversation({
        ...selected,
        ...(discoveredConversation || {}),
        listing: discoveredConversation?.listing || workspace?.listing || selected.listing || null,
        status: nextStatus,
        closedAt: nextStatus === "closed" ? nextMessages.find((entry) => isThreadTermination(entry))?.sentAt || selected.closedAt || null : null,
      });
    } else {
      setSelectedConversation(null);
    }
  }

  function openConversation(conversation, sourceConversations = conversations, options = {}) {
    if (!conversation?.listingId) return;
    const workspacePath = `/chat/${conversation.listingId}/workspace`;
    const cachedWorkspace = !options.bypassCache ? peekApiCache(workspacePath, auth, CHAT_CACHE_OPTIONS) : null;
    mergeConversation(conversation);
    if (cachedWorkspace?.data) {
      applyWorkspaceSnapshot(cachedWorkspace.data, conversation.listingId, sourceConversations, conversation);
    } else {
      setMessages([]);
      setOffers([]);
      setSchedules([]);
    }
    setWorkspaceLoading(true);
    loadConversationWorkspace(conversation.listingId, sourceConversations, conversation, options)
      .catch(() => setMessage("Could not load thread."))
      .finally(() => setWorkspaceLoading(false));
  }

  async function loadConversationWorkspace(listingId, sourceConversations = conversations, seededConversation = null, options = {}) {
    if (!listingId) return;
    const requestId = ++workspaceRequestRef.current;
    const workspacePath = `/chat/${listingId}/workspace`;
    const cachedWorkspace = !options.bypassCache ? peekApiCache(workspacePath, auth, CHAT_CACHE_OPTIONS) : null;

    if (cachedWorkspace?.data) {
      if (requestId === workspaceRequestRef.current) {
        applyWorkspaceSnapshot(cachedWorkspace.data, listingId, sourceConversations, seededConversation);
      }
    }

    const workspaceResponse = await apiFetch(workspacePath, auth, {
      ...CHAT_CACHE_OPTIONS,
      bypassCache: options.bypassCache === true,
    }).catch(() => ({ data: null }));

    if (requestId !== workspaceRequestRef.current) {
      return;
    }
    const workspace = workspaceResponse.data || null;
    applyWorkspaceSnapshot(workspace, listingId, sourceConversations, seededConversation);
  }

  async function openListingWorkspace(listingId, sourceConversations = conversations, options = {}) {
    if (!listingId) return;
    const existingConversation = sourceConversations.find((item) => item.listingId === listingId) || null;
    await loadConversationWorkspace(listingId, sourceConversations, existingConversation, options);
  }

  async function loadConversations(options = {}) {
    if (!signedInLike) return;
    const cachedConversations = !options.bypassCache ? peekApiCache("/chat", auth, CHAT_CACHE_OPTIONS) : null;
    const seededConversations = sortThreads(cachedConversations?.data || []);
    const targetListingId = requestedListingId || selectedConversation?.listingId || "";
    const cachedWorkspace =
      !options.bypassCache && targetListingId ? peekApiCache(`/chat/${targetListingId}/workspace`, auth, CHAT_CACHE_OPTIONS) : null;
    const hasWarmCache = seededConversations.length > 0 || !!cachedWorkspace?.data;

    if (!options.silent) setWorkspaceLoading(!hasWarmCache);

    if (seededConversations.length) {
      setConversations(seededConversations);
    }

    if (cachedWorkspace?.data) {
      await loadConversationWorkspace(targetListingId, seededConversations.length ? seededConversations : conversations, selectedConversation, { ...options, bypassCache: false });
    }

    try {
      const response = await apiFetch("/chat", auth, {
        ...CHAT_CACHE_OPTIONS,
        bypassCache: options.bypassCache === true,
      }).catch(() => ({ data: [] }));
      const nextConversations = sortThreads(response.data || []);
      setConversations(nextConversations);

      if (requestedListingId) {
        await openListingWorkspace(requestedListingId, nextConversations, options);
      } else if (selectedConversation?.listingId) {
        await loadConversationWorkspace(selectedConversation.listingId, nextConversations, selectedConversation, options);
      } else {
        setMessages([]);
        setOffers([]);
        setSchedules([]);
      }
    } finally {
      setWorkspaceLoading(false);
    }
  }

  useEffect(() => {
    loadConversations().catch(() => {
      setWorkspaceLoading(false);
      setMessage("Could not load messages.");
    });
  }, [signedInLike, requestedListingId, auth.accessToken, auth.overrideSecret, auth.devEmail]);

  useEffect(() => {
    if (!signedInLike) return undefined;
    const interval = window.setInterval(() => {
      loadConversations({ silent: true }).catch(() => null);
    }, 45000);
    return () => window.clearInterval(interval);
  }, [signedInLike, requestedListingId, activeListingId, auth.accessToken, auth.overrideSecret, auth.devEmail]);

  useEffect(() => {
    if (!message) return undefined;
    const timer = window.setTimeout(() => setMessage(""), 2400);
    return () => window.clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    if (!warning) return undefined;
    const timer = window.setTimeout(() => setWarning(""), 3200);
    return () => window.clearTimeout(timer);
  }, [warning]);

  useEffect(() => {
    if (!threadRef.current) return;
    threadRef.current.scrollTop = threadRef.current.scrollHeight;
  }, [messages.length, selectedConversation?.listingId]);

  const stats = useMemo(
    () => ({
      threads: conversations.length,
      pendingOffers: offers.filter((item) => item.status === "pending").length,
      activeMeetups: schedules.filter((item) => ["proposed", "confirmed", "reschedule_requested"].includes(item.status)).length,
      unreadThreads: conversations.filter((item) => item.unreadCount > 0).length,
    }),
    [conversations, offers, schedules],
  );

  const threadItems = useMemo(() => {
    if (!selectedConversation) return conversations;
    if (conversations.some((item) => item.listingId === selectedConversation.listingId)) return conversations;
    return sortThreads([selectedConversation, ...conversations]);
  }, [conversations, selectedConversation]);

  async function sendMessage(event) {
    event.preventDefault();
    if (!activeListingId || !draft.trim() || threadClosed) return;

    const normalizedDraft = sanitizeMessageText(draft.trim());
    const localReview = reviewLocalChatDraft(draft.trim());
    if (localReview.blocked) {
      setWarning(localReview.warning);
      return;
    }

    const optimisticMessage = buildOptimisticMessage(auth, normalizedDraft);
    setBusy("message");
    setDraft("");
    setWarning(localReview.warning || "");
    setMessages((current) => [...current, optimisticMessage]);
    mergeConversation({
      ...(selectedConversation || {}),
      listingId: activeListingId,
      updatedAt: optimisticMessage.sentAt,
      lastMessage: optimisticMessage,
      status: "open",
    });

    try {
      const moderation = await Promise.race([
        apiFetch("/ai/moderate/chat", auth, {
          method: "POST",
          body: { listingId: activeListingId, message: normalizedDraft },
        }).catch(() => null),
        new Promise((resolve) => window.setTimeout(() => resolve(null), 1800)),
      ]);

      if (isHighRiskModerationResult(moderation)) {
        setMessages((current) => current.filter((entry) => entry.id !== optimisticMessage.id));
        setDraft(normalizedDraft);
        setWarning(moderation?.data?.warning || "Message blocked because it triggered safety checks.");
        return;
      }

      if (moderation?.data?.warning) {
        setWarning(moderation.data.warning);
      }

      const response = await apiFetch(`/chat/${activeListingId}/messages`, auth, {
        method: "POST",
        body: { message: normalizedDraft },
        invalidatePaths: ["/chat"],
      });
      const confirmedMessage = response.data
        ? { ...response.data, deliveryState: "sent" }
        : { ...optimisticMessage, pending: false, deliveryState: "sent" };

      setMessages((current) => current.map((entry) => (entry.id === optimisticMessage.id ? confirmedMessage : entry)));
      mergeConversation({
        ...(selectedConversation || {}),
        listingId: activeListingId,
        updatedAt: confirmedMessage.sentAt || new Date().toISOString(),
        lastMessage: confirmedMessage,
        status: "open",
      });
      refreshNotifications({ bypassCache: true }).catch(() => null);
      loadConversations({ bypassCache: true, silent: true }).catch(() => null);
    } catch (error) {
      setMessages((current) => current.filter((entry) => entry.id !== optimisticMessage.id));
      setDraft(normalizedDraft);
      if (error?.code === "CHAT_TERMINATED") {
        applyClosedThreadState();
        return;
      }
      setMessage(error.message || "Could not send message.");
    } finally {
      setBusy("");
    }
  }

  async function terminateThread() {
    if (!activeListingId || threadClosed) return;
    setBusy("terminate");
    try {
      const response = await apiFetch(`/chat/${activeListingId}/terminate`, auth, {
        method: "POST",
        invalidatePaths: ["/chat"],
      });
      applyClosedThreadState(response.data);
      refreshNotifications({ bypassCache: true }).catch(() => null);
      loadConversations({ bypassCache: true, silent: true }).catch(() => null);
    } catch (error) {
      setMessage(error.message || "Could not terminate this thread.");
    } finally {
      setBusy("");
    }
  }

  async function sendOffer(event) {
    event.preventDefault();
    if (!activeListingId || !offerAmount || threadClosed) return;
    setBusy("offer");
    try {
      await apiFetch(`/listings/${activeListingId}/offers`, auth, {
        method: "POST",
        body: {
          amount: Number(offerAmount),
          note: sanitizeMessageText(offerNote) || undefined,
        },
        invalidatePaths: ["/chat", `/listings/${activeListingId}`],
      });
      setOfferAmount("");
      setOfferNote("");
      await loadConversationWorkspace(activeListingId, threadItems, selectedConversation, { bypassCache: true });
      loadConversations({ bypassCache: true, silent: true }).catch(() => null);
      refreshNotifications({ bypassCache: true }).catch(() => null);
    } catch (error) {
      if (error?.code === "CHAT_TERMINATED") {
        applyClosedThreadState();
        return;
      }
      setMessage(error.message || "Could not send offer.");
    } finally {
      setBusy("");
    }
  }

  async function updateOffer(offerId, status) {
    if (threadClosed) return;
    setBusy(offerId);
    try {
      await apiFetch(`/listings/offers/${offerId}`, auth, {
        method: "PATCH",
        body: { status },
        invalidatePaths: ["/chat", `/listings/${activeListingId}`],
      });
      await loadConversationWorkspace(activeListingId, threadItems, selectedConversation, { bypassCache: true });
      refreshNotifications({ bypassCache: true }).catch(() => null);
    } catch (error) {
      if (error?.code === "CHAT_TERMINATED") {
        applyClosedThreadState();
        return;
      }
      setMessage(error.message || "Could not update offer.");
    } finally {
      setBusy("");
    }
  }

  async function updateSchedule(scheduleId, status) {
    if (!scheduleId || threadClosed) return;
    setBusy(scheduleId);
    try {
      await apiFetch(`/schedules/${scheduleId}`, auth, {
        method: "PATCH",
        body: { status },
        invalidatePaths: ["/chat", "/schedules"],
      });
      await loadConversationWorkspace(activeListingId, threadItems, selectedConversation, { bypassCache: true });
      refreshNotifications({ bypassCache: true }).catch(() => null);
      setMessage(
        status === "confirmed"
          ? "Your meetup confirmation is saved."
          : status === "completed"
            ? "Meetup marked as completed."
          : "Meetup updated.",
      );
    } catch (error) {
      if (error?.code === "CHAT_TERMINATED") {
        applyClosedThreadState();
        return;
      }
      setMessage(error.message || "Could not update meetup.");
    } finally {
      setBusy("");
    }
  }

  if (!signedInLike) {
    return (
      <div className="v2-workspace-page">
        <PageHeader
          compact
          eyebrow="Messages"
          title="Sign in to send and receive messages."
          description="Messages, offers, and meetups stay connected to the listing and seller inside the app."
        />
      </div>
    );
  }

  return (
    <div className="v2-workspace-page">
      <PageHeader
        compact
        eyebrow="Messages"
        title="Messages, offers, and meetup planning in one thread."
        description="Fast thread updates, in-app safety checks, and transaction context stay together here without the old three-request thread load."
      />

      <section className="v2-thread-stage">
        <article className="v2-thread-stage-card">
          <span>Thread focus</span>
          <strong>{selectedConversation?.listingTitle || "Open a listing-linked thread"}</strong>
          <small>{threadClosed ? "Thread is closed and preserved as record." : "Messages, offers, and meetups stay in one surface."}</small>
        </article>
        <article className="v2-thread-stage-card">
          <span>Safety lane</span>
          <strong>{warning ? "Needs attention" : "Guardrails active"}</strong>
          <small>{warning || "Private contact details and abusive phrasing are screened before send."}</small>
        </article>
        <article className="v2-thread-stage-card">
          <span>Seller context</span>
          <strong>{selectedConversation?.participant?.fullName || "Campus participant"}</strong>
          <small>{selectedConversation?.listing?.area || "Open a thread to pin listing context."}</small>
        </article>
      </section>

      <div className="v2-metric-grid v2-metric-grid-wide">
        <MetricTile label="Threads" value={stats.threads} detail="listing-linked conversations" tone="buying" />
        <MetricTile label="Unread" value={stats.unreadThreads} detail="threads to reopen" tone="neutral" />
        <MetricTile label="Pending offers" value={stats.pendingOffers} detail="live negotiation state" tone="selling" />
        <MetricTile label="Active meetups" value={stats.activeMeetups} detail="handoffs in motion" tone="safety" />
      </div>

      {threadClosed && selectedConversation ? (
        <NoticeBanner
          tone="safety"
          title="Thread closed"
          description="This chat is preserved as record only. You can read it, but sending messages, offers, and meetup actions is disabled."
          className="v2-page-alert"
        />
      ) : null}
      {message ? <NoticeBanner tone="neutral" title="Thread update" description={message} className="v2-page-alert" /> : null}

      {!threadItems.length && !selectedConversation ? (
        <Surface
          title="No conversations yet"
          description="Start from a listing and message the seller to open the first thread."
          actions={<Button href="/marketplace">Browse listings</Button>}
        >
          <EmptyBlock title="Your inbox is clear" description="Listing-linked chats, offers, and meetup updates will appear here once you start a conversation." />
        </Surface>
      ) : (
        <div className="v2-message-layout">
          <Surface title="Threads" description="Open a listing-linked conversation directly from the sidebar." className="v2-message-thread-panel">
            {threadItems.length ? (
              <div className="v2-thread-column">
                <div className="v2-thread-list">
                  {threadItems.map((conversation) => {
                    const thumb = getListingThumb(conversation.listing);
                    const closed = conversation.status === "closed" || isThreadTermination(conversation.lastMessage);
                    return (
                      <article
                        key={conversation.id}
                        className={`v2-thread-card ${selectedConversation?.listingId === conversation.listingId ? "v2-thread-card-active" : ""}`}
                      >
                        <button
                          type="button"
                          className="v2-thread-card-main"
                          onClick={() => openConversation(conversation, conversations)}
                        >
                          <div className="v2-thread-thumb">
                            {thumb ? <img src={thumb} alt={conversation.listingTitle} /> : <span>{conversation.listing?.category || "Item"}</span>}
                          </div>
                          <div className="v2-thread-copy">
                            <div className="v2-thread-row-top">
                              <strong>{conversation.listingTitle}</strong>
                              <small>{formatDate(conversation.updatedAt)}</small>
                            </div>
                            <span>{conversation.participant?.fullName || "Campus user"}</span>
                            <small className="v2-thread-preview">{threadPreviewText(conversation, currentProfileId)}</small>
                          </div>
                          <div className="v2-thread-meta">
                            {closed ? <StatusPill tone="safety">closed</StatusPill> : null}
                            {!closed && conversation.unreadCount ? <StatusPill tone="buying">{conversation.unreadCount}</StatusPill> : null}
                          </div>
                        </button>
                      </article>
                    );
                  })}
                </div>
              </div>
            ) : (
              <EmptyBlock title="No conversations yet" description="Open a listing and message the seller to start the first thread." />
            )}
          </Surface>

          <div className="v2-message-main">
            <Surface title="Active thread" description="Listing context stays pinned while the thread scrolls." className="v2-message-summary-surface">
              {selectedConversation ? (
                <div className="v2-thread-header-card">
                  <Link href={`/listings/${selectedConversation.listingId}`} className="v2-thread-header-thumb">
                    {getListingThumb(selectedConversation.listing) ? (
                      <img src={getListingThumb(selectedConversation.listing)} alt={selectedConversation.listingTitle} />
                    ) : (
                      <span>{selectedConversation.listing?.category || "Item"}</span>
                    )}
                  </Link>
                  <div className="v2-thread-header-copy">
                    <strong>{selectedConversation.listingTitle}</strong>
                    <span>{selectedConversation.participant?.fullName || "Campus user"} / {selectedConversation.listing?.area || "Campus"}</span>
                    <div className="v2-stack-inline">
                      <StatusPill tone="buying">{formatCurrency(selectedConversation.listing?.price || 0)}</StatusPill>
                      <StatusPill tone={threadClosed ? "safety" : selectedConversation.listing?.status === "active" ? "selling" : "safety"}>
                        {threadClosed ? "chat closed" : statusLabel(selectedConversation.listing?.status || "active")}
                      </StatusPill>
                    </div>
                  </div>
                  <div className="v2-page-header-actions">
                    <Button href={`/listings/${selectedConversation.listingId}`} variant="secondary">Open listing</Button>
                    {selectedConversation.participant?.id ? <Button href={`/profiles/${selectedConversation.participant.id}`} variant="ghost">View seller</Button> : null}
                    <Button variant="ghost" onClick={terminateThread} loading={busy === "terminate"} disabled={threadClosed}>
                      {threadClosed ? "Closed" : "Terminate thread"}
                    </Button>
                  </div>
                </div>
              ) : (
                <EmptyBlock title="Choose a thread" description="Pick a conversation from the left to continue the transaction." />
              )}
            </Surface>

            <Surface
              title="Conversation"
              description="Messages are moderated, private details are blocked, and risky phrasing is flagged."
              className="v2-message-conversation-surface"
            >
              <div className="v2-message-thread" ref={threadRef}>
                {messages.length ? (
                  messages.map((entry) => (
                    <article key={entry.id} className={`v2-message-bubble ${bubbleTone(entry, auth.profile?.id)}`}>
                      <div className="v2-message-bubble-head">
                        <div className="v2-message-avatar">{String(entry.sender?.fullName || "U").charAt(0).toUpperCase()}</div>
                        <div className="v2-message-bubble-copy">
                          <strong>{entry.sender?.fullName || (isThreadTermination(entry) ? "UniKart" : "Campus user")}</strong>
                          <small className="v2-message-bubble-meta">
                            <span>{formatDate(entry.sentAt || entry.createdAt)}</span>
                            {!isThreadTermination(entry) && entry.senderProfileId === currentProfileId && !entry.pending ? (
                              <span className={`v2-message-delivery v2-message-delivery-${entry.deliveryState === "delivered" ? "delivered" : "sent"}`}>
                                <Icon name={entry.deliveryState === "delivered" ? "check-double" : "check"} />
                              </span>
                            ) : null}
                          </small>
                        </div>
                      </div>
                      <p>{isThreadTermination(entry) ? entry.text || "This chat has been terminated." : sanitizeMessageText(entry.text)}</p>
                      {entry.pending ? <StatusPill tone="neutral">sending...</StatusPill> : null}
                      {entry.riskFlags?.length && !isThreadTermination(entry) ? (
                        <div className="v2-stack-inline">
                          {entry.riskFlags.map((flag) => <StatusPill key={flag} tone="safety">{flag.replaceAll("_", " ")}</StatusPill>)}
                        </div>
                      ) : null}
                    </article>
                  ))
                ) : (
                  <EmptyBlock title="No messages in this thread yet" description="This listing is ready for the first in-app message." />
                )}
              </div>

              {threadClosed ? (
                <p className="v2-chat-termination-note">This thread has been terminated. Further messages and offers are disabled.</p>
              ) : null}

              <form className="v2-message-composer" onSubmit={sendMessage}>
                <textarea
                  rows={2}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder={threadClosed ? "Thread closed" : "Ask about condition, accessories, price, or meetup timing."}
                  disabled={isOwnListingThread || threadClosed}
                />
                <div className="v2-message-composer-actions">
                  <Button type="submit" loading={busy === "message"} disabled={!activeListingId || isOwnListingThread || threadClosed}>
                    {isOwnListingThread ? "Own listing" : threadClosed ? "Closed" : "Send"}
                  </Button>
                </div>
              </form>

              {isOwnListingThread ? <NoticeBanner tone="safety" description="You cannot message your own listing from the buyer chat flow." className="v2-inline-alert" /> : null}
              {warning ? <NoticeBanner tone="safety" description={warning} className="v2-inline-alert" /> : null}
            </Surface>
          </div>

          <div className="v2-detail-side v2-message-side-column">
            <Surface title="Offers" description="Negotiation stays compact and scrollable instead of stretching the layout." className="v2-panel-scroll v2-message-side-surface">
              {offers.length ? (
                <div className="v2-inline-list">
                  {offers.map((offer) => (
                    <div key={offer.id} className={`v2-offer-box v2-offer-box-${offerStatusTone(offer.status)}`}>
                      <div>
                        <strong>{offer.kind === "counter_offer" ? "Counter offer" : "Offer"} / {formatCurrency(offer.amount)}</strong>
                        <span>{offer.actor?.fullName || "Participant"} / {statusLabel(offer.status)}</span>
                      </div>
                      {offer.note ? <p>{sanitizeMessageText(offer.note)}</p> : null}
                      {canRespondToOffer(offer, currentProfileId) ? (
                        <div className="v2-inline-actions">
                          <button type="button" className="v2-card-icon-button" onClick={() => updateOffer(offer.id, "accepted")} disabled={busy === offer.id || threadClosed}>Accept</button>
                          <button type="button" className="v2-card-icon-button" onClick={() => updateOffer(offer.id, "rejected")} disabled={busy === offer.id || threadClosed}>Reject</button>
                        </div>
                      ) : offer.status === "pending" && currentProfileId === offer.buyerProfileId && currentProfileId === offer.sellerProfileId ? (
                        <p className="v2-offer-helper">Open the counterpart account to respond to this offer.</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyBlock title="No offers yet" description="Use the form below when you want to negotiate directly inside the thread." />
              )}

              <form className="v2-field-stack" onSubmit={sendOffer}>
                <input type="number" min="0" value={offerAmount} onChange={(event) => setOfferAmount(event.target.value)} placeholder="Offer amount" disabled={threadClosed} />
                <textarea rows={3} value={offerNote} onChange={(event) => setOfferNote(event.target.value)} placeholder={userIsSeller ? "Counter-offer note" : "Optional offer note"} disabled={threadClosed} />
                <Button type="submit" loading={busy === "offer"} disabled={!activeListingId || !offerAmount || isOwnListingThread || threadClosed}>
                  {threadClosed ? "Closed" : userIsSeller ? "Send counter offer" : "Send offer"}
                </Button>
              </form>
            </Surface>

            <Surface
              title="Meetups"
              description="Upcoming coordination stays attached to the same listing thread."
              className="v2-panel-scroll v2-message-side-surface"
              actions={activeListingId ? <Button href={`/schedules?listingId=${activeListingId}`} variant="secondary">Open scheduler</Button> : null}
            >
              {schedules.length ? (
                <div className="v2-inline-list">
                  {schedules.map((schedule) => (
                    <div key={schedule.id} className="v2-inline-row v2-inline-row-stack">
                      <div>
                        <strong>{statusLabel(schedule.requestedMode)}</strong>
                        <span>{statusLabel(schedule.status)} / {formatDate(schedule.confirmedTime || schedule.proposedTime)}</span>
                        {schedule.meetupLocation?.label ? <span>{schedule.meetupLocation.label}</span> : null}
                        {schedule.meetupRoute ? <span>{formatMeetupRoute(schedule.meetupRoute)}</span> : null}
                        <span>{scheduleConfirmationSummary(schedule)}</span>
                      </div>
                      <div className="v2-inline-actions">
                        <Link href={`/schedules?listingId=${schedule.listingId}`} className="v2-card-icon-button">Open</Link>
                        {canConfirmSchedule(schedule, currentProfileId) ? (
                          <button type="button" className="v2-card-icon-button" onClick={() => updateSchedule(schedule.id, "confirmed")} disabled={busy === schedule.id || threadClosed}>Confirm</button>
                        ) : null}
                        {canCompleteSchedule(schedule, currentProfileId) ? (
                          <button type="button" className="v2-card-icon-button" onClick={() => updateSchedule(schedule.id, "completed")} disabled={busy === schedule.id || threadClosed}>Complete</button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyBlock
                  title="No meetup set yet"
                  description="Create a meetup proposal from this thread, then let both sides confirm it."
                  action={activeListingId ? <Button href={`/schedules?listingId=${activeListingId}`} variant="secondary">Create meetup</Button> : null}
                />
              )}
            </Surface>
          </div>
        </div>
      )}

      {workspaceLoading && !threadItems.length && !messages.length ? <NoticeBanner tone="neutral" title="Refreshing" description="Syncing latest messages, offers, and meetup state." className="v2-page-alert" /> : null}
    </div>
  );
}
