"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useV2AppState } from "@/components/v2-app-providers";
import { Button, EmptyBlock, MetricTile, NoticeBanner, PageHeader, StatusPill, Surface } from "@/components/system/primitives";
import { SelectField } from "@/components/system/select-field";
import { apiFetch, formatCurrency } from "@/lib/api";

const baseDraft = { title: "", description: "", price: "", inventoryCount: "1", category: "electronics", condition: "like_new", area: "", tags: "", negotiable: true, mode: "sale", dailyRate: "", weeklyRate: "", deposit: "", bundleCount: "", bundleSummary: "", brand: "", includedItems: "", meetupNotes: "", usageHighlights: "", preferredContactWindow: "", exactLocationHint: "", fulfillmentModes: ["meetup"] };
const categoryOptions = [["electronics", "Electronics"], ["books", "Books"], ["hostel-essentials", "Hostel essentials"], ["cycle", "Cycle"], ["furniture", "Furniture"], ["fashion", "Fashion"], ["appliances", "Appliances"], ["lab-equipment", "Lab equipment"]];
const conditionOptions = [["like_new", "Like new"], ["good", "Good"], ["fair", "Fair"]];
const modeOptions = [["sale", "Sale"], ["rent", "Rent"], ["bundle", "Bundle"]];
const fulfillmentOptions = [["meetup", "Meetup"], ["pickup", "Pickup"], ["campus-drop", "Campus drop"], ["hostel-meetup", "Hostel meetup"]];

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ url: reader.result, name: file.name, type: file.type || "image" });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function toggleModeValue(values, mode) {
  return values.includes(mode) ? values.filter((item) => item !== mode) : [...values, mode];
}

function listingPayload(draft, media, status) {
  return {
    title: draft.title.trim(),
    description: draft.description.trim(),
    price: Number(draft.price),
    inventoryCount: Number(draft.inventoryCount || 1),
    category: draft.category,
    condition: draft.condition,
    negotiable: !!draft.negotiable,
    fulfillmentModes: draft.fulfillmentModes,
    area: draft.area.trim(),
    imageUrls: media.map((item) => item.url),
    mediaAssetIds: media.map((item) => item.assetId).filter(Boolean),
    tags: draft.tags.split(",").map((item) => item.trim()).filter(Boolean),
    status,
    mode: draft.mode,
    rentDetails: draft.mode === "rent" ? { dailyRate: Number(draft.dailyRate || 0) || undefined, weeklyRate: Number(draft.weeklyRate || 0) || undefined, deposit: Number(draft.deposit || 0) || undefined } : undefined,
    bundleDetails: draft.mode === "bundle" ? { itemCount: Number(draft.bundleCount || 0) || undefined, summary: draft.bundleSummary || undefined } : undefined,
    listingMetadata: { brand: draft.brand || undefined, includedItems: draft.includedItems || undefined, meetupNotes: draft.meetupNotes || undefined, usageHighlights: draft.usageHighlights || undefined, preferredContactWindow: draft.preferredContactWindow || undefined, exactLocationHint: draft.exactLocationHint || undefined },
  };
}

function listingToDraft(listing) {
  return {
    ...baseDraft,
    title: listing.title || "",
    description: listing.description || "",
    price: listing.price === 0 || listing.price ? String(listing.price) : "",
    inventoryCount: String(listing.inventoryCount || 1),
    category: listing.category || baseDraft.category,
    condition: listing.condition || baseDraft.condition,
    area: listing.area || "",
    tags: (listing.tags || []).join(", "),
    negotiable: listing.negotiable ?? true,
    mode: listing.mode || "sale",
    dailyRate: listing.rentDetails?.dailyRate === 0 || listing.rentDetails?.dailyRate ? String(listing.rentDetails.dailyRate) : "",
    weeklyRate: listing.rentDetails?.weeklyRate === 0 || listing.rentDetails?.weeklyRate ? String(listing.rentDetails.weeklyRate) : "",
    deposit: listing.rentDetails?.deposit === 0 || listing.rentDetails?.deposit ? String(listing.rentDetails.deposit) : "",
    bundleCount: listing.bundleDetails?.itemCount ? String(listing.bundleDetails.itemCount) : "",
    bundleSummary: listing.bundleDetails?.summary || "",
    brand: listing.listingMetadata?.brand || "",
    includedItems: listing.listingMetadata?.includedItems || "",
    meetupNotes: listing.listingMetadata?.meetupNotes || "",
    usageHighlights: listing.listingMetadata?.usageHighlights || "",
    preferredContactWindow: listing.listingMetadata?.preferredContactWindow || "",
    exactLocationHint: listing.listingMetadata?.exactLocationHint || "",
    fulfillmentModes: (listing.fulfillmentModes || []).length ? listing.fulfillmentModes : ["meetup"],
  };
}

function listingToMedia(listing) {
  const assets = (listing.mediaAssets || []).filter((item) => item.publicUrl).map((item, index) => ({ url: item.publicUrl, name: item.originalFilename || `asset-${index + 1}`, type: item.mediaKind || "image", assetId: item.id }));
  return assets.length ? assets : (listing.imageUrls || []).filter(Boolean).map((url, index) => ({ url, name: `image-${index + 1}`, type: "image" }));
}

function formatSearchAssist(searchAssist) {
  if (!searchAssist) return [];
  const items = [];
  if (searchAssist.rewrittenQuery) items.push(`Try: ${searchAssist.rewrittenQuery}`);
  if (searchAssist.suggestedCategory) items.push(`Category: ${searchAssist.suggestedCategory}`);
  if (searchAssist.suggestedMode) items.push(`Mode: ${searchAssist.suggestedMode}`);
  if (searchAssist.suggestedFilters?.condition) items.push(`Condition: ${searchAssist.suggestedFilters.condition}`);
  if (searchAssist.suggestedFilters?.deliveryAvailable) items.push("Delivery-friendly matches");
  if (searchAssist.guidance) items.push(searchAssist.guidance);
  return items;
}

export function V2SellPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { auth, signedInLike } = useV2AppState();
  const [draft, setDraft] = useState(baseDraft);
  const [media, setMedia] = useState([]);
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const [aiOutput, setAiOutput] = useState(null);
  const [moderation, setModeration] = useState(null);
  const [searchAssist, setSearchAssist] = useState(null);
  const [createdListing, setCreatedListing] = useState(null);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState(null);
  const [editorListingId, setEditorListingId] = useState("");
  const [editorStatus, setEditorStatus] = useState("");

  const requestedDraftId = searchParams.get("draft");
  const isEditing = Boolean(editorListingId);

  const draftBlockers = useMemo(() => {
    const blockers = [];
    if (!draft.title.trim() || draft.title.trim().length < 3) blockers.push("Add at least a short title.");
    if (!draft.description.trim() || draft.description.trim().length < 10) blockers.push("Add a short draft description.");
    if (draft.price === "" || Number(draft.price) < 0) blockers.push("Set a valid price.");
    if (!draft.area.trim() || draft.area.trim().length < 2) blockers.push("Specify a campus area.");
    if (!draft.fulfillmentModes.length) blockers.push("Choose at least one fulfillment mode.");
    if (!media.length) blockers.push("Add at least one image.");
    return blockers;
  }, [draft, media.length]);

  const readiness = useMemo(() => {
    const blockers = [];
    if (!draft.title.trim() || draft.title.trim().length < 6) blockers.push("Add a clearer title.");
    if (!draft.description.trim() || draft.description.trim().length < 40) blockers.push("Add a more useful description.");
    if (draft.price === "" || Number(draft.price) < 0) blockers.push("Set a valid price.");
    if (!draft.area.trim() || draft.area.trim().length < 2) blockers.push("Specify a campus area.");
    if (!draft.fulfillmentModes.length) blockers.push("Choose at least one fulfillment mode.");
    if (!media.length) blockers.push("Add at least one image.");
    if (draft.mode === "rent" && !draft.dailyRate) blockers.push("Set a rent price.");
    if (draft.mode === "bundle" && !draft.bundleSummary.trim()) blockers.push("Explain what is included in the bundle.");
    return blockers;
  }, [draft, media.length]);

  const completeness = useMemo(() => {
    let score = 20;
    if (draft.title.trim().length >= 12) score += 10;
    if (draft.description.trim().length >= 80) score += 16;
    if (draft.area.trim()) score += 8;
    if (draft.tags.trim()) score += 8;
    if (draft.brand.trim()) score += 6;
    if (draft.includedItems.trim()) score += 6;
    if (media.length >= 1) score += 10;
    if (media.length >= 3) score += 10;
    if (draft.fulfillmentModes.length >= 1) score += 8;
    if (draft.preferredContactWindow.trim()) score += 4;
    if (draft.mode === "rent" && draft.dailyRate) score += 6;
    if (draft.mode === "bundle" && draft.bundleSummary.trim()) score += 8;
    return Math.min(score, 100);
  }, [draft, media.length]);

  useEffect(() => {
    if (!notice || notice.tone === "safety" || busy) return undefined;
    const timer = window.setTimeout(() => setNotice((current) => (current === notice ? null : current)), 3200);
    return () => window.clearTimeout(timer);
  }, [notice, busy]);

  useEffect(() => {
    if (!requestedDraftId || requestedDraftId === editorListingId) return undefined;
    let cancelled = false;
    setBusy("load-draft");
    setNotice({ tone: "buying", title: "Opening saved draft", description: "Pulling your listing back into the studio so you can keep editing it." });
    apiFetch(`/listings/${requestedDraftId}`, auth, { bypassCache: true }).then((response) => {
      if (cancelled) return;
      const listing = response.data || null;
      if (!listing) throw new Error("Draft not found.");
      setDraft(listingToDraft(listing));
      setMedia(listingToMedia(listing));
      setActiveMediaIndex(0);
      setAiOutput(null);
      setModeration(null);
      setSearchAssist(null);
      setCreatedListing(null);
      setEditorListingId(listing.id);
      setEditorStatus(listing.status || "draft");
      setNotice({ tone: "buying", title: listing.status === "draft" ? "Draft loaded" : "Listing loaded", description: listing.status === "draft" ? "Edit the draft here, then publish when the checks turn green." : "You are editing an existing listing in the studio." });
    }).catch((error) => {
      if (!cancelled) setNotice({ tone: "safety", title: "Could not open this draft", description: error.message || "Try reopening it from your profile." });
    }).finally(() => {
      if (!cancelled) setBusy("");
    });
    return () => {
      cancelled = true;
    };
  }, [requestedDraftId, editorListingId, auth]);

  async function handleMedia(event) {
    const files = Array.from(event.target.files || []).slice(0, 6);
    const nextMedia = [];
    for (const file of files) nextMedia.push(await readFileAsDataUrl(file));
    setMedia(nextMedia);
    setActiveMediaIndex(0);
  }

  function removeMediaAt(index) {
    const nextLength = Math.max(0, media.length - 1);
    setMedia((current) => current.filter((_, itemIndex) => itemIndex !== index));
    setActiveMediaIndex((currentIndex) => Math.max(0, Math.min(currentIndex, nextLength - 1)));
  }

  function clearStudio() {
    setDraft(baseDraft);
    setMedia([]);
    setAiOutput(null);
    setModeration(null);
    setSearchAssist(null);
    setCreatedListing(null);
    setActiveMediaIndex(0);
    setEditorListingId("");
    setEditorStatus("");
    setBusy("");
    setNotice({ tone: "neutral", title: "Studio cleared", description: "Start a new draft whenever you are ready." });
    if (requestedDraftId) router.replace("/sell", { scroll: false });
  }

  async function runAi() {
    setBusy("ai");
    setNotice({ tone: "buying", title: "Generating suggestions", description: "AI is checking structure, search hooks, and moderation hints for this draft." });
    try {
      const [assistResponse, searchResponse, moderationResponse] = await Promise.all([
        apiFetch("/ai/listing-assist", auth, { method: "POST", body: { title: draft.title || "Campus listing draft", description: draft.description || "Campus listing draft with incomplete description.", category: draft.category, price: Number(draft.price || 0) } }),
        apiFetch("/ai/search-assist", auth, { method: "POST", body: { query: [draft.title, draft.category, draft.tags].filter(Boolean).join(" ") } }).catch(() => ({ data: null })),
        apiFetch("/ai/moderate/listing", auth, { method: "POST", body: { title: draft.title || "Campus listing draft", description: draft.description || "Campus listing draft with incomplete description.", category: draft.category, price: Number(draft.price || 0) } }).catch(() => ({ data: null })),
      ]);
      setAiOutput(assistResponse.data || null);
      setSearchAssist(searchResponse.data || null);
      setModeration(moderationResponse.data || null);
      setNotice({ tone: "buying", title: "AI suggestions ready", description: assistResponse.data?.source === "chutes" ? "The live provider returned listing improvements and search hints." : "Fallback AI suggestions are ready for review." });
    } catch (error) {
      setNotice({ tone: "safety", title: "Could not generate AI help", description: error.message || "Try again after adding more listing context." });
    } finally {
      setBusy("");
    }
  }

  function applyAi() {
    if (!aiOutput) return;
    setDraft((current) => ({ ...current, title: aiOutput.improvedTitle || current.title, description: aiOutput.improvedDescription || current.description, tags: (aiOutput.suggestedTags || []).join(", ") || current.tags, category: aiOutput.suggestedCategory || current.category }));
    setNotice({ tone: "selling", title: "Suggestions applied", description: "The studio draft now reflects the AI title, description, and tag changes." });
  }

  async function saveDraft() {
    if (!signedInLike || draftBlockers.length) return;
    setBusy("save");
    setNotice({ tone: "buying", title: isEditing ? "Saving draft changes" : "Saving draft", description: "This listing stays private until you explicitly publish it." });
    try {
      const response = isEditing ? await apiFetch(`/listings/${editorListingId}`, auth, { method: "PATCH", body: listingPayload(draft, media, "draft") }) : await apiFetch("/listings", auth, { method: "POST", body: listingPayload(draft, media, "draft") });
      const saved = response.data || null;
      setEditorListingId(saved?.id || "");
      setEditorStatus(saved?.status || "draft");
      setCreatedListing(null);
      if (saved?.id) router.replace(`/sell?draft=${saved.id}`, { scroll: false });
      setNotice({ tone: "buying", title: "Draft saved", description: "You can reopen it from your profile listing studio any time." });
    } catch (error) {
      setNotice({ tone: "safety", title: "Could not save draft", description: error.message || "Fill the required fields and try again." });
    } finally {
      setBusy("");
    }
  }

  async function publish(event) {
    event.preventDefault();
    if (!signedInLike || readiness.length) return;
    setBusy("publish");
    setNotice({ tone: "selling", title: isEditing ? "Publishing saved draft" : "Publishing listing", description: "The studio is sending your draft to the live listings feed now." });
    try {
      const response = isEditing ? await apiFetch(`/listings/${editorListingId}`, auth, { method: "PATCH", body: listingPayload(draft, media, "active") }) : await apiFetch("/listings", auth, { method: "POST", body: listingPayload(draft, media, "active") });
      const published = response.data || null;
      setCreatedListing(published);
      clearStudio();
      setCreatedListing(published);
      setNotice({ tone: "selling", title: "Listing published", description: "The listing is live now, and you can open it from the studio card below." });
    } catch (error) {
      setNotice({ tone: "safety", title: "Could not publish listing", description: error.message || "Fix the highlighted checks and try again." });
    } finally {
      setBusy("");
    }
  }

  const draftLabel = busy === "save" ? "Saving draft..." : isEditing && editorStatus !== "draft" ? "Save changes" : "Save draft";
  const publishLabel = busy === "publish" ? "Publishing..." : isEditing && editorStatus === "draft" ? "Publish draft" : isEditing ? "Update listing" : "Publish listing";
  const searchAssistItems = formatSearchAssist(searchAssist);

  return (
    <div className="v2-workspace-page">
      <PageHeader compact eyebrow="Sell" title={isEditing ? "Edit a saved draft without losing the thread." : "Publish from a calm studio, with live readiness and accountable AI."} description={isEditing ? "Save private draft changes, reopen them later, then publish only when the listing reads clearly." : "Create a listing, check readiness, and publish with a live preview before it goes public."} actions={<><Button variant="secondary" onClick={runAi} disabled={busy === "ai" || busy === "load-draft"}>{busy === "ai" ? "Thinking..." : "Improve with AI"}</Button><Button variant="ghost" onClick={clearStudio} disabled={busy === "load-draft"}>Clear draft</Button></>} />
      {notice ? <NoticeBanner tone={notice.tone} title={notice.title} description={notice.description} /> : null}
      <div className="v2-metric-grid v2-metric-grid-wide">
        <MetricTile label="Completeness" value={`${completeness}%`} detail="draft quality confidence" tone="selling" />
        <MetricTile label="Media" value={media.length} detail="preview-ready assets" tone="buying" />
        <MetricTile label="Publish checks" value={readiness.length ? `${readiness.length} blockers` : "Ready"} detail={signedInLike ? "live route available" : "sign in to publish"} tone={readiness.length ? "safety" : "neutral"} />
        <MetricTile label="Draft save" value={draftBlockers.length ? `${draftBlockers.length} blockers` : "Ready"} detail={isEditing ? "current draft can be updated" : "private save status"} tone={draftBlockers.length ? "buying" : "selling"} />
      </div>
      <div className="v2-workspace-layout">
        <div className="v2-detail-main">
          <Surface title="Listing composer" description={isEditing ? "You are editing a saved studio draft. Save privately or publish from the same form." : "Fill the main listing fields, media, trust details, and handoff information here."}>
            <form id="v2-sell-form" className="v2-field-stack" onSubmit={publish}>
              <div className="v2-field-grid">
                <label className="v2-field"><span>Title</span><input value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Casio calculator with cover" /></label>
                <label className="v2-field"><span>Area</span><input value={draft.area} onChange={(event) => setDraft((current) => ({ ...current, area: event.target.value }))} placeholder="Main library, Tech Park" /></label>
              </div>
              <label className="v2-field"><span>Description</span><textarea rows={5} value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Condition, accessories, defects, and why someone should trust this listing." /></label>
              <div className="v2-field-grid">
                <label className="v2-field"><span>Category</span><SelectField value={draft.category} onChange={(value) => setDraft((current) => ({ ...current, category: value }))} options={categoryOptions.map(([value, label]) => ({ value, label }))} /></label>
                <label className="v2-field"><span>Condition</span><SelectField value={draft.condition} onChange={(value) => setDraft((current) => ({ ...current, condition: value }))} options={conditionOptions.map(([value, label]) => ({ value, label }))} /></label>
                <label className="v2-field"><span>Mode</span><SelectField value={draft.mode} onChange={(value) => setDraft((current) => ({ ...current, mode: value }))} options={modeOptions.map(([value, label]) => ({ value, label }))} /></label>
              </div>
              <div className="v2-field-grid">
                <label className="v2-field"><span>Price</span><input type="number" min="0" value={draft.price} onChange={(event) => setDraft((current) => ({ ...current, price: event.target.value }))} /></label>
                <label className="v2-field"><span>Inventory</span><input type="number" min="1" value={draft.inventoryCount} onChange={(event) => setDraft((current) => ({ ...current, inventoryCount: event.target.value }))} /></label>
                <label className="v2-field"><span>Brand</span><input value={draft.brand} onChange={(event) => setDraft((current) => ({ ...current, brand: event.target.value }))} placeholder="Casio, Ikea, Hero..." /></label>
              </div>
              {draft.mode === "rent" ? <div className="v2-field-grid"><label className="v2-field"><span>Daily rate</span><input type="number" min="0" value={draft.dailyRate} onChange={(event) => setDraft((current) => ({ ...current, dailyRate: event.target.value }))} /></label><label className="v2-field"><span>Weekly rate</span><input type="number" min="0" value={draft.weeklyRate} onChange={(event) => setDraft((current) => ({ ...current, weeklyRate: event.target.value }))} /></label><label className="v2-field"><span>Deposit</span><input type="number" min="0" value={draft.deposit} onChange={(event) => setDraft((current) => ({ ...current, deposit: event.target.value }))} /></label></div> : null}
              {draft.mode === "bundle" ? <div className="v2-field-grid"><label className="v2-field"><span>Bundle count</span><input type="number" min="1" value={draft.bundleCount} onChange={(event) => setDraft((current) => ({ ...current, bundleCount: event.target.value }))} /></label><label className="v2-field"><span>Bundle summary</span><input value={draft.bundleSummary} onChange={(event) => setDraft((current) => ({ ...current, bundleSummary: event.target.value }))} placeholder="Headphones, case, charger" /></label></div> : null}
              <div className="v2-field-grid">
                <label className="v2-field"><span>Included items</span><input value={draft.includedItems} onChange={(event) => setDraft((current) => ({ ...current, includedItems: event.target.value }))} placeholder="Cover, charger, manuals" /></label>
                <label className="v2-field"><span>Usage highlights</span><input value={draft.usageHighlights} onChange={(event) => setDraft((current) => ({ ...current, usageHighlights: event.target.value }))} placeholder="Light exam use, no defects, battery replaced" /></label>
              </div>
              <div className="v2-field-grid">
                <label className="v2-field"><span>Meetup notes</span><input value={draft.meetupNotes} onChange={(event) => setDraft((current) => ({ ...current, meetupNotes: event.target.value }))} placeholder="Meet near block 3 entrance after 5pm" /></label>
                <label className="v2-field"><span>Preferred contact window</span><input value={draft.preferredContactWindow} onChange={(event) => setDraft((current) => ({ ...current, preferredContactWindow: event.target.value }))} placeholder="Weekdays 6pm - 10pm" /></label>
              </div>
              <label className="v2-field"><span>Location hint</span><input value={draft.exactLocationHint} onChange={(event) => setDraft((current) => ({ ...current, exactLocationHint: event.target.value }))} placeholder="Hostel D lobby, tech park side, block A entrance" /></label>
              <label className="v2-field"><span>Tags</span><input value={draft.tags} onChange={(event) => setDraft((current) => ({ ...current, tags: event.target.value }))} placeholder="calculator, exam, electronics" /></label>
              <label className="v2-field">
                <span>Fulfillment</span>
                <div className="v2-token-grid">
                  {fulfillmentOptions.map(([value, label]) => (
                    <button key={value} type="button" className={`v2-filter-chip ${draft.fulfillmentModes.includes(value) ? "v2-filter-chip-active" : ""}`} onClick={() => setDraft((current) => ({ ...current, fulfillmentModes: toggleModeValue(current.fulfillmentModes, value) }))}>{label}</button>
                  ))}
                </div>
              </label>
              <label className="v2-field"><span>Media</span><input type="file" accept="image/*" multiple onChange={handleMedia} /></label>
              {media.length ? <div className="v2-sell-media-block"><div className="v2-sell-media-preview"><img src={media[activeMediaIndex]?.url} alt={media[activeMediaIndex]?.name || "Listing media"} className="v2-sell-media-preview-image" /></div><div className="v2-media-strip">{media.map((item, index) => <div key={`${item.name}-${index}`} className={`v2-media-thumb ${index === activeMediaIndex ? "v2-media-thumb-active" : ""}`}><button type="button" className="v2-media-thumb-button" onClick={() => setActiveMediaIndex(index)}><img src={item.url} alt={item.name} /></button><button type="button" className="v2-media-thumb-remove" onClick={() => removeMediaAt(index)}>Remove</button></div>)}<Button variant="ghost" onClick={() => { setMedia([]); setActiveMediaIndex(0); }}>Clear media</Button></div></div> : null}
              <div className="v2-page-header-actions">
                <Button variant="secondary" onClick={saveDraft} disabled={busy === "publish" || busy === "save" || busy === "load-draft" || !signedInLike || !!draftBlockers.length}>{draftLabel}</Button>
                <Button type="submit" disabled={busy === "publish" || busy === "save" || busy === "load-draft" || !signedInLike || !!readiness.length}>{signedInLike ? publishLabel : "Sign in to publish"}</Button>
              </div>
            </form>
          </Surface>
        </div>
        <div className="v2-detail-side">
          <Surface title="Studio checks" description="Private draft saves and live publish checks now stay separate, so the system always tells you what is happening.">
            <div className="v2-inline-list">
              <div className="v2-inline-row"><div><strong>{draftBlockers.length ? `${draftBlockers.length} draft blockers` : "Draft can be saved"}</strong><span>{draftBlockers.length ? draftBlockers[0] : "This version has enough structure to stay private in your listing studio."}</span></div><StatusPill tone={draftBlockers.length ? "buying" : "selling"}>{draftBlockers.length ? "fix first" : "save-ready"}</StatusPill></div>
              <div className="v2-inline-row"><div><strong>{readiness.length ? `${readiness.length} publish blockers` : "Ready to publish"}</strong><span>{readiness.length ? readiness[0] : "The live listing route has what it needs."}</span></div><StatusPill tone={readiness.length ? "safety" : "selling"}>{readiness.length ? "not live yet" : "publish-ready"}</StatusPill></div>
            </div>
            {readiness.length || draftBlockers.length ? <div className="v2-checklist">{[...new Set([...draftBlockers, ...readiness])].map((item) => <span key={item}>{item}</span>)}</div> : null}
          </Surface>
          <Surface title="AI studio" description="AI should guide the draft without pretending to replace judgement.">
            {aiOutput ? <div className="v2-inline-list"><div className="v2-inline-row"><div><strong>{aiOutput.improvedTitle || "AI title suggestion"}</strong><span>{aiOutput.improvedDescription || "Improved description suggestion available."}</span></div>{aiOutput.source ? <StatusPill tone={aiOutput.source === "chutes" ? "buying" : "neutral"}>{aiOutput.source}</StatusPill> : null}</div></div> : <EmptyBlock title="No AI suggestions yet" description="Run AI after adding enough context to improve the draft meaningfully." />}
            {searchAssistItems.length ? <div className="v2-checklist">{searchAssistItems.map((item) => <span key={item}>{item}</span>)}</div> : null}
            {moderation?.summary ? <div className="v2-inline-list"><div className="v2-inline-row"><div><strong>Moderation guidance</strong><span>{moderation.summary}</span></div><StatusPill tone={moderation.riskLevel === "high" ? "safety" : moderation.riskLevel === "medium" ? "buying" : "neutral"}>{moderation.riskLevel || "review"}</StatusPill></div></div> : null}
            <div className="v2-page-header-actions"><Button variant="secondary" onClick={runAi} disabled={busy === "ai" || busy === "load-draft"}>{busy === "ai" ? "Thinking..." : "Run AI again"}</Button><Button variant="ghost" onClick={applyAi} disabled={!aiOutput}>Apply suggestions</Button></div>
          </Surface>
          <Surface title="Preview" description="A compact mirror of how the listing will read before it goes live.">
            <div className="v2-card">
              <div className="v2-card-media">{media[activeMediaIndex]?.url ? <img src={media[activeMediaIndex].url} alt="Listing preview" className="v2-card-image" /> : <div className="v2-card-image-placeholder"><span>{draft.category}</span><strong>{draft.title || "Listing preview"}</strong></div>}</div>
              <div className="v2-card-body">
                <div className="v2-card-header"><div className="v2-card-title-wrap"><span className="v2-card-category">{draft.category}</span><strong className="v2-card-title">{draft.title || "Your title will appear here"}</strong></div><div className="v2-card-price"><strong>{formatCurrency(Number(draft.price || 0))}</strong><span>{draft.area || "Campus area"}</span></div></div>
                <p className="v2-card-description">{draft.description || "Description preview"}</p>
                <div className="v2-card-meta"><span>{draft.fulfillmentModes.join(", ") || "meetup"}</span><span>{draft.negotiable ? "Negotiable" : "Fixed price"}</span><span>{draft.inventoryCount || 1} available</span></div>
              </div>
            </div>
          </Surface>
          {createdListing ? <Surface title="Published listing" description="The backend accepted the draft and created a live listing."><div className="v2-inline-list"><div className="v2-inline-row"><div><strong>{createdListing.title}</strong><span>Listing created successfully and ready to review.</span></div><Button href={`/listings/${createdListing.id}`} variant="secondary">Open listing</Button></div></div></Surface> : null}
        </div>
      </div>
    </div>
  );
}
