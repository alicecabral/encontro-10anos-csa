import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import env from './config.js';

export type AdminJwtPayload = {
  id: string;
  email: string;
};

declare global {
  namespace Express {
    interface Request {
      admin?: AdminJwtPayload;
    }
  }
}

export const auth = (req: Request, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;

  if (!token) {
    res.status(401).json({ message: 'Autenticação necessária.' });
    return;
  }

  try {
    req.admin = jwt.verify(token, env.JWT_SECRET) as AdminJwtPayload;
    next();
  } catch {
    res.status(401).json({ message: 'Autenticação necessária.' });
  }
};
