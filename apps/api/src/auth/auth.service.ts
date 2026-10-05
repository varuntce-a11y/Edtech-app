import { BadRequestException, ConflictException, HttpException, HttpStatus, Injectable, NotFoundException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { createHmac, randomBytes, randomInt } from 'node:crypto';
import { PrismaService } from '../prisma.service';

type AuthMode = 'login' | 'register';
type OtpRequest = { email?: string; phone?: string; mode?: AuthMode };
type OtpRecord = { hash: string; expiresAt: number; attempts: number; sentAt: number; mode: AuthMode };
type VerifyRequest = OtpRequest & {
  code: string;
  name?: string;
  preferredLanguage?: string;
  targetRole?: string;
  educationLevel?: string;
  experienceYears?: number;
  consent?: boolean;
};
type ProfileUpdate = {
  name?: string;
  educationLevel?: string | null;
  experienceYears?: number | null;
  targetRole?: string | null;
  preferredLanguage?: string;
  city?: string | null;
};

@Injectable()
export class AuthService {
  private readonly records = new Map<string, OtpRecord>();
  private readonly secret = process.env.OTP_HASH_SECRET;

  constructor(private readonly prisma: PrismaService) {}

  async requestOtp(input: OtpRequest) {
    const identity = this.identity(input);
    const mode = input.mode ?? 'login';
    const existingUser = await this.findUser(input);
    if (mode === 'register' && existingUser) throw new ConflictException('An account already exists. Choose sign in instead.');
    if (mode === 'login' && !existingUser) throw new NotFoundException('No account was found. Choose register to create one.');
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
      mode,
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
    if (!this.secret || this.hash(identity, input.code) !== record.hash || record.mode !== (input.mode ?? 'login')) {
      throw new UnauthorizedException('The code is invalid or expired');
    }
    this.records.delete(identity);
    if (!process.env.JWT_REFRESH_SECRET) throw new ServiceUnavailableException('Refresh token signing is not configured');
    const existingUser = await this.findUser(input);
    if (record.mode === 'register') {
      if (existingUser) throw new ConflictException('An account already exists. Choose sign in instead.');
      if (!input.name?.trim()) throw new BadRequestException('Your name is required to register');
      if (!input.consent) throw new UnauthorizedException('Consent is required to create an account');
    } else if (!existingUser) {
      throw new NotFoundException('No account was found. Choose register to create one.');
    }

    const user = record.mode === 'register'
      ? await this.prisma.user.create({
        data: {
          email: input.email?.trim().toLowerCase(),
          phone: input.phone?.trim(),
          name: input.name!.trim(),
          profile: {
            create: {
              preferredLanguage: input.preferredLanguage ?? 'en',
              targetRole: input.targetRole,
              educationLevel: input.educationLevel,
              experienceYears: input.experienceYears,
            },
          },
        },
        include: { profile: true },
      })
      : existingUser!;
    if (record.mode === 'register') {
      await this.prisma.consent.create({ data: { userId: user.id, purpose: 'DPDP_ACT_LEARNING_SERVICES', granted: true } });
    }
    return { user, ...await this.issueTokens(user.id) };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { profile: true } });
    if (!user) throw new NotFoundException('Account not found');
    return user;
  }

  async updateProfile(userId: string, input: ProfileUpdate) {
    const profileData = {
      ...(input.educationLevel !== undefined ? { educationLevel: input.educationLevel } : {}),
      ...(input.experienceYears !== undefined ? { experienceYears: input.experienceYears } : {}),
      ...(input.targetRole !== undefined ? { targetRole: input.targetRole } : {}),
      ...(input.preferredLanguage !== undefined ? { preferredLanguage: input.preferredLanguage } : {}),
      ...(input.city !== undefined ? { city: input.city } : {}),
    };
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        profile: {
          upsert: {
            create: { preferredLanguage: 'en', ...profileData },
            update: profileData,
          },
        },
      },
      include: { profile: true },
    });
  }

  private async findUser(input: OtpRequest) {
    return input.email
      ? this.prisma.user.findUnique({ where: { email: input.email.trim().toLowerCase() } })
      : this.prisma.user.findUnique({ where: { phone: input.phone?.trim() } });
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
