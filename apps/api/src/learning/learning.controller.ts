import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsInt, IsString, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { AccessTokenGuard, AuthenticatedRequest } from '../auth/access-token.guard';
import { LearningService } from './learning.service';

class ProgressDto {
  @IsInt() @Min(0) @Max(100) percentage!: number;
  @IsString() lessonId!: string;
}

class AssessmentAnswerDto {
  @IsString() questionId!: string;
  @IsInt() @Min(0) answerIndex!: number;
}

class AssessmentAttemptDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AssessmentAnswerDto)
  answers!: AssessmentAnswerDto[];
}

@ApiTags('learning')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller()
export class LearningController {
  constructor(private readonly learning: LearningService) {}

  @Get('my-courses')
  myCourses(@Req() request: AuthenticatedRequest) {
    return this.learning.myCourses(request.userId);
  }

  @Post('my-courses/:enrollmentId/progress')
  updateProgress(@Req() request: AuthenticatedRequest, @Param('enrollmentId') enrollmentId: string, @Body() body: ProgressDto) {
    return this.learning.updateProgress(request.userId, enrollmentId, body);
  }

  @Get('my-courses/:enrollmentId/assessment')
  assessment(@Req() request: AuthenticatedRequest, @Param('enrollmentId') enrollmentId: string) {
    return this.learning.getAssessment(request.userId, enrollmentId);
  }

  @Post('my-courses/:enrollmentId/assessment/attempts')
  attempt(
    @Req() request: AuthenticatedRequest,
    @Param('enrollmentId') enrollmentId: string,
    @Body() body: AssessmentAttemptDto,
  ) {
    return this.learning.submitAttempt(request.userId, enrollmentId, body.answers);
  }
}
