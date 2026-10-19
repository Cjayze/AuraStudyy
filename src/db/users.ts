import { db, createPool } from './index.ts';
import { users, learningProgress } from './schema.ts';
import { eq, sql } from 'drizzle-orm';

export interface SupabaseUserData {
  id: string;
  email: string;
  passwordHash?: string;
  fullName?: string;
  school?: string;
  role?: string;
  avatarUrl?: string;
  isActive?: boolean;
}

/**
 * Finds user in Supabase by email (case-insensitive)
 */
export async function findUserByEmail(email: string) {
  try {
    const trimmedEmail = email.trim().toLowerCase();
    const rows = await db
      .select()
      .from(users)
      .where(sql`LOWER(${users.email}) = ${trimmedEmail}`)
      .limit(1);

    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    console.error('Error finding user by email in Supabase:', error);
    // Preserve the DB error so callers do not mistake an outage for a missing user.
    throw error;
  }
}

/**
 * Finds user in Supabase by ID
 */
export async function findUserById(id: string) {
  try {
    const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    console.error('Error finding user by ID in Supabase:', error);
    return null;
  }
}

/**
 * Creates and stores a new user directly in Supabase PostgreSQL
 */
export async function createUserInSupabase(data: SupabaseUserData) {
  try {
    const pool = createPool();
    const now = new Date().toISOString();
    const userId = data.id || `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const email = data.email.trim().toLowerCase();
    const fullName = data.fullName || email.split('@')[0];
    const role = data.role || 'student';
    const school = data.school || '';
    const avatarUrl = data.avatarUrl || '';
    const passwordHash = data.passwordHash || '';

    // Insert user into Supabase
    const userRes = await pool.query(
      `INSERT INTO users (id, uid, email, password_hash, full_name, school, role, avatar_url, is_active, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (id) DO UPDATE SET
         email = EXCLUDED.email,
         password_hash = COALESCE(EXCLUDED.password_hash, users.password_hash),
         full_name = EXCLUDED.full_name,
         school = EXCLUDED.school
       RETURNING *;`,
      [userId, userId, email, passwordHash, fullName, school, role, avatarUrl, true, now]
    );

    // Initialize learning progress in Supabase
    try {
      await pool.query(
        `INSERT INTO learning_progress (id, user_id, total_documents, total_questions_asked, total_quizzes_completed, average_score, last_active_at)
         VALUES ($1, $2, 0, 0, 0, 0, $3)
         ON CONFLICT (user_id) DO NOTHING;`,
        [`prog_${userId}`, userId, now]
      );
    } catch (progErr) {
      console.warn('Note: learning_progress init in Supabase warning:', progErr);
    }

    const row = userRes.rows[0];
    return {
      id: row.id,
      uid: row.uid || row.id,
      email: row.email,
      passwordHash: row.password_hash,
      fullName: row.full_name,
      school: row.school,
      role: row.role,
      avatarUrl: row.avatar_url,
      isActive: row.is_active,
      createdAt: row.created_at
    };
  } catch (error) {
    console.error('Error creating user in Supabase:', error);
    throw new Error('Không thể lưu thông tin tài khoản vào cơ sở dữ liệu Supabase: ' + (error as any)?.message);
  }
}

export async function getOrCreateUser(uid: string, email: string, fullName?: string, avatarUrl?: string) {
  try {
    const existing = await findUserByEmail(email);
    if (existing) {
      return existing;
    }

    return await createUserInSupabase({
      id: uid,
      email,
      fullName: fullName || email.split('@')[0],
      avatarUrl: avatarUrl || '',
      role: 'student'
    });
  } catch (error) {
    console.error('Error in getOrCreateUser:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}

export async function getUsers() {
  try {
    return await db.select().from(users);
  } catch (error) {
    console.error('Database query failed:', error);
    throw new Error('Database query failed. Please try again later.', { cause: error });
  }
}
