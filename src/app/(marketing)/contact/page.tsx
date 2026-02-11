"use client";

import { useState } from "react";
import { Send, Phone, Mail, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { COMPANY } from "@/lib/constants/homepage-data";

const inquiryTypes = [
  "무료 재고 진단 신청",
  "SCM 컨설팅 문의",
  "교육/강의 문의",
  "FloStok 솔루션 문의",
  "기타 문의",
];

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // TODO: 실제 폼 제출 로직 구현
    setSubmitted(true);
  };

  return (
    <div>
      {/* 헤더 */}
      <section className="bg-gradient-to-b from-slate-900 to-slate-800 px-6 py-24 sm:py-32 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-sm font-semibold text-primary-400">Contact</p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-white sm:text-5xl">
            무료 재고 진단 신청
          </h1>
          <p className="mt-6 text-lg text-gray-300">
            귀사의 재고 현황을 진단하고 개선 가능성을 알려드립니다.
            <br />
            22년 경력의 SCM 전문가가 직접 답변드립니다.
          </p>
        </div>
      </section>

      {/* 폼 + 연락처 */}
      <section className="bg-white px-6 py-24 sm:py-32 lg:px-8">
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-12 lg:grid-cols-5">
          {/* 연락처 정보 */}
          <div className="lg:col-span-2">
            <h2 className="text-2xl font-bold text-gray-900">연락처 정보</h2>
            <p className="mt-4 text-gray-600 leading-7">
              상담, 교육, 솔루션 도입에 대한 문의를 남겨주시면 영업일 기준 1일
              이내에 답변드립니다.
            </p>

            <div className="mt-8 space-y-6">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50">
                  <Mail className="h-5 w-5 text-primary-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">이메일</p>
                  <p className="font-medium text-gray-900">{COMPANY.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50">
                  <Phone className="h-5 w-5 text-primary-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">전화</p>
                  <p className="font-medium text-gray-900">{COMPANY.phone}</p>
                </div>
              </div>
            </div>
          </div>

          {/* 문의 폼 */}
          <div className="lg:col-span-3">
            {submitted ? (
              <div className="rounded-2xl bg-green-50 p-12 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                  <Send className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="mt-6 text-xl font-bold text-gray-900">
                  문의가 접수되었습니다
                </h3>
                <p className="mt-2 text-gray-600">
                  영업일 기준 1일 이내에 답변드리겠습니다.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="name"
                      className="block text-sm font-medium text-gray-700"
                    >
                      이름 *
                    </label>
                    <Input
                      id="name"
                      name="name"
                      required
                      className="mt-2"
                      placeholder="홍길동"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="company"
                      className="block text-sm font-medium text-gray-700"
                    >
                      회사명
                    </label>
                    <Input
                      id="company"
                      name="company"
                      className="mt-2"
                      placeholder="(주) 회사명"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="email"
                      className="block text-sm font-medium text-gray-700"
                    >
                      이메일 *
                    </label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      required
                      className="mt-2"
                      placeholder="email@company.com"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="phone"
                      className="block text-sm font-medium text-gray-700"
                    >
                      연락처
                    </label>
                    <Input
                      id="phone"
                      name="phone"
                      className="mt-2"
                      placeholder="010-0000-0000"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="type"
                    className="block text-sm font-medium text-gray-700"
                  >
                    문의 유형 *
                  </label>
                  <Select name="type" required>
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="문의 유형을 선택해 주세요" />
                    </SelectTrigger>
                    <SelectContent>
                      {inquiryTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label
                    htmlFor="message"
                    className="block text-sm font-medium text-gray-700"
                  >
                    문의 내용 *
                  </label>
                  <Textarea
                    id="message"
                    name="message"
                    required
                    rows={5}
                    className="mt-2"
                    placeholder="문의 내용을 작성해 주세요..."
                  />
                </div>

                <Button type="submit" size="lg" className="w-full sm:w-auto">
                  <Send className="mr-2 h-4 w-4" />
                  문의 보내기
                </Button>
              </form>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
