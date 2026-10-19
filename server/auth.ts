import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { getDb, User } from './db';
import { findUserById } from '../src/db/users.ts';

const JWT_SECRET = process.env.JWT_SECRET || 'aurastudy-super-secret-jwt-key-2026';
const JWT_EXPIRES_IN = '7d';

export interface AuthRequest extends Request {
  user?: User;
}

export function generateToken(user: User): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

export function hashPassword(password: string): string {
  const salt = bcrypt.genSaltSync(10);
  return bcrypt.hashSync(password, salt);
}

export function comparePassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

export async function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      status: 'error',
      message: 'Yêu cầu Bearer Token xác thực để truy cập API.'
    });
  }

  // 1. First try custom JWT
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string };
    const db = getDb();
    let user = db.users.find(u => u.id === decoded.id && u.is_active);

    if (!user) {
      // Lookup user in Supabase in case server memory was reset
      try {
        const sbUser = await findUserById(decoded.id);
        if (sbUser && (sbUser.isActive ?? true)) {
          user = {
            id: sbUser.id,
            email: sbUser.email,
            password_hash: sbUser.passwordHash || '',
            full_name: sbUser.fullName || sbUser.email,
            role: (sbUser.role === 'admin' ? 'admin' : 'student') as 'student' | 'admin',
            avatar_url: sbUser.avatarUrl || '',
            school: sbUser.school || '',
            is_active: true,
            created_at: sbUser.createdAt ? new Date(sbUser.createdAt).toISOString() : new Date().toISOString()
          };
          db.users.push(user);
        }
      } catch (sbErr) {
        console.warn('Supabase auth fallback warning:', sbErr);
      }
    }

    if (user) {
      req.user = user;
      return next();
    }
  } catch {
  }

  return res.status(403).json({ status: 'error', message: 'Token kh?ng h?p l? ho?c ?? h?t h?n.' });
}

export function requireRole(role: 'student' | 'admin') {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({
        status: 'error',
        message: `Truy cập bị từ chối. Chỉ tài khoản ${role.toUpperCase()} mới có quyền thực hiện.`
      });
    }
    next();
  };
}
