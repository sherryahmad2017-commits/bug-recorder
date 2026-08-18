import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import type { AppEnv } from '../config/env.validation';
import { AppException } from '../common/exceptions/app.exception';
import { RefreshTokenService } from './refresh-token.service';
import type { SignupDto } from './dto/signup.dto';
import type { LoginDto } from './dto/login.dto';

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; fullName: string; locale: string };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<AppEnv, true>,
    private readonly refreshTokens: RefreshTokenService,
  ) {}

  async signup(dto: SignupDto): Promise<AuthResult> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (existing) {
      throw AppException.conflict('An account with this email already exists.');
    }

    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });
    const slug = await this.uniqueSlug(dto.organisationName);

    const { user } = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email: dto.email.toLowerCase(),
          passwordHash,
          fullName: dto.fullName,
        },
      });

      const organisation = await tx.organisation.create({
        data: {
          name: dto.organisationName,
          slug,
          ownerId: createdUser.id,
        },
      });

      await tx.organisationMember.create({
        data: {
          organisationId: organisation.id,
          userId: createdUser.id,
          role: 'owner',
          invitedById: createdUser.id,
          joinedAt: new Date(),
        },
      });

      return { user: createdUser, organisation };
    });

    return this.issueSession(user.id, user.email, user.fullName, user.locale);
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (!user || !user.passwordHash || !user.isActive) {
      throw AppException.invalidCredentials();
    }

    const valid = await argon2.verify(user.passwordHash, dto.password);
    if (!valid) {
      throw AppException.invalidCredentials();
    }

    return this.issueSession(user.id, user.email, user.fullName, user.locale);
  }

  async refresh(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    const { userId, token } = await this.refreshTokens.rotate(refreshToken);
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) {
      throw AppException.unauthenticated();
    }
    return { accessToken: this.signAccessToken(user.id, user.email), refreshToken: token };
  }

  async logout(refreshToken: string): Promise<void> {
    await this.refreshTokens.revoke(refreshToken);
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        avatarUrl: true,
        locale: true,
        memberships: {
          select: {
            role: true,
            organisation: { select: { id: true, name: true, slug: true, plan: true } },
          },
        },
      },
    });
    if (!user) throw AppException.unauthenticated();
    return user;
  }

  private async issueSession(userId: string, email: string, fullName: string, locale: string): Promise<AuthResult> {
    const [accessToken, refreshToken] = await Promise.all([
      Promise.resolve(this.signAccessToken(userId, email)),
      this.refreshTokens.issue(userId),
    ]);
    return { accessToken, refreshToken, user: { id: userId, email, fullName, locale } };
  }

  private signAccessToken(userId: string, email: string): string {
    return this.jwt.sign(
      { sub: userId, email },
      {
        secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
        expiresIn: this.config.get('JWT_ACCESS_TTL', { infer: true }),
      },
    );
  }

  private async uniqueSlug(name: string): Promise<string> {
    const base = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 60) || 'organisation';

    let candidate = base;
    // A handful of attempts is enough in practice; fall back to a random
    // suffix rather than looping indefinitely against a pathological input.
    for (let attempt = 0; attempt < 5; attempt++) {
      const existing = await this.prisma.organisation.findUnique({ where: { slug: candidate } });
      if (!existing) return candidate;
      candidate = `${base}-${randomBytes(3).toString('hex')}`;
    }
    return `${base}-${randomBytes(6).toString('hex')}`;
  }
}
