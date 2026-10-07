import { Card, Skeleton } from '@/components/ui';

export default function LeadsLoading() {
  return (
    <>
      <Skeleton className="mb-5 h-8 w-48" />
      <Skeleton className="mb-4 h-10" />
      <Card>
        <div className="space-y-2 p-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-10" />
          ))}
        </div>
      </Card>
    </>
  );
}
