import { Suspense } from "react";
import { V2SellPage } from "@/components/studio/v2-sell-page";

export default function SellRoute() {
  return (
    <Suspense fallback={null}>
      <V2SellPage />
    </Suspense>
  );
}
