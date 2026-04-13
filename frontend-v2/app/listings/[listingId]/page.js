import { V2ListingDetailPage } from "@/components/listing/v2-listing-detail-page";

export default async function ListingDetailRoute({ params }) {
  const { listingId } = await params;
  return <V2ListingDetailPage listingId={listingId} />;
}
