import { describe, expect, it, vi } from 'vitest';
import jwt from 'jsonwebtoken';
import env from './config.js';
import { auth } from './auth.js';

describe('autenticação administrativa', () => {
  it('aceita o token JWT no cabeçalho Authorization', () => {
    const token = jwt.sign({ id: 'admin-id', email: 'admin@example.com' }, env.JWT_SECRET, {
      expiresIn: '8h',
    });
    const req: any = {
      headers: {
        authorization: `Bearer ${token}`,
      },
    };
    const res: any = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    const next = vi.fn();

    auth(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.admin).toMatchObject({ id: 'admin-id', email: 'admin@example.com' });
    expect(res.status).not.toHaveBeenCalled();
  });

  it('recusa solicitações sem token', () => {
    const req: any = { headers: {} };
    const res: any = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    const next = vi.fn();

    auth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Autenticação necessária.' });
    expect(next).not.toHaveBeenCalled();
  });
});
