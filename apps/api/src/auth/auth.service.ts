import { HttpException, HttpStatus, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { createHmac, randomBytes, randomInt } from 'node:crypto';
import { PrismaService } from '../prisma.service';

type OtpRequest = { email?: string; phone?: string };
type OtpRecord = { hash: string; expiresAt: number; attempts: number; sentAt: number };
type VerifyRequest = OtpRequest & {
  code: string;
  name?: string;
  preferredLanguage?: string;
  targetRole?: string;
  educationLevel?: string;
  experienceYears?: number;
  consent: boolean;
};

@Injectable()
export class AuthService {
  private readonly records = new Map<string, OtpRecord>();
  private readonly secret = process.env.OTP_HASH_SECRET;

  constructor(private readonly prisma: PrismaService) {}

  async requestOtp(input: OtpRequest) {
    const identity = this.identity(input);
    const now = Date.now();
    const previous = this.records.get(identity);
    if (previous && now - previous.sentAt < 60_000) {
      throw new HttpException('Please wait before requesting another code', HttpStatus.TOO_MANY_REQUESTS);
    }
    if (process.env.NODE_ENV === 'production' && (!process.env.OTP_DELIVERY_URL || !process.env.OTP_DELIVERY_SECRET)) {
      throw new ServiceUnavailableException('OTP delivery is not configured');
    }
    if (!this.secret) throw new ServiceUnavailableException('OTP hashing secret is not configured');

    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    this.records.set(identity, {
      hash: this.hash(identity, code),
      expiresAt: now + 5 * 60_000,
      attempts: 0,
      sentAt: now,
    });
    if (process.env.NODE_ENV === 'production') {
      const response = await fetch(process.env.OTP_DELIVERY_URL!, {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.OTP_DELIVERY_SECRET}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: identity, code, expiresInSeconds: 300 }),
      });
      if (!response.ok) {
        this.records.delete(identity);
        throw new ServiceUnavailableException('OTP delivery provider failed to send the code');
      }
      return { message: 'Verification code sent' };
    }
    return { message: 'Development OTP created', ...(process.env.NODE_ENV === 'test' ? {} : { developmentCode: code }) };
  }

  async verifyOtp(input: VerifyRequest) {
    const identity = this.identity(input);
    const record = this.records.get(identity);
    if (!record || record.expiresAt < Date.now() || record.attempts >= 5) {
      this.records.delete(identity);
      throw new UnauthorizedException('The code is invalid or expired');
    }
    record.attempts += 1;
    if (!this.secret || this.hash(identity, input.code) !== record.hash) {
      throw new UnauthorizedException('The code is invalid or expired');
    }
    this.records.delete(identity);
    if (!input.consent) throw new UnauthorizedException('Consent is required to create an account');
    if (!process.env.JWT_REFRESH_SECRET) throw new ServiceUnavailableException('Refresh token signing is not configured');
    const user = await this.prisma.user.upsert({
      where: input.email ? { email: input.email.toLowerCase() } : { phone: input.phone },
      create: {
        email: input.email?.toLowerCase(),
        phone: input.phone,
        name: input.name ?? input.email?.split('@')[0] ?? 'Learner',
        profile: {
          create: {
            preferredLanguage: input.preferredLanguage ?? 'en',
            targetRole: input.targetRole,
            educationLevel: input.educationLevel,
            experienceYears: input.experienceYears,
          },
        },
      },
      update: {
        ...(input.name ? { name: input.name } : {}),
        profile: {
          upsert: {
            create: {
              preferredLanguage: input.preferredLanguage ?? 'en',
              targetRole: input.targetRole,
              educationLevel: input.educationLevel,
              experienceYears: input.experienceYears,
            },
            update: {
              ...(input.preferredLanguage ? { preferredLanguage: input.preferredLanguage } : {}),
              ...(input.targetRole ? { targetRole: input.targetRole } : {}),
              ...(input.educationLevel ? { educationLevel: input.educationLevel } : {}),
              ...(input.experienceYears !== undefined ? { experienceYears: input.experienceYears } : {}),
            },
          },
        },
      },
      include: { profile: true },
    });
    await this.prisma.consent.create({ data: { userId: user.id, purpose: 'DPDP_ACT_LEARNING_SERVICES', granted: true } });
    return { user, ...await this.issueTokens(user.id) };
  }

  async refresh(token: string) {
    const tokenHash = this.hashRefreshToken(token);
    const record = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!record || record.revokedAt || record.expiresAt <= new Date()) throw new UnauthorizedException('Refresh token is invalid or expired');
    const refreshToken = randomBytes(48).toString('base64url');
    await this.prisma.$transaction(async (tx) => {
      const revoked = await tx.refreshToken.updateMany({
        where: { id: record.id, revokedAt: null, expiresAt: { gt: new Date() } },
        data: { revokedAt: new Date() },
      });
      if (revoked.count !== 1) throw new UnauthorizedException('Refresh token is invalid or expired');
      await tx.refreshToken.create({
        data: {
          userId: record.userId,
          tokenHash: this.hashRefreshToken(refreshToken),
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60_000),
        },
      });
    });
    return { accessToken: this.signToken(record.userId), refreshToken, accessTokenExpiresIn: 900 };
  }

  async logout(token: string) {
    const tokenHash = this.hashRefreshToken(token);
    await this.prisma.refreshToken.updateMany({ where: { tokenHash, revokedAt: null }, data: { revokedAt: new Date() } });
    return { message: 'Session revoked' };
  }

  private identity(input: OtpRequest) {
    const identity = input.email?.trim().toLowerCase() ?? input.phone?.trim();
    if (!identity) throw new UnauthorizedException('Provide a valid email address or phone number');
    if (Boolean(input.email) === Boolean(input.phone)) {
      throw new UnauthorizedException('Provide exactly one email address or phone number');
    }
    return identity;
  }

  private hash(identity: string, code: string) {
    return createHmac('sha256', this.secret ?? '').update(`${identity}:${code}`).digest('hex');
  }

  private signToken(subject: string) {
    if (!process.env.JWT_ACCESS_SECRET) throw new ServiceUnavailableException('Authentication token signing is not configured');
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ sub: subject, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 900 })).toString('base64url');
    const signature = createHmac('sha256', process.env.JWT_ACCESS_SECRET ?? '').update(`${header}.${payload}`).digest('base64url');
    return `${header}.${payload}.${signature}`;
  }

  private hashRefreshToken(token: string) {
    if (!process.env.JWT_REFRESH_SECRET) throw new ServiceUnavailableException('Refresh token signing is not configured');
    return createHmac('sha256', process.env.JWT_REFRESH_SECRET).update(token).digest('hex');
  }

  private async issueTokens(userId: string) {
    const refreshToken = randomBytes(48).toString('base64url');
    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hashRefreshToken(refreshToken),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60_000),
      },
    });
    return { accessToken: this.signToken(userId), refreshToken, accessTokenExpiresIn: 900 };
  }
}
