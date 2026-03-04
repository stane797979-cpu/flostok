const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
  const orgId = '00000000-0000-0000-0000-000000000001';

  const accounts = [
    { authId: '3d43f372-33fb-4438-95e3-330db137d813', email: 'admin1@flowstok.com', name: '관리자1' },
    { authId: 'b3de34d8-9aa0-42df-83ae-02eb3a84292a', email: 'admin2@flowstok.com', name: '관리자2' },
    { authId: '9246d35a-30d4-4b3d-8739-a3cf356f830a', email: 'admin3@flowstok.com', name: '관리자3' },
  ];

  for (const acc of accounts) {
    // 이미 존재하는지 확인
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [acc.email]);
    if (existing.rows.length > 0) {
      // auth_id 업데이트
      await pool.query('UPDATE users SET auth_id = $1 WHERE email = $2', [acc.authId, acc.email]);
      console.log('Updated auth_id for:', acc.email);
      continue;
    }
    const result = await pool.query(
      `INSERT INTO users (auth_id, email, name, organization_id, role, is_superadmin)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email`,
      [acc.authId, acc.email, acc.name, orgId, 'admin', false]
    );
    console.log('Added:', result.rows[0].email, '| id:', result.rows[0].id);
  }

  // 확인
  const all = await pool.query('SELECT email, auth_id, role FROM users ORDER BY email');
  console.log('\n=== All users ===');
  all.rows.forEach(r => console.log(r.email, '| role:', r.role, '| auth_id:', r.auth_id ? 'OK' : 'NULL'));

  pool.end();
})().catch(e => { console.error(e.message); pool.end(); });
