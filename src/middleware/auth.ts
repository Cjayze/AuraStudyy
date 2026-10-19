import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  user?: Record<string, unknown>;
}

export const requireAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }
  try {
    req.user = jwt.verify(header.slice(7), process.env.JWT_SECRET || 'aurastudy-super-secret-jwt-key-2026') as Record<string, unknown>;
    return next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }
};
