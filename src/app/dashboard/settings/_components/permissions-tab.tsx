"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, Loader2, CheckCircle2, AlertCircle, Save } from "lucide-react";
import {
  getAllMenuPermissions,
  updateMenuPermissions,
} from "@/server/actions/permissions";
import { ALL_MENU_KEYS, MENU_KEY_LABELS } from "@/lib/constants/menu-permissions";

interface PermissionsTabProps {
  organizationId: string;
}

const ROLES = [
  { key: "admin", label: "관리자", locked: true },
  { key: "manager", label: "매니저", locked: false },
  { key: "warehouse", label: "창고", locked: false },
  { key: "viewer", label: "뷰어", locked: false },
] as const;

export function PermissionsTab({ organizationId }: PermissionsTabProps) {
  const [permissions, setPermissions] = useState<
    Record<string, Record<string, boolean>>
  >({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [hasChanges, setHasChanges] = useState(false);

  const loadPermissions = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await getAllMenuPermissions(organizationId);
      setPermissions(result);
    } catch {
      setError("권한 설정을 불러오는 중 오류가 발생했습니다");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPermissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  const handleToggle = (role: string, menuKey: string, checked: boolean) => {
    setPermissions((prev) => ({
      ...prev,
      [role]: {
        ...prev[role],
        [menuKey]: checked,
      },
    }));
    setHasChanges(true);
    setMessage(null);
  };

  const handleSave = () => {
    setMessage(null);
    startTransition(async () => {
      let hasError = false;
      for (const role of ROLES) {
        if (role.locked) continue;
        const rolePerms = permissions[role.key];
        if (!rolePerms) continue;

        const result = await updateMenuPermissions(role.key, rolePerms);
        if (!result.success) {
          setMessage({
            type: "error",
            text: result.error || "저장 실패",
          });
          hasError = true;
          break;
        }
      }
      if (!hasError) {
        setMessage({ type: "success", text: "권한 설정이 저장되었습니다" });
        setHasChanges(false);
      }
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            권한 설정
          </CardTitle>
          <CardDescription>역할별 메뉴 접근 권한을 설정합니다</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            권한 설정
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-48 items-center justify-center text-slate-400">
            {error}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              권한 설정
            </CardTitle>
            <CardDescription>
              역할별로 사이드바 메뉴 접근 권한을 설정합니다
            </CardDescription>
          </div>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || isPending}
            className="gap-2"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            저장
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {message && (
          <Alert
            variant={message.type === "error" ? "destructive" : "default"}
          >
            {message.type === "success" ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <AlertDescription>{message.text}</AlertDescription>
          </Alert>
        )}

        {/* 권한 매트릭스 테이블 */}
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50">
                <th className="sticky left-0 z-10 bg-slate-50 px-4 py-3 text-left font-semibold text-slate-700">
                  메뉴
                </th>
                {ROLES.map((role) => (
                  <th
                    key={role.key}
                    className="px-4 py-3 text-center font-semibold text-slate-700"
                  >
                    <Badge
                      variant={
                        role.key === "admin"
                          ? "destructive"
                          : role.key === "manager"
                            ? "default"
                            : role.key === "warehouse"
                              ? "outline"
                              : "secondary"
                      }
                    >
                      {role.label}
                    </Badge>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ALL_MENU_KEYS.map((menuKey) => (
                <tr
                  key={menuKey}
                  className="border-b last:border-b-0 hover:bg-slate-50"
                >
                  <td className="sticky left-0 z-10 bg-white px-4 py-2.5 font-medium text-slate-700">
                    {MENU_KEY_LABELS[menuKey] || menuKey}
                  </td>
                  {ROLES.map((role) => {
                    const isChecked =
                      permissions[role.key]?.[menuKey] ?? false;
                    return (
                      <td key={role.key} className="px-4 py-2.5">
                        <div className="flex justify-center">
                        <Checkbox
                          checked={role.locked ? true : isChecked}
                          disabled={role.locked || isPending}
                          onCheckedChange={(checked) =>
                            handleToggle(
                              role.key,
                              menuKey,
                              checked === true
                            )
                          }
                        />
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-lg border bg-slate-50 p-4 text-sm text-slate-600">
          <p className="font-semibold text-slate-700">참고</p>
          <ul className="mt-1 list-inside list-disc space-y-1">
            <li>
              <strong>관리자</strong> 역할은 항상 전체 메뉴에 접근할 수 있으며
              변경할 수 없습니다.
            </li>
            <li>
              <strong>창고</strong> 역할의 기본값은 대시보드, 입고예정, 출고예정,
              재고 현황입니다.
            </li>
            <li>
              변경 후 <strong>저장</strong>을 눌러야 적용됩니다. 해당 역할의
              사용자는 다음 로그인 시 변경사항이 반영됩니다.
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
