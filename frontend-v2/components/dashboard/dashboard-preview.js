import { Button, Checklist, InlineList, MetricTile, PageHeader, Surface, StatusPill } from "@/components/system/primitives";

const needsAction = [
  {
    title: "2 buyer messages need replies",
    description: "One conversation is tied to a pending hold, so speed matters.",
    meta: "Reply now",
  },
  {
    title: "1 saved search matched today",
    description: "A new electronics listing fits your active alert.",
    meta: "Review match",
  },
  {
    title: "One listing still needs trust detail",
    description: "Brand/model and meetup guidance are still missing.",
    meta: "Fix listing",
  },
];

const workspaceRows = [
  { title: "Seller workspace", description: "Active listings, sold transitions, performance, and quality nudges.", meta: "3 active" },
  { title: "Buyer workspace", description: "Saved items, compare queue, and alert-driven discovery.", meta: "2 saved" },
  { title: "Admin workspace", description: "Reports, moderation pressure, and platform diagnostics.", meta: "1 urgent" },
];

export function DashboardPreview() {
  return (
    <div className="v2-route-shell">
      <PageHeader
        eyebrow="Dashboard"
        title="Your Campus Control Room"
        description="This preview locks the hierarchy before data wiring: overview first, urgent work second, role-aware workspaces next, then insight and support layers."
        actions={
          <>
            <Button href="/marketplace" variant="secondary">Browse frame</Button>
            <Button href="/sell">Sell frame</Button>
          </>
        }
      />

      <section className="v2-dashboard-hero">
        <div className="v2-dashboard-hero-copy">
          <StatusPill tone="selling">Seller workspace</StatusPill>
          <h2>Good dashboards answer what changed, what matters, and what to do next.</h2>
          <p>
            The production dashboard will be role-aware, action-first, and much calmer than the old card wall. It should guide buyers, sellers, and moderators without turning into a dashboard soup.
          </p>
        </div>
        <div className="v2-dashboard-hero-metrics">
          <MetricTile label="Urgent actions" value="3" detail="messages, matches, listing quality" tone="selling" />
          <MetricTile label="Saved alerts" value="1" detail="fresh match today" tone="buying" />
          <MetricTile label="Trust health" value="86%" detail="profile + listing readiness" tone="neutral" />
        </div>
      </section>

      <div className="v2-dashboard-grid">
        <Surface title="Needs Action" description="This is the dominant module. Counts are meaningless unless they lead directly to action.">
          <InlineList items={needsAction} />
        </Surface>

        <Surface title="Activity Lanes" description="Notifications are categorized by context.">
          <div className="v2-stack">
            <StatusPill tone="buying">Buying lane</StatusPill>
            <StatusPill tone="selling">Selling lane</StatusPill>
            <StatusPill tone="safety">Safety lane</StatusPill>
            <StatusPill tone="admin">Admin lane</StatusPill>
          </div>
        </Surface>
      </div>

      <div className="v2-dashboard-grid v2-dashboard-grid-secondary">
        <Surface title="Primary workspaces" description="The dashboard emphasizes relevant tools based on your active role.">
          <InlineList items={workspaceRows} />
        </Surface>

        <Surface title="Dashboard quality rules" description="These rules prevent the new dashboard from regressing into a student-project collage.">
          <Checklist
            items={[
              "One strong hierarchy, not equal cards everywhere",
              "Counts must resolve into next actions",
              "Role-aware emphasis over generic sameness",
              "Grouped surfaces instead of many isolated boxes",
            ]}
          />
        </Surface>
      </div>
    </div>
  );
}
