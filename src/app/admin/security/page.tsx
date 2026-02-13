import {
  Shield,
  Database,
  Lock,
  Eye,
  EyeOff,
  KeyRound,
  Users,
  Server,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function SecurityArchitecturePage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">보안 아키텍처</h1>
        <p className="mt-2 text-slate-500">
          Stock & Logis FloStok 서비스의 다층 보안 구조
        </p>
      </div>

      {/* Section 1: 데이터 저장소 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Server className="h-5 w-5 text-slate-600" />
            <CardTitle>데이터 저장소</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <Database className="mt-0.5 h-4 w-4 text-blue-600" />
              <div>
                <p className="font-medium">Supabase PostgreSQL 클라우드 DB (AWS 기반)</p>
                <p className="mt-1 text-slate-600">
                  고객 로컬 PC에는 아무것도 저장되지 않으며, 모든 데이터는 100% 클라우드에서 관리됩니다.
                </p>
              </div>
            </div>
            <div className="ml-7 space-y-2 border-l-2 border-slate-200 pl-4">
              <p className="text-slate-700">
                <span className="font-medium">자동 백업:</span> 일일 스냅샷
              </p>
              <p className="text-slate-700">
                <span className="font-medium">Point-in-Time Recovery (PITR):</span> 지원
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 2: 3중 보안 계층 */}
      <div>
        <h2 className="mb-4 text-lg font-semibold">3중 보안 계층</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {/* Layer 1: DB 계층 */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                  Layer 1
                </Badge>
                <Database className="h-5 w-5 text-blue-600" />
              </div>
              <CardTitle className="mt-3 text-base">DB 계층</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm text-slate-700">
                <p className="font-medium">PostgreSQL Row Level Security (RLS)</p>
                <ul className="space-y-2 text-xs">
                  <li>• 17개 테이블에 적용</li>
                  <li>
                    • <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[10px]">
                      organization_id = current_user_org_id()
                    </code> 정책
                  </li>
                  <li>• 브라우저 → Supabase anon key → RLS 강제 적용</li>
                  <li>• 다른 조직 데이터 접근 시 빈 결과 반환 (존재 여부조차 알 수 없음)</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Layer 2: 인증 계층 */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  Layer 2
                </Badge>
                <Lock className="h-5 w-5 text-green-600" />
              </div>
              <CardTitle className="mt-3 text-base">인증 계층</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm text-slate-700">
                <p className="font-medium">Supabase Auth (카카오/구글 OAuth)</p>
                <ul className="space-y-2 text-xs">
                  <li>• 세션 기반 인증</li>
                  <li>
                    • <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[10px]">
                      getCachedCurrentUser()
                    </code>로 조직 ID 확인
                  </li>
                  <li>
                    • 모든 Server Action에서 <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[10px]">
                      requireAuth()
                    </code> 필수 호출
                  </li>
                  <li>• 미들웨어 레벨 라우트 보호</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Layer 3: 애플리케이션 계층 */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                  Layer 3
                </Badge>
                <Shield className="h-5 w-5 text-purple-600" />
              </div>
              <CardTitle className="mt-3 text-base">애플리케이션 계층</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm text-slate-700">
                <p className="font-medium">타입 안전 쿼리 + 이중 필터링</p>
                <ul className="space-y-2 text-xs">
                  <li>
                    • 모든 쿼리에 <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[10px]">
                      eq(organizationId, user.organizationId)
                    </code> 필터
                  </li>
                  <li>• Drizzle ORM 타입 안전 쿼리 (SQL injection 원천 차단)</li>
                  <li>• 직접 SQL 사용 없음</li>
                  <li>• Server Component에서만 DB 접근 (브라우저에서 직접 쿼리 불가)</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Section 3: 고객 간 데이터 격리 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-slate-600" />
            <CardTitle>고객 간 데이터 격리</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 text-green-600" />
              <p className="text-slate-700">
                A회사 사용자 → A회사 데이터만 접근 가능 (DB 레벨에서 차단)
              </p>
            </div>
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 text-green-600" />
              <p className="text-slate-700">
                B회사 데이터 접근 시도 → RLS가 빈 결과 반환 (에러도 아님, 존재 자체를 알 수 없음)
              </p>
            </div>
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 text-green-600" />
              <p className="text-slate-700">
                브라우저에서 Supabase REST API 직접 호출해도 RLS가 차단
              </p>
            </div>
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 text-green-600" />
              <p className="text-slate-700">
                서버 사이드 코드에서도 이중으로 조직 ID 필터링
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 4: 관리자 권한 범위 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-slate-600" />
            <CardTitle>관리자 권한 범위</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>구분</TableHead>
                <TableHead>내용</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="align-top font-medium">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span>할 수 있는 것</span>
                  </div>
                </TableCell>
                <TableCell>
                  <ul className="space-y-1 text-sm text-slate-700">
                    <li>• 조직 목록 및 통계 조회</li>
                    <li>• 조직별 데이터 읽기 (제품, 재고, 판매, 발주, KPI)</li>
                    <li>• 시스템 전체 통계 조회</li>
                    <li>• 구독 및 결제 내역 조회</li>
                  </ul>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="align-top font-medium">
                  <div className="flex items-center gap-2">
                    <EyeOff className="h-4 w-4 text-red-600" />
                    <span>할 수 없는 것</span>
                  </div>
                </TableCell>
                <TableCell>
                  <ul className="space-y-1 text-sm text-slate-700">
                    <li>• 고객 데이터 수정 또는 삭제</li>
                    <li>• 고객 계정으로 로그인 (대리 로그인 불가)</li>
                    <li>• 결제 정보(카드번호 등) 직접 접근 (PortOne이 관리)</li>
                    <li>• RLS 정책 비활성화 (DB 레벨 보호)</li>
                  </ul>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Section 5: 암호화 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-slate-600" />
            <CardTitle>암호화</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <Lock className="mt-0.5 h-4 w-4 text-blue-600" />
              <div>
                <p className="font-medium">전송 중: TLS 1.2+</p>
                <p className="text-xs text-slate-600">
                  HTTPS 강제, 모든 API 통신 암호화
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Database className="mt-0.5 h-4 w-4 text-blue-600" />
              <div>
                <p className="font-medium">저장 시: AES-256</p>
                <p className="text-xs text-slate-600">
                  Supabase managed encryption at rest
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Shield className="mt-0.5 h-4 w-4 text-blue-600" />
              <div>
                <p className="font-medium">비밀번호: bcrypt 해싱</p>
                <p className="text-xs text-slate-600">
                  Supabase Auth 관리, 평문 저장 없음
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <KeyRound className="mt-0.5 h-4 w-4 text-blue-600" />
              <div>
                <p className="font-medium">API 키: 환경변수만 사용</p>
                <p className="text-xs text-slate-600">
                  코드 하드코딩 없음
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 text-blue-600" />
              <div>
                <p className="font-medium">결제 정보: PCI-DSS 준수</p>
                <p className="text-xs text-slate-600">
                  PortOne/토스페이먼츠가 관리
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 6: 접근 권한 체계 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-slate-600" />
            <CardTitle>접근 권한 체계</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>역할</TableHead>
                <TableHead>설명</TableHead>
                <TableHead>주요 권한</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">
                  <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                    admin
                  </Badge>
                </TableCell>
                <TableCell>조직 관리자</TableCell>
                <TableCell className="text-sm text-slate-700">
                  모든 기능 사용, 사용자 관리, 설정 변경
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                    manager
                  </Badge>
                </TableCell>
                <TableCell>매니저</TableCell>
                <TableCell className="text-sm text-slate-700">
                  발주 생성/승인, 재고 조정, 데이터 조회
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    warehouse
                  </Badge>
                </TableCell>
                <TableCell>창고 담당</TableCell>
                <TableCell className="text-sm text-slate-700">
                  입출고 처리, 재고 확인
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">
                  <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-300">
                    viewer
                  </Badge>
                </TableCell>
                <TableCell>뷰어</TableCell>
                <TableCell className="text-sm text-slate-700">
                  데이터 조회만 가능 (수정 불가)
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Footer notice */}
      <p className="mt-8 text-xs text-slate-400">
        본 보안 아키텍처 문서는 Stock & Logis FloStok 서비스의 실제 구현을 기반으로 작성되었습니다.
        추가 보안 관련 문의는 logisglobalceo@gmail.com으로 연락해 주시기 바랍니다.
      </p>
    </div>
  );
}
