import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataManagement } from "./_components/data-management";
import { UserManagement } from "./_components/user-management";
import { OrderPolicySettingsComponent } from "./_components/order-policy-settings";
import { OrganizationTab } from "./_components/organization-tab";
import { APIKeySettings } from "./_components/api-key-settings";
import { NotificationTest } from "./_components/notification-test";
import { MyAccount } from "./_components/my-account";
import { ActivityLogTab } from "./_components/activity-log-tab";
import { PermissionsTab } from "./_components/permissions-tab";

// TEMP: 개발 중 임시 조직 ID (Phase 6.1에서 실제 세션 기반으로 변경)
const TEMP_ORG_ID = "00000000-0000-0000-0000-000000000001";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const validTabs = ["account", "data", "organization", "users", "permissions", "policy", "api", "notifications", "activity"];
  const defaultTab = tab && validTabs.includes(tab) ? tab : "account";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">설정</h1>
        <p className="mt-2 text-slate-500">조직 설정 및 시스템 관리</p>
      </div>

      <Tabs defaultValue={defaultTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-9">
          <TabsTrigger value="account">내 계정</TabsTrigger>
          <TabsTrigger value="data">데이터 관리</TabsTrigger>
          <TabsTrigger value="organization">조직 설정</TabsTrigger>
          <TabsTrigger value="users">사용자 관리</TabsTrigger>
          <TabsTrigger value="permissions">권한 설정</TabsTrigger>
          <TabsTrigger value="policy">발주 정책</TabsTrigger>
          <TabsTrigger value="api">API 키</TabsTrigger>
          <TabsTrigger value="notifications">알림 테스트</TabsTrigger>
          <TabsTrigger value="activity">활동 로그</TabsTrigger>
        </TabsList>

        <TabsContent value="account" className="space-y-4">
          <MyAccount />
        </TabsContent>

        <TabsContent value="data" className="space-y-4">
          <DataManagement />
        </TabsContent>

        <TabsContent value="organization" className="space-y-4">
          <OrganizationTab organizationId={TEMP_ORG_ID} />
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <UserManagement organizationId={TEMP_ORG_ID} />
        </TabsContent>

        <TabsContent value="permissions" className="space-y-4">
          <PermissionsTab organizationId={TEMP_ORG_ID} />
        </TabsContent>

        <TabsContent value="policy" className="space-y-4">
          <OrderPolicySettingsComponent organizationId={TEMP_ORG_ID} />
        </TabsContent>

        <TabsContent value="api" className="space-y-4">
          <APIKeySettings organizationId={TEMP_ORG_ID} />
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <NotificationTest />
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <ActivityLogTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
