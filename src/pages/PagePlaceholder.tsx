import type { ReactNode } from "react";
import { Card, EmptyState, PageHeader } from "@/components/ui";

// TEMPORARY (Step 1): stands in for pages that are built in later steps.
// Delete this file once every page is real.
export function PagePlaceholder({
  title,
  description,
  step,
  icon,
}: {
  title: string;
  description: string;
  step: number;
  icon: ReactNode;
}) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <Card padding="none">
        <EmptyState
          icon={icon}
          tone="accent"
          title={`${title} is built in Step ${step}`}
          description="The shell, theme and data layer are ready. This page's content comes next, after the foundation is approved."
        />
      </Card>
    </>
  );
}
