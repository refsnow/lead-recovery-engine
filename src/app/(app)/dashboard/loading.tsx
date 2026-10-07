import { Card, Skeleton } from '@/components/ui';

export default function DashboardLoading() {
  return (
    <>
      <Skeleton className="mb-5 h-8 w-64" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        {Array.from({ length: 7 }).map((_, index) => (
          <Skeleton key={index} className="h-24" />
        ))}
      </div>
      <Card className="mt-6"><Skeleton className="m-5 h-52" /></Card>
      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2"><Skeleton className="m-5 h-48" /></Card>
        <Card><Skeleton className="m-5 h-48" /></Card>
      </div>
    </>
  );
}
