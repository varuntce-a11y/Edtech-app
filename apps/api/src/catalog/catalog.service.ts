import { Injectable } from '@nestjs/common';
import { DeliveryMode, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';

export type CatalogQuery = {
  q?: string;
  topic?: string;
  language?: string;
  mode?: string;
  instructor?: string;
  assessment?: string;
  minPrice?: string;
  maxPrice?: string;
  sort?: string;
  page?: string;
  limit?: string;
};

const modes: Record<string, DeliveryMode> = {
  physical: DeliveryMode.PHYSICAL,
  virtual: DeliveryMode.VIRTUAL,
  self_paced: DeliveryMode.SELF_PACED,
};

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: CatalogQuery, userId?: string) {
    if (query.q?.trim()) {
      await this.prisma.searchEvent.create({ data: { userId, query: query.q.trim().slice(0, 120) } });
    }
    const page = Math.max(1, Number.parseInt(query.page ?? '1', 10) || 1);
    const limit = Math.min(48, Math.max(1, Number.parseInt(query.limit ?? '12', 10) || 12));
    const minimum = Math.max(0, Number.parseInt(query.minPrice ?? '0', 10) || 0) * 100;
    const maximum = query.maxPrice ? Math.max(minimum, Number.parseInt(query.maxPrice, 10) * 100) : undefined;
    const where: Prisma.CourseWhereInput = {
      published: true,
      ...(query.topic ? { topic: { equals: query.topic, mode: 'insensitive' } } : {}),
      ...(query.language ? { language: query.language } : {}),
      ...(query.mode && modes[query.mode] ? { mode: modes[query.mode] } : {}),
      ...(query.assessment === 'yes' ? { mandatoryAssessment: true } : {}),
      ...(query.assessment === 'no' ? { mandatoryAssessment: false } : {}),
      ...(query.instructor ? { instructor: { user: { name: { contains: query.instructor, mode: 'insensitive' } } } } : {}),
      pricePaise: { gte: minimum, ...(maximum !== undefined ? { lte: maximum } : {}) },
      ...(query.q ? {
        OR: [
          { title: { contains: query.q, mode: 'insensitive' } },
          { subtitle: { contains: query.q, mode: 'insensitive' } },
          { description: { contains: query.q, mode: 'insensitive' } },
          { topic: { contains: query.q, mode: 'insensitive' } },
        ],
      } : {}),
    };
    const orderBy: Prisma.CourseOrderByWithRelationInput =
      query.sort === 'price_asc' ? { pricePaise: 'asc' }
        : query.sort === 'price_desc' ? { pricePaise: 'desc' }
          : query.sort === 'rating' ? { rating: 'desc' }
            : query.sort === 'newest' ? { createdAt: 'desc' }
              : { featured: 'desc' };
    const [courses, total] = await this.prisma.$transaction([
      this.prisma.course.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: { instructor: { include: { user: { select: { name: true } } } } },
      }),
      this.prisma.course.count({ where }),
    ]);
    return {
      items: courses.map(({ instructor, ...course }) => ({ ...course, instructor: instructor.user.name })),
      total,
      page,
      pageSize: limit,
      pages: Math.ceil(total / limit),
    };
  }

  async detail(slug: string, locale: string, userId?: string) {
    const course = await this.prisma.course.findFirst({
      where: { slug, published: true },
      include: {
        instructor: { include: { user: { select: { name: true } } } },
        modules: { orderBy: { position: 'asc' }, include: { lessons: { orderBy: { position: 'asc' } } } },
        batches: { where: { startsAt: { gte: new Date() } }, orderBy: { startsAt: 'asc' } },
        translations: { where: { locale } },
        reviews: { where: { moderated: true }, include: { user: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });
    if (!course) return null;
    await this.prisma.viewEvent.create({ data: { userId, courseId: course.id } });
    const translation = course.translations[0];
    const { instructor, translations, ...details } = course;
    return {
      ...details,
      ...(translation ? { title: translation.title, description: translation.description } : {}),
      instructor: { name: instructor.user.name, bio: instructor.bio, headline: instructor.headline },
    };
  }
}
