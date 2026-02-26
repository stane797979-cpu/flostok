import dynamic from "next/dynamic";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { MyAccount } from "./_components/my-account";
import { getCurrentUser } from "@/server/actions/auth-helpers";

// Dynamic imports — 선택된 탭만 로드 (초기 번들 ~240kB → ~60kB)
const DataManagement = dynamic(
  () => import("./_components/data-management").then((m) => ({ default: m.DataManagement }))
);
const UserManagement = dynamic(
  () => import("./_components/user-management").then((m) => ({ default: m.UserManagement }))
);
const OrderPolicySettingsComponent = dynamic(
  () => import("./_components/order-policy-settings").then((m) => ({ default: m.OrderPolicySettingsComponent }))
);
const OrganizationTab = dynamic(
  () => import("./_components/organization-tab").then((m) => ({ default: m.OrganizationTab }))
);
const APIKeySettings = dynamic(
  () => import("./_components/api-key-settings").then((m) => ({ default: m.APIKeySettings }))
);
const NotificationTest = dynamic(
  () => import("./_components/notification-test").then((m) => ({ default: m.NotificationTest }))
);
const ActivityLogTab = dynamic(
  () => import("./_components/activity-log-tab").then((m) => ({ default: m.ActivityLogTab }))
);
const PermissionsTab = dynamic(
  () => import("./_components/permissions-tab").then((m) => ({ default: m.PermissionsTab }))
);
const AlertSettingsTab = dynamic(
  () => import("./_components/alert-settings-tab").then((m) => ({ default: m.AlertSettingsTab }))
);

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const validTabs = ["account", "data", "organization", "users", "permissions", "policy", "api", "notifications", "alert-settings", "activity"];
  const defaultTab = tab && validTabs.includes(tab) ? tab : "account";

  // 실제 로그인 사용자의 조직 ID 사용
  const user = await getCurrentUser();
  const organizationId = user?.organizationId ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">설정</h1>
        <p className="mt-2 text-slate-500">조직 설정 및 시스템 관리</p>
      </div>

      {organizationId === null && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            조직 정보를 불러올 수 없습니다. 관리자에게 문의하거나 다시 로그인해 주세요.
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue={defaultTab} className="space-y-4">
        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
          <TabsList className="inline-flex w-auto min-w-full md:grid md:w-full md:grid-cols-10">
            <TabsTrigger value="account" className="whitespace-nowrap">내 계정</TabsTrigger>
            <TabsTrigger value="data" className="whitespace-nowrap">데이터 관리</TabsTrigger>
            <TabsTrigger value="organization" className="whitespace-nowrap">조직 설정</TabsTrigger>
            <TabsTrigger value="users" className="whitespace-nowrap">사용자 관리</TabsTrigger>
            <TabsTrigger value="permissions" className="whitespace-nowrap">권한 설정</TabsTrigger>
            <TabsTrigger value="policy" className="whitespace-nowrap">발주 정책</TabsTrigger>
            <TabsTrigger value="api" className="whitespace-nowrap">API 키</TabsTrigger>
            <TabsTrigger value="notifications" className="whitespace-nowrap">알림 테스트</TabsTrigger>
            <TabsTrigger value="alert-settings" className="whitespace-nowrap">알림 설정</TabsTrigger>
            <TabsTrigger value="activity" className="whitespace-nowrap">활동 로그</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="account" className="space-y-4">
          <MyAccount />
        </TabsContent>

        <TabsContent value="data" className="space-y-4">
          <DataManagement isAdmin={user?.role === "admin"} />
        </TabsContent>

        <TabsContent value="organization" className="space-y-4">
          <OrganizationTab organizationId={organizationId ?? ""} />
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <UserManagement organizationId={organizationId ?? ""} />
        </TabsContent>

        <TabsContent value="permissions" className="space-y-4">
          <PermissionsTab organizationId={organizationId ?? ""} />
        </TabsContent>

        <TabsContent value="policy" className="space-y-4">
          <OrderPolicySettingsComponent organizationId={organizationId ?? ""} />
        </TabsContent>

        <TabsContent value="api" className="space-y-4">
          <APIKeySettings organizationId={organizationId ?? ""} />
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <NotificationTest />
        </TabsContent>

        <TabsContent value="alert-settings" className="space-y-4">
          <AlertSettingsTab />
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <ActivityLogTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
