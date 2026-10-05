import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

type Question = { id: string; prompt: string; options: string[]; correctIndex: number };

@Injectable()
export class LearningService {
  constructor(private readonly prisma: PrismaService) {}

  myCourses(userId: string) {
    return this.prisma.enrollment.findMany({
      where: { userId },
      include: {
        course: {
          include: {
            modules: {
              orderBy: { position: 'asc' },
              include: { lessons: { orderBy: { position: 'asc' } } },
            },
          },
        },
        progress: true,
      },
      orderBy: { id: 'desc' },
    });
  }

  async updateProgress(userId: string, enrollmentId: string, input: { percentage: number; lessonId: string }) {
    const enrollment = await this.prisma.enrollment.findUnique({ where: { id: enrollmentId }, include: { course: true } });
    if (!enrollment) throw new NotFoundException('Enrollment not found');
    if (enrollment.userId !== userId) throw new ForbiddenException('This enrollment does not belong to you');
    const validLesson = await this.prisma.lesson.findFirst({
      where: { id: input.lessonId, module: { courseId: enrollment.courseId } },
    });
    if (!validLesson) throw new NotFoundException('Lesson not found in this course');
    const percentage = Math.min(100, Math.max(0, Math.round(input.percentage)));
    if (percentage === 100 && enrollment.course.mandatoryAssessment) {
      const assessment = await this.prisma.assessment.findUnique({ where: { courseId: enrollment.courseId } });
      if (!assessment) throw new BadRequestException('This course requires an assessment that is not configured');
      const passed = await this.prisma.attemptResult.findFirst({
        where: { assessmentId: assessment.id, userId, passed: true },
      });
      if (!passed) throw new BadRequestException('Pass the mandatory assessment before completing this course');
    }
    const status = percentage === 100 ? 'COMPLETED' : percentage > 0 ? 'IN_PROGRESS' : 'NOT_STARTED';
    const progress = await this.prisma.progress.upsert({
      where: { enrollmentId },
      create: { enrollmentId, percentage, lastLessonId: validLesson.id },
      update: { percentage, lastLessonId: validLesson.id },
    });
    await this.prisma.enrollment.update({
      where: { id: enrollmentId },
      data: { status, ...(status === 'COMPLETED' ? { completedAt: new Date() } : { completedAt: null }) },
    });
    return progress;
  }

  async getAssessment(userId: string, enrollmentId: string) {
    const enrollment = await this.ownedEnrollment(userId, enrollmentId);
    if (!enrollment.course.mandatoryAssessment) throw new NotFoundException('This course has no mandatory assessment');
    const assessment = await this.prisma.assessment.findUnique({ where: { courseId: enrollment.courseId } });
    if (!assessment) throw new NotFoundException('Assessment not found');
    const questions = this.parseQuestions(assessment.questions);
    return {
      id: assessment.id,
      passingScore: assessment.passingScore,
      questions: questions.map(({ correctIndex: _correctIndex, ...question }) => question),
    };
  }

  async submitAttempt(userId: string, enrollmentId: string, answers: { questionId: string; answerIndex: number }[]) {
    const enrollment = await this.ownedEnrollment(userId, enrollmentId);
    if (!enrollment.course.mandatoryAssessment) throw new NotFoundException('This course has no mandatory assessment');
    const assessment = await this.prisma.assessment.findUnique({ where: { courseId: enrollment.courseId } });
    if (!assessment) throw new NotFoundException('Assessment not found');
    const questions = this.parseQuestions(assessment.questions);
    const byQuestion = new Map(answers.map(({ questionId, answerIndex }) => [questionId, answerIndex]));
    if (byQuestion.size !== questions.length || questions.some((question) => !byQuestion.has(question.id))) {
      throw new BadRequestException('Submit one answer for every assessment question');
    }
    const score = Math.round(questions.filter((question) => byQuestion.get(question.id) === question.correctIndex).length * 100 / questions.length);
    const passed = score >= assessment.passingScore;
    await this.prisma.attemptResult.create({
      data: { assessmentId: assessment.id, userId, score, passed },
    });
    await this.prisma.auditLog.create({
      data: { actorId: userId, action: 'ASSESSMENT_ATTEMPTED', entity: 'Assessment', entityId: assessment.id, metadata: { score, passed } },
    });
    return { score, passed, passingScore: assessment.passingScore };
  }

  private async ownedEnrollment(userId: string, enrollmentId: string) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      include: { course: { select: { id: true, mandatoryAssessment: true } } },
    });
    if (!enrollment) throw new NotFoundException('Enrollment not found');
    if (enrollment.userId !== userId) throw new ForbiddenException('This enrollment does not belong to you');
    return enrollment;
  }

  private parseQuestions(value: unknown): Question[] {
    if (!Array.isArray(value) || value.length === 0) throw new BadRequestException('Assessment question bank is invalid');
    return value.map((entry) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new BadRequestException('Assessment question bank is invalid');
      const record = entry as Record<string, unknown>;
      if (
        typeof record.id !== 'string'
        || typeof record.prompt !== 'string'
        || !Array.isArray(record.options)
        || !record.options.every((option) => typeof option === 'string')
        || typeof record.correctIndex !== 'number'
        || !Number.isInteger(record.correctIndex)
        || record.correctIndex < 0
        || record.correctIndex >= record.options.length
      ) {
        throw new BadRequestException('Assessment question bank is invalid');
      }
      return {
        id: record.id,
        prompt: record.prompt,
        options: record.options as string[],
        correctIndex: record.correctIndex,
      };
    });
  }
}
