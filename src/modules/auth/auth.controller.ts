import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import * as express from 'express';
import { Cookies } from '../../common/decorators/cookies.decorator';
import type { AuthenticatedUser } from '../../common/decorators/currentUser.decorator';
import { CurrentUser } from '../../common/decorators/currentUser.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { ResponseMessage } from '../../common/decorators/responseMessage.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthService } from './auth.service';
import { ChangePasswordDto } from './dto/changePassword.dto';
import { CreateUserDto } from './dto/createUser.dto';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { TokenService } from './token.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly tokenService: TokenService,
  ) {}

  @Public()
  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 5, ttl: 900000 } })
  @ResponseMessage('User registered successfully')
  async signup(
    @Body() dto: SignupDto,
    @Res({ passthrough: true }) res: express.Response,
  ) {
    const { user, tokens } = await this.authService.signup(dto);
    res.cookie(
      'refreshToken',
      tokens.refreshToken,
      this.tokenService.getCookieOptions(),
    );
    return { user, accessToken: tokens.accessToken };
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 15, ttl: 900000 } })
  @ResponseMessage('User logged in successfully')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: express.Response,
  ) {
    const { user, tokens } = await this.authService.login(dto);
    res.cookie(
      'refreshToken',
      tokens.refreshToken,
      this.tokenService.getCookieOptions(),
    );
    return { user, accessToken: tokens.accessToken };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 900000 } })
  @ResponseMessage('Tokens refreshed successfully')
  async refresh(
    @Cookies('refreshToken') refreshToken: string | undefined,
    @Res({ passthrough: true }) res: express.Response,
  ) {
    if (!refreshToken) {
      throw new UnauthorizedException({
        message: 'Refresh token is missing',
        code: 'REFRESH_TOKEN_MISSING',
      });
    }
    const tokens = await this.authService.refreshTokens(refreshToken);
    res.cookie(
      'refreshToken',
      tokens.refreshToken,
      this.tokenService.getCookieOptions(),
    );
    return { accessToken: tokens.accessToken };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Cookies('refreshToken') refreshToken: string | undefined,
    @Res({ passthrough: true }) res: express.Response,
  ) {
    if (refreshToken) {
      await this.authService.logout(refreshToken);
    }
    res.clearCookie('refreshToken', { path: '/' });
    return { success: true, message: 'Logged out successfully' };
  }

  @Get('me')
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Profile retrieved successfully')
  async getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getMe(user.id);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 900000 } })
  @ResponseMessage('Password changed successfully')
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(user.id, dto);
  }

  @Post('create-user')
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage('User created successfully')
  async createUser(@Body() dto: CreateUserDto) {
    return this.authService.createUser(dto);
  }
}
