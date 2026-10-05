import { Controller, Get, NotFoundException, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CatalogService, CatalogQuery } from './catalog.service';
import { OptionalAccessTokenGuard } from '../auth/optional-access-token.guard';

@ApiTags('catalog')
@UseGuards(OptionalAccessTokenGuard)
@Controller('courses')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  @ApiOperation({ summary: 'Search and filter the published course catalog' })
  list(@Query() query: CatalogQuery, @Req() request: { userId?: string }) {
    return this.catalog.list(query, request.userId);
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get localized course details and upcoming batches' })
  async detail(@Param('slug') slug: string, @Query('locale') locale = 'en', @Req() request: { userId?: string }) {
    const course = await this.catalog.detail(slug, locale, request.userId);
    if (!course) throw new NotFoundException('Course not found');
    return course;
  }
}
