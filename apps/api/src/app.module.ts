import { Module } from '@nestjs/common';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { CatalogController } from './catalog/catalog.controller';
import { CatalogService } from './catalog/catalog.service';
import { CommerceController, PaymentWebhookController } from './commerce/commerce.controller';
import { CommerceService } from './commerce/commerce.service';
import { LearningController } from './learning/learning.controller';
import { LearningService } from './learning/learning.service';
import { CourseAdminController } from './admin/course-admin.controller';
import { CourseAdminService } from './admin/course-admin.service';
import { RecommendationsController } from './recommendations/recommendations.controller';
import { RecommendationService } from './recommendations/recommendations.service';
import { HealthController } from './health.controller';
import { PrismaService } from './prisma.service';

@Module({
  controllers: [HealthController, CatalogController, AuthController, CommerceController, PaymentWebhookController, LearningController, CourseAdminController, RecommendationsController],
  providers: [PrismaService, CatalogService, AuthService, CommerceService, LearningService, CourseAdminService, RecommendationService],
})
export class AppModule {}
