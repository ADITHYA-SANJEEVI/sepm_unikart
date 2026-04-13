import { Button } from "@/components/system/primitives";

export {
  Checklist,
  EmptyBlock,
  InlineList,
  PageHeader as V2PageHeader,
  StatusPill,
} from "@/components/system/primitives";
export { Button as V2Button } from "@/components/system/primitives";
export { MetricTile as V2Metric } from "@/components/system/primitives";
export { Surface as V2Panel } from "@/components/system/primitives";

export { RoutePlaceholder as V2RoutePlaceholder } from "@/components/layout/route-placeholder";

export function V2QuickLink(props) {
  return <Button href={props.href} variant="secondary">{props.label}</Button>;
}
