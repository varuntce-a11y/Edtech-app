import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsEmail, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { AuthService } from './auth.service';

class RequestOtpDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @Matches(/^\+?[1-9]\d{7,14}$/)
  phone?: string;
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

  @IsBoolean()
  consent!: boolean;

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
