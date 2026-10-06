import { Prisma } from '@prisma/client';
import { CommerceService } from './commerce.service';

describe('CommerceService', () => {
  const transaction = {
    order: { findUnique: jest.fn(), create: jest.fn() },
    cart: { findUnique: jest.fn() },
    coupon: { findUnique: jest.fn() },
    batch: { findFirst: jest.fn(), update: jest.fn() },
    cartItem: { deleteMany: jest.fn() },
    auditLog: { create: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn((callback: (tx: typeof transaction) => Promise<unknown>) => callback(transaction)),
    course: { findFirst: jest.fn() },
    cart: { upsert: jest.fn(), findUnique: jest.fn() },
    cartItem: { upsert: jest.fn(), update: jest.fn() },
  };
  const service = new CommerceService(prisma as never);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.course.findFirst.mockResolvedValue({ id: 'course-1', mode: 'SELF_PACED', batches: [] });
    prisma.cart.upsert.mockResolvedValue({ id: 'cart-1' });
  });

  it('updates a cart item when concurrent adds race on its unique key', async () => {
    const cartItem = { id: 'item-1' };
    prisma.cartItem.upsert.mockRejectedValue(new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed on the fields: (`cartId`,`courseId`)',
      { code: 'P2002', clientVersion: '6.12.0', meta: { target: ['cartId', 'courseId'] } },
    ));
    prisma.cartItem.update.mockResolvedValue(cartItem);

    await expect(service.addCartItem('user-1', { courseId: 'course-1' })).resolves.toBe(cartItem);
    expect(prisma.cartItem.update).toHaveBeenCalledWith({
      where: { cartId_courseId: { cartId: 'cart-1', courseId: 'course-1' } },
      data: { batchId: undefined },
      include: { course: true },
    });
  });

  it('rethrows errors other than the cart item unique-key race', async () => {
    const failure = new Error('Database unavailable');
    prisma.cartItem.upsert.mockRejectedValue(failure);

    await expect(service.addCartItem('user-1', { courseId: 'course-1' })).rejects.toBe(failure);
    expect(prisma.cartItem.update).not.toHaveBeenCalled();
  });

  it('persists the delivery address on a new order', async () => {
    transaction.order.findUnique.mockResolvedValue(null);
    transaction.cart.findUnique.mockResolvedValue({
      items: [{ courseId: 'course-1', course: { pricePaise: 10_000, mode: 'SELF_PACED', title: 'Course' } }],
    });
    transaction.order.create.mockResolvedValue({ id: 'order-1' });

    await service.createOrder('user-1', 'request-1', {
      billingName: 'Learner',
      billingAddress: 'Billing address, Bengaluru',
      deliveryAddress: 'Delivery address, Bengaluru',
    });

    expect(transaction.order.create.mock.calls[0][0].data).toMatchObject({
      billingName: 'Learner',
      billingAddress: 'Billing address, Bengaluru',
      deliveryAddress: 'Delivery address, Bengaluru',
    });
  });
});
