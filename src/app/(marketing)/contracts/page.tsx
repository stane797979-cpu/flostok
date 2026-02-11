import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, FileText, GraduationCap, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "계약서 양식 | Stock & Logis",
  description: "SCM 컨설팅, 교육 위탁, 비밀유지 계약서 양식을 확인하세요.",
};

const contracts = [
  {
    title: "SCM 컨설팅 용역 계약서",
    description:
      "SCM 프로세스 진단, 재고관리 체계 분석, 수요예측 모델 설계 등 컨설팅 프로젝트 수행을 위한 용역 계약서입니다.",
    href: "/contracts/consulting",
    icon: FileText,
    articles: "14개 조항 + 별첨(SOW)",
  },
  {
    title: "교육/강의 위탁 계약서",
    description:
      "수요예측, 공급계획, 입출고 관리, 재고관리 등 SCM 전문 교육 위탁을 위한 계약서입니다.",
    href: "/contracts/education",
    icon: GraduationCap,
    articles: "13개 조항",
  },
  {
    title: "비밀유지 계약서 (NDA)",
    description:
      "사업 협력 검토 과정에서 교환되는 기밀정보 보호를 위한 쌍무적 비밀유지 계약서입니다.",
    href: "/contracts/nda",
    icon: ShieldCheck,
    articles: "8개 조항",
  },
];

export default function ContractsPage() {
  return (
    <div>
      <section className="bg-gradient-to-b from-slate-900 to-slate-800 px-4 py-16 sm:px-6 sm:py-24 lg:px-8 lg:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl lg:text-4xl">
            계약서 양식
          </h1>
          <p className="mt-6 text-lg leading-8 text-gray-300">
            Stock &amp; Logis의 서비스별 표준 계약서 양식을 확인하실 수
            있습니다.
          </p>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 sm:py-24 lg:px-8 lg:py-32">
        <div className="mx-auto max-w-4xl">
          <div className="mb-8 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            본 계약서는 참고용 초안이며, 실제 계약 체결 시 법률 전문가의 검수를
            권장합니다.
          </div>

          <div className="grid gap-6">
            {contracts.map((contract) => (
              <Card key={contract.href} className="transition-shadow hover:shadow-lg">
                <CardHeader>
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-primary-100">
                      <contract.icon className="h-6 w-6 text-primary-600" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">{contract.title}</CardTitle>
                      <CardDescription className="mt-1">
                        {contract.articles}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="mb-4 text-sm text-gray-600">
                    {contract.description}
                  </p>
                  <Button variant="outline" asChild>
                    <Link href={contract.href}>
                      계약서 보기
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-12 text-center">
            <p className="text-sm text-gray-500">
              계약 관련 문의는{" "}
              <a
                href="mailto:logisglobalceo@gmail.com"
                className="font-medium text-primary-600 hover:underline"
              >
                logisglobalceo@gmail.com
              </a>
              으로 연락해 주세요.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
