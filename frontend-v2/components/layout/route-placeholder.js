import { Checklist, EmptyBlock, PageHeader, Surface } from "@/components/system/primitives";

export function RoutePlaceholder({ eyebrow, title, description, checklist = [], actions }) {
  return (
    <div className="v2-route-shell">
      <PageHeader eyebrow={eyebrow} title={title} description={description} actions={actions} />
      <div className="v2-route-grid">
        <Surface
          title="What belongs here"
          description="This page should stay focused on the actions, context, and decisions that matter most for this part of the marketplace."
        >
          <Checklist items={checklist} />
        </Surface>
        <Surface
          title="Quality bar"
          description="This page is under construction."
        >
          <EmptyBlock
            title="Clean interactions only"
            description="Clear hierarchy, honest state, safe actions, and no dead controls or filler UI."
          />
        </Surface>
      </div>
    </div>
  );
}
