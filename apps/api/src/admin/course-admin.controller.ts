import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DeliveryMode } from '@prisma/client';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { AccessTokenGuard, AuthenticatedRequest } from '../auth/access-token.guard';
import { CourseAdminService } from './course-admin.service';

class CreateCourseDto {
  @IsString() @MinLength(4) @MaxLength(120) title!: string;
  @IsString() @MinLength(8) @MaxLength(180) subtitle!: string;
  @IsString() @MinLength(30) @MaxLength(5000) description!: string;
  @IsString() @MinLength(2) @MaxLength(80) topic!: string;
  @IsString() @MinLength(2) language!: string;
  @IsEnum(DeliveryMode) mode!: DeliveryMode;
  @IsInt() @Min(100) @Max(500_000) priceRupees!: number;
  @IsOptional() @IsString() instructorId?: string;
  @IsOptional() @IsBoolean() published?: boolean;
}

class PublishCourseDto {
  @IsBoolean() published!: boolean;
}

@ApiTags('course administration')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller('admin/courses')
export class CourseAdminController {
  constructor(private readonly admin: CourseAdminService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest) {
    return this.admin.list(request.userId);
  }

  @Get('instructors')
  instructors(@Req() request: AuthenticatedRequest) {
    return this.admin.instructors(request.userId);
  }

  @Post()
  create(@Req() request: AuthenticatedRequest, @Body() body: CreateCourseDto) {
    return this.admin.create(request.userId, body);
  }

  @Patch(':id/publish')
  publish(@Req() request: AuthenticatedRequest, @Param('id') id: string, @Body() body: PublishCourseDto) {
    return this.admin.publish(request.userId, id, body.published);
  }
}
