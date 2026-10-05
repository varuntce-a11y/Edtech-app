import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { Request } from 'express';

export type AuthenticatedRequest = Request & { userId: string };

@Injectable()
export class AccessTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = request.headers.authorization?.match(/^Bearer ([\w.-]+)$/)?.[1];
    const secret = process.env.JWT_ACCESS_SECRET;
    if (!token || !secret) throw new UnauthorizedException('A valid access token is required');
    const [header, payload, signature, extra] = token.split('.');
    if (!header || !payload || !signature || extra) throw new UnauthorizedException('A valid access token is required');
    const expected = createHmac('sha256', secret).update(`${header}.${payload}`).digest();
    let actual: Buffer;
    try {
      actual = Buffer.from(signature, 'base64url');
    } catch {
      throw new UnauthorizedException('A valid access token is required');
    }
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      throw new UnauthorizedException('A valid access token is required');
    }
    let claims: { sub?: unknown; exp?: unknown };
    try {
      claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as typeof claims;
    } catch {
      throw new UnauthorizedException('A valid access token is required');
    }
    if (typeof claims.sub !== 'string' || typeof claims.exp !== 'number' || claims.exp <= Date.now() / 1000) {
      throw new UnauthorizedException('A valid access token is required');
    }
    request.userId = claims.sub;
    return true;
  }
}
