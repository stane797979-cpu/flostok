import { getOnboardingSession } from "@/server/actions/onboarding";
import { notFound } from "next/navigation";
import { OnboardingWizard } from "../_components/onboarding-wizard";
import type { UploadedFileInfo, AnalyzedHeader } from "@/types/onboarding";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  Calendar,
  FileSpreadsheet,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";
import { DATA_TYPE_LABELS } from "@/types/onboarding";

interface OnboardingDetailPageProps {
  params: Promise<{ id: string }>;
}

/**
 * 온보딩 세션 상세/재개 페이지
 */
export default async function OnboardingDetailPage({
  params,
}: OnboardingDetailPageProps) {
  const { id } = await params;
  const result = await getOnboardingSession(id);

  if (!result.success || !result.data) {
    notFound();
  }

  const { session, files } = result.data;

  // 완료된 세션은 결과 요약 표시
  if (session.status === "completed") {
    const importSummary = session.importSummary as Record<
      string,
      unknown
    > | null;

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/onboarding">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" />
              목록으로
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {session.companyName}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge className="bg-green-100 text-green-700 font-medium">
                완료
              </Badge>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="text-sm text-slate-500">
                {new Date(session.updatedAt).toLocaleDateString("ko-KR", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
            </div>
          </div>
        </div>

        {/* 임포트된 파일 목록 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">임포트된 파일</CardTitle>
          </CardHeader>
          <CardContent>
            {files.length === 0 ? (
              <p className="text-slate-500">임포트된 파일이 없습니다.</p>
            ) : (
              <div className="space-y-3">
                {files.map((file) => {
                  const importResult = file.importResult as Record<
                    string,
                    unknown
                  > | null;
                  return (
                    <div
                      key={file.id}
                      className="flex items-center justify-between p-4 bg-slate-50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <FileSpreadsheet className="h-5 w-5 text-slate-500" />
                        <div>
                          <div className="font-medium text-sm">
                            {file.fileName}
                          </div>
                          <div className="text-xs text-slate-500">
                            {DATA_TYPE_LABELS[
                              file.dataType as keyof typeof DATA_TYPE_LABELS
                            ] || file.dataType}
                            {file.rowCount && ` · ${file.rowCount}행`}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {file.status === "imported" ? (
                          <Badge className="bg-green-100 text-green-700">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            임포트 완료
                            {importResult?.successCount != null &&
                              ` (${importResult.successCount}건)`}
                          </Badge>
                        ) : (
                          <Badge variant="outline">{file.status}</Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 임포트 요약 */}
        {importSummary && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">임포트 요약</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-sm bg-slate-50 p-4 rounded-lg overflow-auto">
                {JSON.stringify(importSummary, null, 2)}
              </pre>
            </CardContent>
          </Card>
        )}

        {/* 회사 정보 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">회사 정보</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-slate-500">회사명:</span>
                <span className="ml-2 font-medium">{session.companyName}</span>
              </div>
              <div>
                <span className="text-slate-500">생성일:</span>
                <span className="ml-2 font-medium">
                  {new Date(session.createdAt).toLocaleDateString("ko-KR")}
                </span>
              </div>
              {(() => {
                if (
                  session.companyInfo &&
                  typeof session.companyInfo === "object"
                ) {
                  return Object.entries(
                    session.companyInfo as Record<string, string>
                  ).map(
                    ([key, value]) =>
                      value && (
                        <div key={key}>
                          <span className="text-slate-500">{key}:</span>
                          <span className="ml-2 font-medium">
                            {String(value)}
                          </span>
                        </div>
                      )
                  );
                }
                return null;
              })()}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 진행 중인 세션은 위자드 표시
  const initialFiles: UploadedFileInfo[] = files.map((file) => ({
    id: file.id,
    fileName: file.fileName,
    fileSize: file.fileSize,
    dataType: file.dataType,
    selectedSheet: file.selectedSheet || undefined,
    sheetNames: (file.sheetNames as string[]) || undefined,
    analyzedHeaders: (file.analyzedHeaders as AnalyzedHeader[]) || undefined,
    rowCount: file.rowCount || undefined,
    status: file.status,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/onboarding">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            목록으로
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {session.companyName}
          </h1>
          <p className="text-slate-500 mt-1">온보딩 세션 계속하기</p>
        </div>
      </div>

      <OnboardingWizard
        initialSessionId={session.id}
        initialStep={session.currentStep}
        initialFiles={initialFiles}
      />
    </div>
  );
}
