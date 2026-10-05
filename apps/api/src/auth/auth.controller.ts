import { Body, Controller, Get, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { AccessTokenGuard, AuthenticatedRequest } from './access-token.guard';
import { AuthService } from './auth.service';

class RequestOtpDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @Matches(/^\+?[1-9]\d{7,14}$/)
  phone?: string;

  @IsOptional()
  @IsIn(['login', 'register'])
  mode?: 'login' | 'register';
}

class VerifyOtpDto extends RequestOtpDto {
  @IsString()
  @Matches(/^\d{6}$/)
  code!: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  preferredLanguage?: string;

  @IsOptional()
  @IsBoolean()
  consent?: boolean;

  @IsOptional()
  @IsString()
  targetRole?: string;

  @IsOptional()
  @IsString()
  educationLevel?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(60)
  experienceYears?: number;
}

class RefreshDto {
  @IsString()
  @MinLength(40)
  refreshToken!: string;
}

class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  @Transform(({ value }) => value === '' ? null : value)
  @IsOptional()
  @IsString()
  @MaxLength(80)
  educationLevel?: string | null;

  @Transform(({ value }) => value === undefined ? undefined : value === '' || value === null ? null : Number(value))
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(60)
  experienceYears?: number | null;

  @Transform(({ value }) => value === '' ? null : value)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  targetRole?: string | null;

  @IsOptional()
  @IsIn(['en', 'hi', 'ta', 'te', 'kn', 'mr', 'bn'])
  preferredLanguage?: string;

  @Transform(({ value }) => value === '' ? null : value)
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string | null;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('otp/request')
  @ApiOperation({ summary: 'Request a short-lived email or phone OTP' })
  requestOtp(@Body() body: RequestOtpDto) {
    return this.auth.requestOtp(body);
  }

  @Post('otp/verify')
  @ApiOperation({ summary: 'Verify OTP and create or sign in a learner' })
  verifyOtp(@Body() body: VerifyOtpDto) {
    return this.auth.verifyOtp(body);
  }

  @Get('profile')
  @UseGuards(AccessTokenGuard)
  @ApiOperation({ summary: 'Get the authenticated user profile' })
  getProfile(@Req() request: AuthenticatedRequest) {
    return this.auth.getProfile(request.userId);
  }

  @Patch('profile')
  @UseGuards(AccessTokenGuard)
  @ApiOperation({ summary: 'Update the authenticated user profile' })
  updateProfile(@Req() request: AuthenticatedRequest, @Body() body: UpdateProfileDto) {
    return this.auth.updateProfile(request.userId, body);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Rotate an opaque refresh token and issue a short-lived access token' })
  refresh(@Body() body: RefreshDto) {
    return this.auth.refresh(body.refreshToken);
  }

  @Post('logout')
  @ApiOperation({ summary: 'Revoke an opaque refresh token' })
  logout(@Body() body: RefreshDto) {
    return this.auth.logout(body.refreshToken);
  }
}
