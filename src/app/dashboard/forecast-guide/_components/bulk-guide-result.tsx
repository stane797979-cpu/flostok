'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  CheckCircle,
  Package,
  TrendingUp,
  AlertTriangle,
  Shield,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Separator } from '@/components/ui/separator'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ChartContainer,
  ChartConfig,
} from '@/components/ui/chart'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import type { BulkForecastResult } from '@/server/actions/forecast-guide'
import { saveBulkForecastsToDB } from '@/server/actions/forecast-guide'

interface BulkGuideResultProps {
  result: BulkForecastResult
  onReset: () => void
}

const chartConfig = {
  A: {
    label: 'A등급',
    color: 'hsl(var(--destructive))',
  },
  B: {
    label: 'B등급',
    color: 'hsl(var(--warning))',
  },
  C: {
    label: 'C등급',
    color: 'hsl(var(--muted-foreground))',
  },
} satisfies ChartConfig

export function BulkGuideResult({ result, onReset }: BulkGuideResultProps) {
  const { toast } = useToast()
  const [searchQuery, setSearchQuery] = useState('')
  const [gradeFilter, setGradeFilter] = useState<string>('all')
  const [confidenceFilter, setConfidenceFilter] = useState<string>('all')
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [showMore, setShowMore] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [isSkippedOpen, setIsSkippedOpen] = useState(false)

  const { summary, products, insufficientDataProducts: skippedProducts } = result

  // ABC-XYZ 매트릭스 데이터 계산
  const matrixData = {
    AX: 0, AY: 0, AZ: 0,
    BX: 0, BY: 0, BZ: 0,
    CX: 0, CY: 0, CZ: 0,
  }
  products.forEach((p) => {
    const grade = p.combinedGrade
    if (grade in matrixData) {
      matrixData[grade as keyof typeof matrixData]++
    }
  })

  const maxCount = Math.max(...Object.values(matrixData))

  // 등급별 분포 차트 데이터
  const chartData = [
    { grade: 'AX', count: matrixData.AX, fill: 'hsl(var(--destructive))' },
    { grade: 'AY', count: matrixData.AY, fill: 'hsl(var(--destructive))' },
    { grade: 'AZ', count: matrixData.AZ, fill: 'hsl(var(--destructive))' },
    { grade: 'BX', count: matrixData.BX, fill: 'hsl(var(--warning))' },
    { grade: 'BY', count: matrixData.BY, fill: 'hsl(var(--warning))' },
    { grade: 'BZ', count: matrixData.BZ, fill: 'hsl(var(--warning))' },
    { grade: 'CX', count: matrixData.CX, fill: 'hsl(var(--muted-foreground))' },
    { grade: 'CY', count: matrixData.CY, fill: 'hsl(var(--muted-foreground))' },
    { grade: 'CZ', count: matrixData.CZ, fill: 'hsl(var(--muted-foreground))' },
  ]

  // 필터링
  let filteredProducts = products
  if (searchQuery) {
    filteredProducts = filteredProducts.filter(
      (p) =>
        p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }
  if (gradeFilter !== 'all') {
    filteredProducts = filteredProducts.filter((p) => p.combinedGrade === gradeFilter)
  }
  if (confidenceFilter !== 'all') {
    filteredProducts = filteredProducts.filter((p) => p.confidence === confidenceFilter)
  }

  const displayedProducts = showMore ? filteredProducts : filteredProducts.slice(0, 50)

  const toggleRow = (sku: string) => {
    setExpandedRows((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(sku)) {
        newSet.delete(sku)
      } else {
        newSet.add(sku)
      }
      return newSet
    })
  }

  const handleSaveToPSI = async () => {
    setIsSaving(true)
    try {
      await saveBulkForecastsToDB(
        result.products.map((p) => ({
          productId: p.productId,
          method: p.method,
          forecast: p.forecast,
          mape: p.mape,
        }))
      )
      toast({
        title: '저장 완료',
        description: `${products.length}개 제품의 수요예측이 PSI에 반영되었습니다.`,
      })
      setIsSaved(true)
    } catch (error) {
      toast({
        title: '저장 실패',
        description: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* [1] 헤더 */}
      <div className="flex flex-col items-center text-center space-y-2">
        <CheckCircle className="h-12 w-12 text-green-600" />
        <h2 className="text-2xl font-bold">전체 SKU 수요예측 분석 완료</h2>
        <p className="text-muted-foreground">
          {summary.analyzedProducts}개 제품 분석 완료 · {summary.skippedProducts}개 데이터 부족
        </p>
      </div>

      {/* [2] 요약 카드 4개 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">분석 제품 수</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.analyzedProducts}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">평균 예측 정확도</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.avgMape}%</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">데이터 부족</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.skippedProducts}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">높은 신뢰도</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {products.filter((p) => p.confidence === 'high').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* [3] ABC-XYZ 매트릭스 */}
      <Card>
        <CardHeader>
          <CardTitle>ABC-XYZ 매트릭스</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-2">
            <div className="text-center font-medium"></div>
            <div className="text-center font-medium text-sm">X (안정)</div>
            <div className="text-center font-medium text-sm">Y (변동)</div>
            <div className="text-center font-medium text-sm">Z (불규칙)</div>

            <div className="text-center font-medium text-sm">A (고매출)</div>
            {['AX', 'AY', 'AZ'].map((grade) => (
              <button
                key={grade}
                onClick={() => setGradeFilter(gradeFilter === grade ? 'all' : grade)}
                className={cn(
                  'p-4 rounded-md border-2 transition-all hover:border-primary/50',
                  gradeFilter === grade ? 'border-primary bg-primary/10' : 'border-border',
                  matrixData[grade as keyof typeof matrixData] > 0 &&
                    matrixData[grade as keyof typeof matrixData] >= maxCount * 0.5
                    ? 'bg-red-50'
                    : matrixData[grade as keyof typeof matrixData] > 0
                      ? 'bg-red-50/50'
                      : 'bg-muted/20'
                )}
              >
                <div className="text-2xl font-bold">{matrixData[grade as keyof typeof matrixData]}</div>
                <div className="text-xs text-muted-foreground">{grade}</div>
              </button>
            ))}

            <div className="text-center font-medium text-sm">B (중매출)</div>
            {['BX', 'BY', 'BZ'].map((grade) => (
              <button
                key={grade}
                onClick={() => setGradeFilter(gradeFilter === grade ? 'all' : grade)}
                className={cn(
                  'p-4 rounded-md border-2 transition-all hover:border-primary/50',
                  gradeFilter === grade ? 'border-primary bg-primary/10' : 'border-border',
                  matrixData[grade as keyof typeof matrixData] > 0 &&
                    matrixData[grade as keyof typeof matrixData] >= maxCount * 0.5
                    ? 'bg-amber-50'
                    : matrixData[grade as keyof typeof matrixData] > 0
                      ? 'bg-amber-50/50'
                      : 'bg-muted/20'
                )}
              >
                <div className="text-2xl font-bold">{matrixData[grade as keyof typeof matrixData]}</div>
                <div className="text-xs text-muted-foreground">{grade}</div>
              </button>
            ))}

            <div className="text-center font-medium text-sm">C (저매출)</div>
            {['CX', 'CY', 'CZ'].map((grade) => (
              <button
                key={grade}
                onClick={() => setGradeFilter(gradeFilter === grade ? 'all' : grade)}
                className={cn(
                  'p-4 rounded-md border-2 transition-all hover:border-primary/50',
                  gradeFilter === grade ? 'border-primary bg-primary/10' : 'border-border',
                  matrixData[grade as keyof typeof matrixData] > 0 &&
                    matrixData[grade as keyof typeof matrixData] >= maxCount * 0.5
                    ? 'bg-slate-100'
                    : matrixData[grade as keyof typeof matrixData] > 0
                      ? 'bg-slate-50'
                      : 'bg-muted/20'
                )}
              >
                <div className="text-2xl font-bold">{matrixData[grade as keyof typeof matrixData]}</div>
                <div className="text-xs text-muted-foreground">{grade}</div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* [4] 등급별 분포 차트 */}
      <Card>
        <CardHeader>
          <CardTitle>등급별 분포</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[200px] w-full !aspect-auto">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="grade" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* [5] SKU별 상세 테이블 */}
      <Card>
        <CardHeader>
          <CardTitle>SKU별 상세 분석</CardTitle>
          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <Input
              placeholder="SKU 또는 제품명 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-sm"
            />
            <Select value={gradeFilter} onValueChange={setGradeFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="등급 필터" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">모든 등급</SelectItem>
                <SelectItem value="AX">AX</SelectItem>
                <SelectItem value="AY">AY</SelectItem>
                <SelectItem value="AZ">AZ</SelectItem>
                <SelectItem value="BX">BX</SelectItem>
                <SelectItem value="BY">BY</SelectItem>
                <SelectItem value="BZ">BZ</SelectItem>
                <SelectItem value="CX">CX</SelectItem>
                <SelectItem value="CY">CY</SelectItem>
                <SelectItem value="CZ">CZ</SelectItem>
              </SelectContent>
            </Select>
            <Select value={confidenceFilter} onValueChange={setConfidenceFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="신뢰도 필터" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">모든 신뢰도</SelectItem>
                <SelectItem value="high">높음</SelectItem>
                <SelectItem value="medium">보통</SelectItem>
                <SelectItem value="low">낮음</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]"></TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>제품명</TableHead>
                  <TableHead>등급</TableHead>
                  <TableHead>추천방법</TableHead>
                  <TableHead className="text-right">M+1</TableHead>
                  <TableHead className="text-right">M+2</TableHead>
                  <TableHead className="text-right">M+3</TableHead>
                  <TableHead className="text-right">MAPE</TableHead>
                  <TableHead>신뢰도</TableHead>
                  <TableHead>공급전략</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayedProducts.map((product) => {
                  const isExpanded = expandedRows.has(product.sku)
                  return (
                    <>
                      <TableRow
                        key={product.sku}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => toggleRow(product.sku)}
                      >
                        <TableCell>
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-sm">{product.sku}</TableCell>
                        <TableCell>{product.name}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              product.combinedGrade.startsWith('A')
                                ? 'destructive'
                                : product.combinedGrade.startsWith('B')
                                  ? 'default'
                                  : 'secondary'
                            }
                          >
                            {product.combinedGrade}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{product.methodLabel}</TableCell>
                        <TableCell className="text-right font-medium">
                          {product.forecast[0]?.value?.toLocaleString() ?? '-'}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {product.forecast[1]?.value?.toLocaleString() ?? '-'}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {product.forecast[2]?.value?.toLocaleString() ?? '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <span
                            className={cn(
                              'font-medium',
                              product.mape < 15
                                ? 'text-green-600'
                                : product.mape < 30
                                  ? 'text-amber-600'
                                  : 'text-red-600'
                            )}
                          >
                            {product.mape}%
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              product.confidence === 'high'
                                ? 'default'
                                : product.confidence === 'medium'
                                  ? 'secondary'
                                  : 'destructive'
                            }
                          >
                            {product.confidence === 'high'
                              ? '높음'
                              : product.confidence === 'medium'
                                ? '보통'
                                : '낮음'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {product.supplyStrategy.orderType}
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow>
                          <TableCell colSpan={11} className="bg-muted/30">
                            <div className="p-4 space-y-2">
                              <h4 className="font-semibold">공급전략 상세</h4>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                                <div>
                                  <span className="font-medium">발주방식:</span>{' '}
                                  {product.supplyStrategy.orderType}
                                </div>
                                <div>
                                  <span className="font-medium">안전재고 수준:</span>{' '}
                                  {product.supplyStrategy.safetyLevel}
                                </div>
                                <div>
                                  <span className="font-medium">검토주기:</span>{' '}
                                  {product.supplyStrategy.reviewCycle}
                                </div>
                                <div className="sm:col-span-2">
                                  <span className="font-medium">팁:</span>{' '}
                                  {product.supplyStrategy.tip}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  )
                })}
              </TableBody>
            </Table>
          </div>
          {filteredProducts.length > 50 && !showMore && (
            <div className="flex justify-center pt-4">
              <Button variant="outline" onClick={() => setShowMore(true)}>
                더 보기 ({filteredProducts.length - 50}개 더)
              </Button>
            </div>
          )}
          {filteredProducts.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              검색 결과가 없습니다.
            </div>
          )}
        </CardContent>
      </Card>

      {/* [6] 데이터 부족 제품 */}
      {skippedProducts.length > 0 && (
        <Collapsible open={isSkippedOpen} onOpenChange={setIsSkippedOpen}>
          <Card>
            <CardHeader>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <span>데이터 부족 제품 {skippedProducts.length}개</span>
                  </div>
                  {isSkippedOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>SKU</TableHead>
                        <TableHead>제품명</TableHead>
                        <TableHead className="text-right">데이터 개월 수</TableHead>
                        <TableHead>사유</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {skippedProducts.map((product) => (
                        <TableRow key={product.sku}>
                          <TableCell className="font-mono text-sm">{product.sku}</TableCell>
                          <TableCell>{product.name}</TableCell>
                          <TableCell className="text-right">{product.dataMonths}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{product.reason}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      <Separator />

      {/* [7] CTA 버튼 */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Button
          size="lg"
          onClick={handleSaveToPSI}
          disabled={isSaving || isSaved}
        >
          {isSaving ? '저장 중...' : isSaved ? 'PSI 반영 완료' : 'PSI에 반영'}
        </Button>
        <Button size="lg" variant="outline" asChild>
          <Link href="/dashboard/psi">PSI 계획으로 이동</Link>
        </Button>
        <Button size="lg" variant="ghost" onClick={onReset}>
          처음으로 돌아가기
        </Button>
      </div>
    </div>
  )
}
