import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { OptionalAccessTokenGuard } from '../auth/optional-access-token.guard';
import { RecommendationService } from './recommendations.service';

@ApiTags('recommendations')
@UseGuards(OptionalAccessTokenGuard)
@Controller('recommendations')
export class RecommendationsController {
  constructor(private readonly recommendations: RecommendationService) {}

  @Get()
  list(@Req() request: { userId?: string }) {
    return this.recommendations.list(request.userId);
  }
}
