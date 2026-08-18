import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RateLimit } from '../common/decorators/rate-limit.decorator';
import { RateLimitGuard } from '../common/guards/rate-limit.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from './jwt-payload.type';

@Controller()
@UseGuards(RateLimitGuard)
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('auth/signup')
  @RateLimit({ bucket: 'signup', limit: 10, windowSeconds: 60 })
  async signup(@Body() dto: SignupDto) {
    return this.auth.signup(dto);
  }

  @Post('auth/login')
  @HttpCode(HttpStatus.OK)
  @RateLimit({ bucket: 'login', limit: 10, windowSeconds: 60 })
  async login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Post('auth/refresh')
  @HttpCode(HttpStatus.OK)
  @RateLimit({ bucket: 'refresh', limit: 30, windowSeconds: 60 })
  async refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Post('auth/logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body() dto: RefreshDto): Promise<void> {
    await this.auth.logout(dto.refreshToken);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.me(user.id);
  }
}
