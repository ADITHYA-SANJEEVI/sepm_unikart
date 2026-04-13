import { Suspense } from "react";
import { V2ProfilePage } from "@/components/workspace/v2-profile-page";

export default async function ProfileRoute({ params }) {
  const resolved = await params;
  return (
    <Suspense fallback={null}>
      <V2ProfilePage profileId={resolved.profileId} />
    </Suspense>
  );
}
