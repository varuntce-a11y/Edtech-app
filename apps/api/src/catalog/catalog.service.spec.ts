import { CatalogService } from './catalog.service';

describe('CatalogService', () => {
  const prisma = {
    $transaction: jest.fn(),
    course: { findMany: jest.fn(), count: jest.fn() },
  };
  const service = new CatalogService(prisma as never);

  beforeEach(() => jest.clearAllMocks());

  it('clamps pagination and applies combinable filters and requested sort', async () => {
    prisma.$transaction.mockResolvedValue([[], 0]);
    const result = await service.list({
      page: '-2',
      limit: '1000',
      topic: 'Data',
      language: 'hi',
      mode: 'virtual',
      assessment: 'yes',
      minPrice: '500',
      maxPrice: '2500',
      sort: 'rating',
    });
    expect(result).toMatchObject({ total: 0, page: 1, pageSize: 48, pages: 0 });
    const { where, orderBy } = prisma.course.findMany.mock.calls[0][0];
    expect(where).toMatchObject({
      topic: { equals: 'Data', mode: 'insensitive' },
      language: 'hi',
      mode: 'VIRTUAL',
      mandatoryAssessment: true,
      pricePaise: { gte: 50_000, lte: 250_000 },
    });
    expect(orderBy).toEqual({ rating: 'desc' });
  });

  it('uses relevance sorting and localized text when available', async () => {
    prisma.$transaction.mockResolvedValue([[], 0]);
    await service.list({});
    expect(prisma.course.findMany.mock.calls[0][0].orderBy).toEqual({ featured: 'desc' });
  });
});
