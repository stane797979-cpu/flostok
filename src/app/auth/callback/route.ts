/**
 * OAuth 콜백 처리
 *
 * 카카오, 구글 OAuth 인증 후 리다이렉트되는 엔드포인트
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/server/db'
import { users, organizations } from '@/server/db/schema'
import { eq } from 'drizzle-orm'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()

    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // 세션 교환 성공 후, DB에 사용자 레코드가 없으면 생성
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const existing = await db.query.users.findFirst({
            where: eq(users.authId, user.id),
          })
          if (!existing) {
            // 이메일로 임시 사용자 찾아서 authId 업데이트
            const tempUser = await db.query.users.findFirst({
              where: eq(users.email, user.email || ''),
            })
            if (tempUser) {
              await db.update(users).set({ authId: user.id, updatedAt: new Date() }).where(eq(users.id, tempUser.id))
            } else {
              // 완전 새 사용자: 전용 조직을 신규 생성하여 admin으로 등록
              // 멀티테넌시 보안: 기존 조직에 임의 편입 금지
              const userName = user.user_metadata?.name || user.email?.split('@')[0] || '사용자'
              const orgName = `${userName}님의 조직`

              // slug 중복 방지: 타임스탬프 suffix 추가
              const baseSlug = (user.email?.split('@')[0] || 'org')
                .toLowerCase()
                .replace(/[^a-z0-9]/g, '-')
                .slice(0, 40)
              const slug = `${baseSlug}-${Date.now()}`

              const [newOrg] = await db.insert(organizations).values({
                name: orgName,
                slug,
                plan: 'free',
              }).returning()

              if (newOrg) {
                await db.insert(users).values({
                  authId: user.id,
                  organizationId: newOrg.id,
                  email: user.email || '',
                  name: userName,
                  role: 'admin',
                })

                // 온보딩 페이지로 리다이렉트 (조직 정보 설정 유도)
                return NextResponse.redirect(new URL('/dashboard/onboarding', requestUrl.origin))
              }
            }
          }
        }
      } catch (e) {
        console.error('OAuth 콜백 사용자 동기화 오류:', e)
      }

      return NextResponse.redirect(new URL(next, requestUrl.origin))
    }
  }

  // 에러 발생 - 로그인 페이지로 리다이렉트
  return NextResponse.redirect(
    new URL('/auth/signin?error=인증에 실패했습니다', requestUrl.origin)
  )
}
