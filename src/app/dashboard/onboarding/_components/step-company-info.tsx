'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { CompanyInfo } from '@/types/onboarding'
import {
  INDUSTRY_OPTIONS,
  EMPLOYEE_COUNT_OPTIONS,
  SKU_COUNT_OPTIONS,
  CURRENT_SYSTEM_OPTIONS,
} from '@/types/onboarding'
import { createOnboardingSession } from '@/server/actions/onboarding'
import { useToast } from '@/hooks/use-toast'
import { Building2 } from 'lucide-react'

interface StepCompanyInfoProps {
  companyInfo: CompanyInfo
  onChange: (info: CompanyInfo) => void
  onSubmit: (sessionId: string, info: CompanyInfo) => void
}

export function StepCompanyInfo({ companyInfo, onChange, onSubmit }: StepCompanyInfoProps) {
  const { toast } = useToast()
  const [companyName, setCompanyName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleChange = (field: keyof CompanyInfo, value: string) => {
    onChange({ ...companyInfo, [field]: value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!companyName.trim()) {
      toast({
        title: '입력 오류',
        description: '회사명을 입력해주세요.',
        variant: 'destructive',
      })
      return
    }

    if (!companyInfo.industry || !companyInfo.employeeCount || !companyInfo.skuCount || !companyInfo.currentSystem) {
      toast({
        title: '입력 오류',
        description: '필수 항목을 모두 선택해주세요.',
        variant: 'destructive',
      })
      return
    }

    setIsSubmitting(true)

    const result = await createOnboardingSession({
      companyName: companyName.trim(),
      companyInfo,
    })

    setIsSubmitting(false)

    if (result.success && result.data) {
      toast({
        title: '세션 생성 완료',
        description: '온보딩 세션이 생성되었습니다.',
      })
      onSubmit(result.data.id, companyInfo)
    } else {
      toast({
        title: '세션 생성 실패',
        description: result.error || '세션 생성 중 오류가 발생했습니다.',
        variant: 'destructive',
      })
    }
  }

  return (
    <Card className="p-8">
      <div className="flex items-center gap-3 mb-6">
        <Building2 className="h-6 w-6 text-primary" />
        <div>
          <h2 className="text-xl font-semibold">회사 정보</h2>
          <p className="text-sm text-slate-500 mt-1">
            온보딩 대상 회사의 기본 정보를 입력하세요
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 회사명 */}
        <div className="space-y-2">
          <Label htmlFor="companyName">
            회사명 <span className="text-red-500">*</span>
          </Label>
          <Input
            id="companyName"
            placeholder="예: ABC 유통"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            required
          />
        </div>

        {/* 업종 */}
        <div className="space-y-2">
          <Label htmlFor="industry">
            업종 <span className="text-red-500">*</span>
          </Label>
          <Select
            value={companyInfo.industry}
            onValueChange={(value) => handleChange('industry', value)}
            required
          >
            <SelectTrigger id="industry">
              <SelectValue placeholder="업종 선택" />
            </SelectTrigger>
            <SelectContent>
              {INDUSTRY_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 직원 규모 */}
        <div className="space-y-2">
          <Label htmlFor="employeeCount">
            직원 규모 <span className="text-red-500">*</span>
          </Label>
          <Select
            value={companyInfo.employeeCount}
            onValueChange={(value) => handleChange('employeeCount', value)}
            required
          >
            <SelectTrigger id="employeeCount">
              <SelectValue placeholder="직원 규모 선택" />
            </SelectTrigger>
            <SelectContent>
              {EMPLOYEE_COUNT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* SKU 수 */}
        <div className="space-y-2">
          <Label htmlFor="skuCount">
            관리 SKU 수 <span className="text-red-500">*</span>
          </Label>
          <Select
            value={companyInfo.skuCount}
            onValueChange={(value) => handleChange('skuCount', value)}
            required
          >
            <SelectTrigger id="skuCount">
              <SelectValue placeholder="SKU 수 선택" />
            </SelectTrigger>
            <SelectContent>
              {SKU_COUNT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 현재 재고관리 방식 */}
        <div className="space-y-2">
          <Label htmlFor="currentSystem">
            현재 재고관리 방식 <span className="text-red-500">*</span>
          </Label>
          <Select
            value={companyInfo.currentSystem}
            onValueChange={(value) => handleChange('currentSystem', value)}
            required
          >
            <SelectTrigger id="currentSystem">
              <SelectValue placeholder="현재 관리 방식 선택" />
            </SelectTrigger>
            <SelectContent>
              {CURRENT_SYSTEM_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 추가 메모 */}
        <div className="space-y-2">
          <Label htmlFor="notes">추가 메모 (선택)</Label>
          <Textarea
            id="notes"
            placeholder="특이사항이나 추가 정보를 입력하세요"
            value={companyInfo.notes || ''}
            onChange={(e) => handleChange('notes', e.target.value)}
            rows={4}
          />
        </div>

        {/* 제출 버튼 */}
        <div className="pt-4">
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? '세션 생성 중...' : '다음 단계로'}
          </Button>
        </div>
      </form>
    </Card>
  )
}
