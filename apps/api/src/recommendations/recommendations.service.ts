import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class RecommendationService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId?: string) {
    const learner = userId
      ? await this.prisma.user.findUnique({
        where: { id: userId },
        include: { profile: true, enrollments: { include: { course: { select: { topic: true } } } } },
      })
      : null;
    const purchased = learner?.enrollments.map(({ course }) => course.topic) ?? [];
    const purchasedIds = learner?.enrollments.map(({ courseId }) => courseId) ?? [];
    const target = learner?.profile?.targetRole?.toLowerCase() ?? '';
    const topics = [...new Set(purchased)];
    const [searches, recentViews, coPurchases] = userId && purchasedIds.length
      ? await Promise.all([
        this.prisma.searchEvent.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 10, select: { query: true } }),
        this.prisma.viewEvent.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 10, include: { course: { select: { topic: true } } } }),
        this.prisma.orderItem.findMany({
          where: { courseId: { in: purchasedIds }, order: { status: 'PAID', userId: { not: userId } } },
          select: { courseId: true, order: { select: { items: { select: { courseId: true } } } } },
        }),
      ])
      : [[], [], []];
    const searchAffinity = searches.map(({ query }) => query.toLowerCase());
    const viewedTopics = recentViews.map(({ course }) => course.topic);
    const coPurchaseCounts = new Map<string, number>();
    for (const item of coPurchases) {
      for (const coItem of item.order.items) {
        if (coItem.courseId !== item.courseId && !purchasedIds.includes(coItem.courseId)) {
          coPurchaseCounts.set(coItem.courseId, (coPurchaseCounts.get(coItem.courseId) ?? 0) + 1);
        }
      }
    }
    const candidates = await this.prisma.course.findMany({
      where: {
        published: true,
        ...(learner?.enrollments.length ? { enrollments: { none: { userId } } } : {}),
      },
      include: { instructor: { include: { user: { select: { name: true } } } } },
      orderBy: [{ featured: 'desc' }, { rating: 'desc' }, { reviewCount: 'desc' }],
      take: 40,
    });
    return candidates
      .map(({ instructor, ...course }) => {
        const topicAffinity = topics.includes(course.topic) ? 3 : viewedTopics.includes(course.topic) ? 2 : 0;
        const roleAffinity = target && `${course.title} ${course.topic} ${course.subtitle}`.toLowerCase().includes(target) ? 4 : 0;
        const searchMatch = searchAffinity.some((query) => `${course.title} ${course.topic} ${course.subtitle}`.toLowerCase().includes(query));
        const coPurchaseAffinity = Math.min(5, coPurchaseCounts.get(course.id) ?? 0);
        const languageAffinity = learner?.profile?.preferredLanguage === course.language ? 1 : 0;
        const score = topicAffinity + roleAffinity + coPurchaseAffinity * 2 + (searchMatch ? 2 : 0) + languageAffinity + course.rating / 10;
        const reason = coPurchaseAffinity ? 'Learners also bought this'
          : roleAffinity ? 'Matches your career goal'
            : searchMatch ? 'Related to what you have searched for'
          : topicAffinity ? 'Builds on a topic you have studied'
            : languageAffinity ? 'Available in your preferred language'
              : 'Popular with learners';
        return { ...course, instructor: instructor.user.name, score, reason };
      })
      .sort((left, right) => right.score - left.score)
      .slice(0, 8);
  }
}
