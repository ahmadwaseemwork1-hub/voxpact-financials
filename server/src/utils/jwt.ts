import jwt, { type SignOptions } from 'jsonwebtoken';
import type { Role } from '../generated/prisma/client';
import { env } from '../config/env';

export interface JwtPayload {
  sub: string;
  username: string;
  role: Role;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  } as SignOptions);
}

export function verifyToken(token: string): JwtPayload & { iat: number; exp: number } {
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload & { iat: number; exp: number };
}
