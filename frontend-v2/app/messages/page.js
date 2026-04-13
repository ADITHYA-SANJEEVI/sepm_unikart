import { Suspense } from "react";
import { V2MessagesPage } from "@/components/workspace/v2-messages-page";

export default function MessagesRoute() {
  return (
    <Suspense fallback={null}>
      <V2MessagesPage />
    </Suspense>
  );
}
