import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DeliveryMode } from '@prisma/client';
import { PrismaService } from '../prisma.service';

export type CourseInput = {
  title: string;
  subtitle: string;
  description: string;
  topic: string;
  language: string;
  mode: DeliveryMode;
  priceRupees: number;
  instructorId?: string;
  published?: boolean;
};

@Injectable()
export class CourseAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, include: { instructor: true } });
    return this.prisma.course.findMany({
      where: user.role === 'ADMIN' ? {} : { instructorId: user.instructor?.id ?? '__no_instructor__' },
      orderBy: { updatedAt: 'desc' },
      include: { instructor: { include: { user: { select: { name: true } } } }, _count: { select: { enrollments: true, reviews: true } } },
    });
  }

  async instructors(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, include: { instructor: true } });
    if (user.role !== 'ADMIN' && user.instructor) {
      return this.prisma.instructor.findMany({
        where: { id: user.instructor.id },
        select: { id: true, bio: true, user: { select: { name: true } } },
      });
    }
    if (user.role !== 'ADMIN') throw new ForbiddenException('Instructor access is required');
    return this.prisma.instructor.findMany({
      select: { id: true, bio: true, user: { select: { name: true } } },
      orderBy: { user: { name: 'asc' } },
    });
  }

  async create(userId: string, input: CourseInput) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, include: { instructor: true } });
    if (user.role !== 'ADMIN' && !user.instructor) throw new ForbiddenException('Instructor access is required');
    const instructorId = user.role === 'ADMIN' ? input.instructorId : user.instructor!.id;
    if (!instructorId) throw new ForbiddenException('Choose a valid instructor');
    const instructor = await this.prisma.instructor.findUnique({ where: { id: instructorId } });
    if (!instructor) throw new NotFoundException('Instructor not found');
    const slugBase = input.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const slug = `${slugBase}-${Date.now().toString(36)}`;
    const pricePaise = Math.round(input.priceRupees * 100);
    const course = await this.prisma.course.create({
      data: {
        slug,
        title: input.title,
        subtitle: input.subtitle,
        description: input.description,
        outcomes: ['Apply your new skills to real-world work', 'Build a portfolio-ready project', 'Prepare for your next career opportunity'],
        topic: input.topic,
        language: input.language,
        level: 'All levels',
        mode: input.mode,
        pricePaise,
        originalPricePaise: Math.round(pricePaise * 1.2),
        durationHours: 8,
        mandatoryAssessment: false,
        published: user.role === 'ADMIN' && (input.published ?? false),
        instructorId,
      },
    });
    await this.prisma.auditLog.create({ data: { actorId: userId, action: 'COURSE_CREATED', entity: 'Course', entityId: course.id } });
    return course;
  }

  async publish(userId: string, courseId: string, published: boolean) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, include: { instructor: true } });
    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw new NotFoundException('Course not found');
    if (user.role !== 'ADMIN' && course.instructorId !== user.instructor?.id) {
      throw new ForbiddenException('You cannot edit this course');
    }
    const updated = await this.prisma.course.update({ where: { id: courseId }, data: { published } });
    await this.prisma.auditLog.create({
      data: { actorId: userId, action: published ? 'COURSE_PUBLISHED' : 'COURSE_UNPUBLISHED', entity: 'Course', entityId: courseId },
    });
    return updated;
  }
}
