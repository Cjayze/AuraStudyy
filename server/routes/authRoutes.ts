import { Router, Response } from 'express';
import { getDb, saveDb, User } from '../db';
import { generateToken, hashPassword, comparePassword, authenticateToken, AuthRequest } from '../auth';
import { findUserByEmail, createUserInSupabase, getOrCreateUser } from '../../src/db/users.ts';
import { createPool } from '../../src/db/index.ts';

export const authRouter = Router();

// POST /api/auth/supabase-login
// Verify the Supabase Auth access token server-side, then issue AuraStudy's API JWT.
authRouter.post('/supabase-login', async (req, res) => {
  try {
    const { accessToken } = req.body;
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
    if (!accessToken || !supabaseUrl || !supabaseAnonKey) {
      return res.status(400).json({ status: 'error', message: 'Missing access token or Supabase URL/public key configuration.' });
    }

    const authResponse = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/user`, {
      headers: { apikey: supabaseAnonKey, Authorization: `Bearer ${accessToken}` }
    });
    if (!authResponse.ok) {
      return res.status(401).json({ status: 'error', message: 'Supabase session is invalid or expired.' });
    }
    const authUser = await authResponse.json() as { id: string; email?: string; user_metadata?: Record<string, unknown> };
    const email = (authUser.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ status: 'error', message: 'Google account did not provide an email address.' });
    const fullName = String(authUser.user_metadata?.full_name || authUser.user_metadata?.name || email.split('@')[0]);
    const avatarUrl = String(authUser.user_metadata?.avatar_url || authUser.user_metadata?.picture || '');

    try {
      await getOrCreateUser(authUser.id, email, fullName, avatarUrl);
    } catch (syncErr) {
      console.warn('Supabase user profile sync warning:', syncErr);
    }

    const db = getDb();
    let user = db.users.find(u => u.id === authUser.id || u.email.toLowerCase() === email);
    if (!user) {
      user = {
        id: authUser.id, email, password_hash: '', full_name: fullName,
        role: 'student', avatar_url: avatarUrl, is_active: true,
        created_at: new Date().toISOString()
      };
      db.users.push(user);
      db.learning_progress.push({
        id: `prog_${user.id}`, user_id: user.id, total_documents: 0,
        total_questions_asked: 0, total_quizzes_completed: 0,
        average_score: 0, last_active_at: new Date().toISOString()
      });
      saveDb();
    }

    const token = generateToken(user);
    return res.status(200).json({
      status: 'success',
      data: {
        user: { id: user.id, email: user.email, name: user.full_name, full_name: user.full_name,
          role: user.role, school: user.school || '', avatar_url: user.avatar_url },
        access_token: token, token_type: 'Bearer'
      }
    });
  } catch (error) {
    console.error('Supabase Google login error:', error);
    return res.status(500).json({ status: 'error', message: 'Supabase Google sign-in failed.' });
  }
});

// POST /api/auth/register
authRouter.post('/register', async (req, res) => {
  try {
    const email = req.body.email ? String(req.body.email).trim().toLowerCase() : '';
    const password = req.body.password ? String(req.body.password) : '';
    const fullName = (req.body.full_name || req.body.name || '').trim();
    const school = (req.body.school || req.body.university || '').trim();

    if (!email || !password || !fullName) {
      return res.status(400).json({
        status: 'error',
        message: 'Vui lòng cung cấp đầy đủ email, mật khẩu và họ tên.'
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        status: 'error',
        message: 'Địa chỉ email không đúng định dạng hợp lệ.'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        status: 'error',
        message: 'Mật khẩu phải có độ dài tối thiểu từ 6 ký tự.'
      });
    }

    // 1. Check if user already exists directly in Supabase
    try {
      const existingInSupabase = await findUserByEmail(email);
      if (existingInSupabase) {
        return res.status(409).json({
          status: 'error',
          message: 'Email này đã được đăng ký trên cơ sở dữ liệu Supabase. Vui lòng đăng nhập hoặc sử dụng email khác.'
        });
      }
    } catch (checkErr) {
      console.warn('Supabase email pre-check error (continuing):', checkErr);
    }

    // 2. Check local DB cache
    const db = getDb();
    const existingLocal = db.users.find(u => u.email.toLowerCase() === email);
    if (existingLocal) {
      return res.status(409).json({
        status: 'error',
        message: 'Email này đã tồn tại trên hệ thống. Vui lòng đăng nhập.'
      });
    }

    const newUserId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const hashedPassword = hashPassword(password);

    // 3. Directly store in Supabase
    let supabaseUser = null;
    try {
      supabaseUser = await createUserInSupabase({
        id: newUserId,
        email,
        passwordHash: hashedPassword,
        fullName,
        school: school || undefined,
        role: 'student'
      });
      console.log(`[Supabase] Created user ${email} successfully with ID: ${newUserId}`);
    } catch (supErr: any) {
      console.error('Error writing user directly to Supabase:', supErr);
      // If error is duplicate key in Supabase
      if (supErr.message && supErr.message.includes('unique')) {
        return res.status(409).json({
          status: 'error',
          message: 'Tài khoản email này đã tồn tại trên cơ sở dữ liệu Supabase.'
        });
      }
      throw supErr;
    }

    // 4. Mirror in memory/local database for session and document association
    const newUser: User = {
      id: newUserId,
      email,
      password_hash: hashedPassword,
      full_name: fullName,
      school: school || undefined,
      role: 'student',
      is_active: true,
      created_at: new Date().toISOString()
    };

    db.users.push(newUser);

    // Initialize learning progress in local DB
    db.learning_progress.push({
      id: `prog_${newUser.id}`,
      user_id: newUser.id,
      total_documents: 0,
      total_questions_asked: 0,
      total_quizzes_completed: 0,
      average_score: 0,
      last_active_at: new Date().toISOString()
    });

    saveDb();

    const token = generateToken(newUser);

    return res.status(201).json({
      status: 'success',
      message: 'Đăng ký tài khoản và lưu thành công vào cơ sở dữ liệu Supabase!',
      data: {
        user: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.full_name,
          full_name: newUser.full_name,
          role: newUser.role,
          school: newUser.school || ''
        },
        access_token: token,
        token_type: 'Bearer'
      }
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Đã xảy ra lỗi trong quá trình lưu tài khoản vào cơ sở dữ liệu Supabase.',
      error: error?.message
    });
  }
});

// POST /api/auth/login
authRouter.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'Vui lòng nhập đầy đủ email và mật khẩu.'
      });
    }

    const trimmedEmail = String(email).trim().toLowerCase();
    const db = getDb();

    // 1. Direct query to Supabase database
    let supabaseUser = null;
    try {
      supabaseUser = await findUserByEmail(trimmedEmail);
    } catch (dbErr) {
      console.error('Supabase query failed during login:', dbErr);
      return res.status(503).json({
        status: 'error',
        message: 'Không thể kết nối cơ sở dữ liệu. Vui lòng kiểm tra cấu hình Supabase hoặc kết nối mạng rồi thử lại.'
      });
    }

    let authenticatedUser: User | null = null;

    if (supabaseUser) {
      let passwordMatches = false;

      if (supabaseUser.passwordHash) {
        passwordMatches = comparePassword(password, supabaseUser.passwordHash);
      } else {
        // Fallback: check local db for existing password hash and backfill to Supabase
        const localMatch = db.users.find(u => u.email.toLowerCase() === trimmedEmail);
        if (localMatch && comparePassword(password, localMatch.password_hash)) {
          passwordMatches = true;
          try {
            const pool = createPool();
            await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [localMatch.password_hash, supabaseUser.id]);
          } catch (updateErr) {
            console.warn('Backfill password to Supabase error:', updateErr);
          }
        }
      }

      if (!passwordMatches) {
        return res.status(401).json({
          status: 'error',
          message: 'Email hoặc mật khẩu không chính xác.'
        });
      }

      if (supabaseUser.isActive === false) {
        return res.status(403).json({
          status: 'error',
          message: 'Tài khoản của bạn đang bị tạm khóa. Vui lòng liên hệ Admin.'
        });
      }

      // Ensure user is present in local cache
      let localUser = db.users.find(u => u.id === supabaseUser!.id || u.email.toLowerCase() === trimmedEmail);
      if (!localUser) {
        localUser = {
          id: supabaseUser.id,
          email: supabaseUser.email,
          password_hash: supabaseUser.passwordHash || '',
          full_name: supabaseUser.fullName || supabaseUser.email.split('@')[0],
          school: supabaseUser.school || undefined,
          role: (supabaseUser.role as any) || 'student',
          avatar_url: supabaseUser.avatarUrl || '',
          is_active: supabaseUser.isActive ?? true,
          created_at: supabaseUser.createdAt ? new Date(supabaseUser.createdAt).toISOString() : new Date().toISOString()
        };
        db.users.push(localUser);
        saveDb();
      }

      authenticatedUser = localUser;
    } else {
      // If user not in Supabase yet, check local DB
      const localUser = db.users.find(u => u.email.toLowerCase() === trimmedEmail);
      if (localUser && comparePassword(password, localUser.password_hash)) {
        if (!localUser.is_active) {
          return res.status(403).json({
            status: 'error',
            message: 'Tài khoản của bạn đang bị tạm khóa. Vui lòng liên hệ Admin.'
          });
        }

        // Immediately sync to Supabase!
        try {
          await createUserInSupabase({
            id: localUser.id,
            email: localUser.email,
            passwordHash: localUser.password_hash,
            fullName: localUser.full_name,
            school: localUser.school || '',
            role: localUser.role,
            avatarUrl: localUser.avatar_url
          });
          console.log(`[Supabase] Synced existing local user ${localUser.email} to Supabase on login.`);
        } catch (syncErr) {
          console.warn('Sync local user to Supabase on login error:', syncErr);
        }

        authenticatedUser = localUser;
      }
    }

    if (!authenticatedUser) {
      return res.status(401).json({
        status: 'error',
        message: 'Email hoặc mật khẩu không chính xác.'
      });
    }

    const token = generateToken(authenticatedUser);

    return res.status(200).json({
      status: 'success',
      message: 'Đăng nhập thành công với cơ sở dữ liệu Supabase!',
      data: {
        user: {
          id: authenticatedUser.id,
          email: authenticatedUser.email,
          name: authenticatedUser.full_name,
          full_name: authenticatedUser.full_name,
          role: authenticatedUser.role,
          school: authenticatedUser.school || '',
          avatar_url: authenticatedUser.avatar_url
        },
        access_token: token,
        token_type: 'Bearer'
      }
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Lỗi máy chủ khi đăng nhập.',
      error: error?.message
    });
  }
});

// GET /api/auth/me (Current authenticated user profile)
authRouter.get('/me', authenticateToken, (req: AuthRequest, res: Response) => {
  const user = req.user!;
  return res.status(200).json({
    status: 'success',
    data: {
      id: user.id,
      email: user.email,
      name: user.full_name,
      full_name: user.full_name,
      role: user.role,
      school: user.school || '',
      avatar_url: user.avatar_url,
      created_at: user.created_at
    }
  });
});

// POST /api/auth/logout
authRouter.post('/logout', (req, res) => {
  return res.status(200).json({
    status: 'success',
    message: 'Đăng xuất tài khoản thành công.'
  });
});
