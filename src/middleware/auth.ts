import type { NextFunction, Request, Response } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { adminAuth } from '../lib/firebase-admin.ts';
import { getOrCreateUser } from '../db/users.ts';

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: Missing token' });
    return;
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;

    if (process.env.SQL_HOST && decodedToken.uid) {
      try {
        await getOrCreateUser(
          decodedToken.uid,
          decodedToken.email || `${decodedToken.uid}@annakshetra.app`,
          decodedToken.name || null
        );
      } catch (dbErr) {
        console.error('Non-fatal user sync warning in requireAuth:', dbErr);
      }
    }

    next();
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

export const optionalAuth = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split('Bearer ')[1];
    try {
      const decodedToken = await adminAuth.verifyIdToken(token);
      req.user = decodedToken;
      if (process.env.SQL_HOST && decodedToken.uid) {
        try {
          await getOrCreateUser(
            decodedToken.uid,
            decodedToken.email || `${decodedToken.uid}@annakshetra.app`,
            decodedToken.name || null
          );
        } catch (dbErr) {
          console.error('Non-fatal user sync warning in optionalAuth:', dbErr);
        }
      }
    } catch {
      // Proceed without authenticated Firebase user if token is invalid/expired
    }
  }
  next();
};
