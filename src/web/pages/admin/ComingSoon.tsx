import { Badge, EmptyState, PageHeader } from "../../components/ui";

/** Skeleton for routes the post-scaffold lanes fill in. */
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
