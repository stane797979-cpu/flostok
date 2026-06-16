'use client'

import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { AlertCircle, CheckCircle2 } from 'lucide-react'

interface ImportPreviewProps {
  data: Record<string, string | number>[]
  errors: { row: number; message: string }[]
  className?: string
}

export function ImportPreview({ data, errors, className }: ImportPreviewProps) {
  if (data.length === 0) {
    return null
  }

  const columns = Object.keys(data[0])
  const hasErrors = errors.length > 0

  return (
    <div className={className}>
      <div className="mb-4">
        {hasErrors ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {errors.length}개의 문제가 발견되었습니다. 하단의 오류 행을 확인해주세요.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              모든 데이터가 정상적으로 검증되었습니다.
            </AlertDescription>
          </Alert>
        )}
      </div>

      <div className="border rounded-lg overflow-hidden">
        <div className="bg-slate-50 px-4 py-3 border-b">
          <p className="text-sm font-medium text-slate-700">
            데이터 미리보기 (처음 {data.length}행)
          </p>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 text-center">#</TableHead>
                {columns.map((column) => (
                  <TableHead key={column}>{column}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row, index) => {
                const rowError = errors.find((e) => e.row === index + 1)
                return (
                  <TableRow
                    key={index}
                    className={rowError ? 'bg-red-50' : ''}
                  >
                    <TableCell className="text-center font-medium text-slate-500">
                      {index + 1}
                    </TableCell>
                    {columns.map((column) => (
                      <TableCell key={column}>
                        {row[column]?.toString() || '-'}
                      </TableCell>
                    ))}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {hasErrors && (
        <div className="mt-4 border border-red-200 rounded-lg bg-red-50 p-4">
          <p className="text-sm font-medium text-red-800 mb-2">오류 목록</p>
          <ul className="space-y-1">
            {errors.map((error, index) => (
              <li key={index} className="text-sm text-red-700">
                <span className="font-medium">행 {error.row}:</span> {error.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
