import { Badge, EmptyState, PageHeader } from "../../components/ui";

/** Shared placeholder for deliberately deferred admin surfaces. */
export function ComingSoon({
  title,
  lane,
  body,
}: {
  title: string;
  lane: string;
  body: string;
}) {
  return (
    <div>
      <PageHeader title={title} actions={<Badge tone="indigo">{lane}</Badge>} />
      <EmptyState title={`${title} ships next`} body={body} />
    </div>
  );
}
