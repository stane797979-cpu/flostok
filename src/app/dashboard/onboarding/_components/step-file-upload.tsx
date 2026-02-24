'use client'

import { useState, useCallback, useRef } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Upload, FileSpreadsheet, X, AlertCircle, Download } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { UploadedFileInfo, OnboardingDataType } from '@/types/onboarding'
import { DATA_TYPE_LABELS } from '@/types/onboarding'
import { uploadOnboardingFile, deleteOnboardingFile, updateFileDataType } from '@/server/actions/onboarding'
import { getExcelTemplateBase64, type ImportType } from '@/server/actions/excel-import'
import { useToast } from '@/hooks/use-toast'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface StepFileUploadProps {
  sessionId: string
  files: UploadedFileInfo[]
  onFilesChange: (files: UploadedFileInfo[]) => void
}

const MAX_FILES = 5
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB

/** 파일명에서 데이터 유형 자동 추론 */
function inferDataType(fileName: string): OnboardingDataType {
  const lower = fileName.toLowerCase()
  if (lower.includes('판매') || lower.includes('sales') || lower.includes('출고')) return 'sales'
  if (lower.includes('재고') || lower.includes('inventory') || lower.includes('stock')) return 'inventory'
  if (lower.includes('공급') || lower.includes('supplier') || lower.includes('업체') || lower.includes('거래처')) return 'suppliers'
  if (lower.includes('입고') || lower.includes('inbound') || lower.includes('수입')) return 'inbound'
  return 'products' // 기본값
}

export function StepFileUpload({ sessionId, files, onFilesChange }: StepFileUploadProps) {
  const { toast } = useToast()
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [templateDownloading, setTemplateDownloading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDownloadTemplate = async (type: ImportType) => {
    setTemplateDownloading(true)
    try {
      const base64 = await getExcelTemplateBase64(type)
      const binary = atob(base64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i)
      }
      const blob = new Blob([bytes], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${type === 'sales' ? '판매데이터' : '제품마스터'}_템플릿.xlsx`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch {
      toast({
        title: '템플릿 다운로드 실패',
        description: '다시 시도해 주세요.',
        variant: 'destructive',
      })
    } finally {
      setTemplateDownloading(false)
    }
  }

  const validateFile = (file: File): string | null => {
    const validExtensions = ['.xlsx', '.xls']
    const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'))

    if (!validExtensions.includes(fileExtension)) {
      return '.xlsx, .xls 파일만 업로드 가능합니다.'
    }

    if (file.size > MAX_FILE_SIZE) {
      return '파일 크기는 10MB 이하여야 합니다.'
    }

    return null
  }

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const base64 = reader.result as string
        // "data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64," 부분 제거
        const base64Data = base64.split(',')[1]
        resolve(base64Data)
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  const handleFile = useCallback(async (file: File) => {
    if (files.length >= MAX_FILES) {
      toast({
        title: '업로드 제한',
        description: `최대 ${MAX_FILES}개 파일까지 업로드 가능합니다.`,
        variant: 'destructive',
      })
      return
    }

    const error = validateFile(file)
    if (error) {
      toast({
        title: '파일 오류',
        description: error,
        variant: 'destructive',
      })
      return
    }

    setIsUploading(true)

    try {
      const fileBase64 = await fileToBase64(file)
      const guessedType = inferDataType(file.name)

      const result = await uploadOnboardingFile({
        sessionId,
        fileName: file.name,
        fileSize: file.size,
        fileBase64,
        dataType: guessedType,
      })

      if (result.success && result.data) {
        const newFile: UploadedFileInfo = {
          id: result.data.id,
          file,
          fileName: file.name,
          fileSize: file.size,
          dataType: guessedType,
          status: 'uploaded',
        }

        onFilesChange([...files, newFile])

        toast({
          title: '업로드 완료',
          description: `${file.name} 파일이 업로드되었습니다.`,
        })
      } else {
        toast({
          title: '업로드 실패',
          description: result.error || '파일 업로드 중 오류가 발생했습니다.',
          variant: 'destructive',
        })
      }
    } catch {
      toast({
        title: '업로드 실패',
        description: '파일 처리 중 오류가 발생했습니다.',
        variant: 'destructive',
      })
    } finally {
      setIsUploading(false)
    }
  }, [files, sessionId, onFilesChange, toast])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const droppedFiles = Array.from(e.dataTransfer.files)
    if (droppedFiles.length > 0) {
      handleFile(droppedFiles[0])
    }
  }, [handleFile])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files
    if (selectedFiles && selectedFiles.length > 0) {
      handleFile(selectedFiles[0])
    }
    // input 초기화
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [handleFile])

  const handleClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleDataTypeChange = async (fileId: string, dataType: OnboardingDataType) => {
    // 클라이언트 state 즉시 업데이트
    onFilesChange(
      files.map((f) =>
        f.id === fileId ? { ...f, dataType } : f
      )
    )
    // DB에도 반영
    const result = await updateFileDataType(fileId, dataType)
    if (!result.success) {
      toast({
        title: '데이터 유형 변경 실패',
        description: result.error,
        variant: 'destructive',
      })
    }
  }

  const handleDeleteFile = async (fileId: string) => {
    const result = await deleteOnboardingFile(fileId)

    if (result.success) {
      onFilesChange(files.filter((f) => f.id !== fileId))
      toast({
        title: '삭제 완료',
        description: '파일이 삭제되었습니다.',
      })
    } else {
      toast({
        title: '삭제 실패',
        description: result.error || '파일 삭제 중 오류가 발생했습니다.',
        variant: 'destructive',
      })
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
  }

  return (
    <Card className="p-8">
      <div className="flex items-center gap-3 mb-6">
        <FileSpreadsheet className="h-6 w-6 text-primary" />
        <div>
          <h2 className="text-xl font-semibold">파일 업로드</h2>
          <p className="text-sm text-slate-500 mt-1">
            제품, 판매, 재고 등의 Excel 파일을 업로드하세요 (최대 {MAX_FILES}개)
          </p>
        </div>
      </div>

      {/* 템플릿 다운로드 */}
      <div className="flex items-center gap-2 mb-6 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
        <span className="text-sm text-slate-600 mr-2">템플릿 다운로드:</span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleDownloadTemplate('products')}
          disabled={templateDownloading}
        >
          <Download className="h-4 w-4 mr-1" />
          제품 마스터
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleDownloadTemplate('sales')}
          disabled={templateDownloading}
        >
          <Download className="h-4 w-4 mr-1" />
          판매 데이터
        </Button>
      </div>

      {/* 드래그 & 드롭 영역 */}
      {files.length < MAX_FILES && (
        <div
          onClick={handleClick}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleClick(); } }}
          aria-label="엑셀 파일 업로드 — 클릭하거나 파일을 드래그하세요"
          className={cn(
            'border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors mb-6',
            isDragging
              ? 'border-primary bg-primary/5'
              : 'border-slate-300 hover:border-primary hover:bg-slate-50 dark:hover:bg-slate-800/30',
            isUploading && 'opacity-50 pointer-events-none'
          )}
        >
          <Upload className="mx-auto h-12 w-12 text-slate-400 mb-4" />
          <p className="text-lg font-medium text-slate-700 mb-2">
            {isUploading ? '업로드 중...' : 'Excel 파일을 드래그하거나 클릭하여 업로드'}
          </p>
          <p className="text-sm text-slate-500">
            .xlsx, .xls 파일 (최대 10MB)
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            className="hidden"
            disabled={isUploading}
          />
        </div>
      )}

      {/* 업로드된 파일 목록 */}
      {files.length > 0 && (
        <div className="space-y-4">
          <h3 className="font-medium text-slate-700">
            업로드된 파일 ({files.length}/{MAX_FILES})
          </h3>

          {files.map((file) => (
            <div key={file.id} className="border rounded-lg p-4 bg-slate-50 dark:bg-slate-800/50">
              <div className="flex items-start gap-4">
                <FileSpreadsheet className="h-10 w-10 text-green-600 mt-1 flex-shrink-0" />

                <div className="flex-1 min-w-0 space-y-3">
                  <div>
                    <p className="font-medium text-slate-900 truncate">{file.fileName}</p>
                    <p className="text-sm text-slate-500 mt-1">
                      {formatFileSize(file.fileSize)}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`dataType-${file.id}`} className="text-sm">
                      데이터 유형 <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={file.dataType}
                      onValueChange={(value) =>
                        handleDataTypeChange(file.id!, value as OnboardingDataType)
                      }
                    >
                      <SelectTrigger id={`dataType-${file.id}`}>
                        <SelectValue placeholder="데이터 유형 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(DATA_TYPE_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDeleteFile(file.id!)}
                  className="text-slate-400 hover:text-red-600 flex-shrink-0"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 안내 메시지 */}
      {files.length === 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            최소 1개 이상의 파일을 업로드해야 다음 단계로 진행할 수 있습니다.
          </AlertDescription>
        </Alert>
      )}

      {files.length >= MAX_FILES && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            최대 {MAX_FILES}개 파일까지 업로드할 수 있습니다. 파일을 삭제하고 다시 업로드하세요.
          </AlertDescription>
        </Alert>
      )}
    </Card>
  )
}
