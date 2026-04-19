import { db } from '../src/server/db';
import { users } from '../src/server/db/schema';

async function checkUsers() {
  try {
    const allUsers = await db.select().from(users).limit(5);

    console.log('\n📊 데이터베이스 사용자 목록:');
    console.log('='.repeat(70));

    if (allUsers.length === 0) {
      console.log('❌ 등록된 사용자가 없습니다.\n');
      console.log('사용자를 생성하려면:');
      console.log('1. Supabase 대시보드 → Authentication → Users → Add User');
      console.log('2. 이메일/비밀번호 설정');
      console.log('3. DB에 조직 및 사용자 레코드 생성\n');
    } else {
      allUsers.forEach((user, index) => {
        console.log(`\n${index + 1}. ${user.email}`);
        console.log(`   ID: ${user.id}`);
        console.log(`   조직 ID: ${user.organizationId}`);
        console.log(`   역할: ${user.role}`);
        console.log(`   활성: ${user.isActive ? '✅' : '❌'}`);
      });
      console.log('\n');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ 오류:', error);
    process.exit(1);
  }
}

checkUsers();
