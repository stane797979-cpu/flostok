import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function StatsCardsSkeleton() {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {[...Array(4)].map((_, i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="h-4 w-20 animate-pulse rounded bg-slate-200" />
            <div className="h-5 w-5 animate-pulse rounded bg-slate-200" />
          </CardHeader>
          <CardContent>
            <div className="h-8 w-16 animate-pulse rounded bg-slate-200" />
            <div className="mt-2 h-3 w-24 animate-pulse rounded bg-slate-100" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function KPIMetricsSkeleton() {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="h-6 w-32 animate-pulse rounded bg-slate-200" />
        <div className="h-8 w-24 animate-pulse rounded bg-slate-200" />
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <div className="h-4 w-20 animate-pulse rounded bg-slate-200" />
              <div className="mt-3 h-8 w-24 animate-pulse rounded bg-slate-200" />
              <div className="mt-2 h-2 w-full animate-pulse rounded bg-slate-100" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="h-5 w-28 animate-pulse rounded bg-slate-200" />
      </CardHeader>
      <CardContent>
        <div className="h-[200px] animate-pulse rounded bg-slate-100" />
      </CardContent>
    </Card>
  );
}

export function ListSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="h-5 w-28 animate-pulse rounded bg-slate-200" />
        <div className="h-8 w-20 animate-pulse rounded bg-slate-200" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex-1 space-y-2">
                <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
                <div className="h-3 w-48 animate-pulse rounded bg-slate-100" />
              </div>
              <div className="h-8 w-16 animate-pulse rounded bg-slate-200" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function MatrixSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="h-5 w-36 animate-pulse rounded bg-slate-200" />
      </CardHeader>
      <CardContent>
        <div className="h-[180px] animate-pulse rounded bg-slate-100" />
      </CardContent>
    </Card>
  );
}
