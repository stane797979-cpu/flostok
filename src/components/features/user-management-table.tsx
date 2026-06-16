'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Trash2, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface User {
  id: string
  name: string
  email: string
  role: 'admin' | 'manager' | 'viewer'
  joinedDate: string
}

interface UserManagementTableProps {
  className?: string
}

// Mock 사용자 데이터
const mockUsers: User[] = [
  {
    id: '1',
    name: '김영희',
    email: 'younghee.kim@example.com',
    role: 'admin',
    joinedDate: '2024-01-15',
  },
  {
    id: '2',
    name: '이순신',
    email: 'soonsin.lee@example.com',
    role: 'manager',
    joinedDate: '2024-02-01',
  },
  {
    id: '3',
    name: '박민수',
    email: 'minsu.park@example.com',
    role: 'manager',
    joinedDate: '2024-02-10',
  },
  {
    id: '4',
    name: '정소연',
    email: 'soyeon.jung@example.com',
    role: 'viewer',
    joinedDate: '2024-02-20',
  },
  {
    id: '5',
    name: '최장열',
    email: 'jangyeol.choi@example.com',
    role: 'viewer',
    joinedDate: '2024-03-01',
  },
]

const roleLabels = {
  admin: '관리자',
  manager: '관리자/매니저',
  viewer: '뷰어',
}

export function UserManagementTable({ className }: UserManagementTableProps) {
  const [users, setUsers] = useState<User[]>(mockUsers)
  const [selectedUser, setSelectedUser] = useState<string | null>(null)

  const handleRoleChange = (userId: string, newRole: 'admin' | 'manager' | 'viewer') => {
    setUsers(users.map((user) => (user.id === userId ? { ...user, role: newRole } : user)))
  }

  const handleDeleteUser = (userId: string) => {
    setUsers(users.filter((user) => user.id !== userId))
  }

  const handleSelectUser = (userId: string) => {
    setSelectedUser(selectedUser === userId ? null : userId)
  }

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">사용자 목록</h3>
          <p className="mt-1 text-sm text-slate-500">총 {users.length}명의 사용자</p>
        </div>
        <Button variant="default" size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          새 사용자 추가
        </Button>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead className="w-12">선택</TableHead>
              <TableHead className="min-w-[200px]">이름</TableHead>
              <TableHead className="min-w-[240px]">이메일</TableHead>
              <TableHead className="min-w-[150px]">권한</TableHead>
              <TableHead className="min-w-[130px]">가입일</TableHead>
              <TableHead className="w-12 text-right">작업</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow
                key={user.id}
                className={cn(
                  'transition-colors',
                  selectedUser === user.id ? 'bg-blue-50' : 'hover:bg-slate-50'
                )}
              >
                <TableCell className="text-center">
                  <input
                    type="checkbox"
                    checked={selectedUser === user.id}
                    onChange={() => handleSelectUser(user.id)}
                    className="h-4 w-4 rounded border-gray-300 cursor-pointer"
                  />
                </TableCell>
                <TableCell className="font-medium text-slate-900">{user.name}</TableCell>
                <TableCell className="text-sm text-slate-600">{user.email}</TableCell>
                <TableCell>
                  <Select
                    value={user.role}
                    onValueChange={(newRole) =>
                      handleRoleChange(user.id, newRole as 'admin' | 'manager' | 'viewer')
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">{roleLabels.admin}</SelectItem>
                      <SelectItem value="manager">{roleLabels.manager}</SelectItem>
                      <SelectItem value="viewer">{roleLabels.viewer}</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-sm text-slate-600">
                  {new Date(user.joinedDate).toLocaleDateString('ko-KR', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                  })}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteUser(user.id)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {users.length === 0 && (
        <div className="flex h-32 items-center justify-center rounded-lg border border-dashed">
          <p className="text-sm text-slate-500">사용자가 없습니다.</p>
        </div>
      )}

      <div className="flex items-center justify-between rounded-lg bg-blue-50 p-3 border border-blue-200">
        <p className="text-sm text-blue-900">
          선택된 사용자: <span className="font-semibold">{selectedUser ? '1명' : '없음'}</span>
        </p>
        {selectedUser && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedUser(null)}
            className="text-xs"
          >
            선택 해제
          </Button>
        )}
      </div>
    </div>
  )
}
