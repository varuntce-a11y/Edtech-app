import { BadRequestException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../prisma.service';
import { calculateTaxInclusiveGST } from './tax';

type CreateOrder = { billingName: string; billingAddress: string; gstin?: string; couponCode?: string };

@Injectable()
export class CommerceService {
  constructor(private readonly prisma: PrismaService) {}

  async getCart(userId: string) {
    return this.prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            course: {
              include: {
                instructor: { include: { user: { select: { name: true } } } },
              },
            },
          },
        },
      },
    });
  }

  async addCartItem(userId: string, item: { courseId: string; batchId?: string }) {
    const course = await this.prisma.course.findFirst({ where: { id: item.courseId, published: true }, include: { batches: true } });
    if (!course) throw new NotFoundException('Course not found');
    if (course.mode !== 'SELF_PACED') {
      const batch = course.batches.find(({ id, seatsTaken, seatsTotal }) => id === item.batchId && seatsTaken < seatsTotal);
      if (!batch) throw new BadRequestException('Choose an available batch for this course');
    }
    const cart = await this.prisma.cart.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
    return this.prisma.cartItem.upsert({
      where: { cartId_courseId: { cartId: cart.id, courseId: course.id } },
      create: { cartId: cart.id, courseId: course.id, batchId: item.batchId },
      update: { batchId: item.batchId },
      include: { course: true },
    });
  }

  async removeCartItem(userId: string, courseId: string) {
    const cart = await this.prisma.cart.findUnique({ where: { userId } });
    if (!cart) throw new NotFoundException('Cart not found');
    await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id, courseId } });
    return this.getCart(userId);
  }

  async createOrder(userId: string, idempotencyKey: string, input: CreateOrder) {
    if (!idempotencyKey || idempotencyKey.length > 128) throw new BadRequestException('A valid Idempotency-Key header is required');
    return this.prisma.$transaction(async (tx) => {
      const prior = await tx.order.findUnique({
        where: { userId_idempotencyKey: { userId, idempotencyKey } },
        include: { items: { include: { course: true } } },
      });
      if (prior) return prior;
      const cart = await tx.cart.findUnique({ where: { userId }, include: { items: { include: { course: true } } } });
      if (!cart?.items.length) throw new BadRequestException('Your cart is empty');
      const subtotalPaise = cart.items.reduce((total, item) => total + item.course.pricePaise, 0);
      const coupon = input.couponCode
        ? await tx.coupon.findUnique({ where: { code: input.couponCode.trim().toUpperCase() } })
        : null;
      if (input.couponCode && (!coupon || !coupon.active || coupon.usedCount >= coupon.maxUses)) {
        throw new BadRequestException('This coupon is invalid or no longer available');
      }
      const discountPaise = coupon ? Math.floor(subtotalPaise * coupon.discountPct / 100) : 0;
      const totalPaise = subtotalPaise - discountPaise;
      const { gstPaise } = calculateTaxInclusiveGST(totalPaise);

      for (const item of cart.items) {
        if (item.course.mode === 'SELF_PACED') continue;
        if (!item.batchId) throw new BadRequestException(`Choose a batch for ${item.course.title}`);
        const batch = await tx.batch.findFirst({ where: { id: item.batchId, courseId: item.courseId } });
        if (!batch || batch.seatsTaken >= batch.seatsTotal) throw new BadRequestException(`The selected batch for ${item.course.title} is full`);
        await tx.batch.update({ where: { id: batch.id }, data: { seatsTaken: { increment: 1 } } });
      }
      const order = await tx.order.create({
        data: {
          userId,
          idempotencyKey,
          billingName: input.billingName,
          billingAddress: input.billingAddress,
          gstin: input.gstin,
          couponId: coupon?.id,
          subtotalPaise,
          discountPaise,
          gstPaise,
          totalPaise,
          items: { create: cart.items.map((item) => ({ courseId: item.courseId, pricePaise: item.course.pricePaise, batchId: item.batchId })) },
        },
        include: { items: { include: { course: true } } },
      });
      if (coupon) await tx.coupon.update({ where: { id: coupon.id }, data: { usedCount: { increment: 1 } } });
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
      await tx.auditLog.create({ data: { actorId: userId, action: 'ORDER_CREATED', entity: 'Order', entityId: order.id } });
      return order;
    }, { isolationLevel: 'Serializable' });
  }

  async createPayment(userId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({ where: { id: orderId, userId }, include: { payments: true } });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status !== 'PENDING') throw new BadRequestException('This order is no longer payable');
    if (process.env.PAYMENT_PROVIDER === 'simulated' && process.env.NODE_ENV !== 'production') {
      const gatewayOrderId = `test_${order.id}`;
      await this.prisma.payment.upsert({
        where: { gatewayOrderId },
        create: { orderId, provider: 'simulated', gatewayOrderId, status: 'created' },
        update: {},
      });
      return { provider: 'simulated', orderId: gatewayOrderId, amount: order.totalPaise, currency: 'INR' };
    }
    if (process.env.PAYMENT_PROVIDER !== 'razorpay') {
      throw new ServiceUnavailableException('Payment provider is not configured. Set PAYMENT_PROVIDER=razorpay with test keys.');
    }
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) throw new ServiceUnavailableException('Razorpay test credentials are not configured');
    const prior = order.payments.find((payment) => payment.provider === 'razorpay' && payment.status === 'created');
    if (prior?.gatewayOrderId) return { orderId: prior.gatewayOrderId, keyId, amount: order.totalPaise, currency: 'INR' };
    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: order.totalPaise, currency: 'INR', receipt: order.id }),
    });
    if (!response.ok) throw new ServiceUnavailableException('Razorpay could not create the payment order');
    const gatewayOrder = await response.json() as { id: string };
    await this.prisma.payment.create({
      data: { orderId, provider: 'razorpay', gatewayOrderId: gatewayOrder.id, status: 'created' },
    });
    return { orderId: gatewayOrder.id, keyId, amount: order.totalPaise, currency: 'INR' };
  }

  async simulatePayment(userId: string, orderId: string, success: boolean) {
    if (process.env.NODE_ENV === 'production' || process.env.PAYMENT_PROVIDER !== 'simulated') {
      throw new ForbiddenException('Simulated payments are disabled outside local development');
    }
    const order = await this.prisma.order.findFirst({ where: { id: orderId, userId } });
    if (!order) throw new NotFoundException('Order not found');
    if (!success) throw new BadRequestException('Local payment simulation only supports successful test payments');
    return this.markCaptured(`test_${orderId}`, `test_payment_${orderId}`);
  }

  async verifyPayment(userId: string, input: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) {
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) throw new ServiceUnavailableException('Razorpay test credentials are not configured');
    const payment = await this.prisma.payment.findUnique({
      where: { gatewayOrderId: input.razorpay_order_id },
      include: { order: { select: { userId: true } } },
    });
    if (!payment || payment.order.userId !== userId) throw new NotFoundException('Payment order not found');
    const expected = createHmac('sha256', secret).update(`${input.razorpay_order_id}|${input.razorpay_payment_id}`).digest();
    let actual: Buffer;
    try {
      actual = Buffer.from(input.razorpay_signature, 'hex');
    } catch {
      throw new UnauthorizedException('Invalid payment signature');
    }
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new UnauthorizedException('Invalid payment signature');
    return this.markCaptured(input.razorpay_order_id, input.razorpay_payment_id);
  }

  async handleWebhook(signature: string | undefined, rawBody: Buffer | undefined) {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret || !signature || !rawBody) throw new UnauthorizedException('A signed Razorpay webhook is required');
    const expected = createHmac('sha256', secret).update(rawBody).digest();
    let actual: Buffer;
    try {
      actual = Buffer.from(signature, 'hex');
    } catch {
      throw new UnauthorizedException('Invalid webhook signature');
    }
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }
    const event = JSON.parse(rawBody.toString('utf8')) as {
      event?: string;
      payload?: { payment?: { entity?: { id?: string; order_id?: string; status?: string } } };
    };
    const payment = event.payload?.payment?.entity;
    if (event.event !== 'payment.captured' || !payment?.order_id || !payment.id) return { received: true };
    await this.markCaptured(payment.order_id, payment.id);
    return { received: true };
  }

  private async markCaptured(gatewayOrderId: string, paymentId: string) {
    await this.prisma.$transaction(async (tx) => {
      const record = await tx.payment.findUnique({ where: { gatewayOrderId } });
      if (!record) throw new NotFoundException('Payment order not found');
      if (record.status === 'captured') return;
      const order = await tx.order.findUniqueOrThrow({ where: { id: record.orderId } });
      await tx.payment.update({
        where: { id: record.id },
        data: { status: 'captured', providerPaymentId: paymentId, signatureVerified: true },
      });
      await tx.order.update({ where: { id: record.orderId }, data: { status: 'PAID' } });
      const items = await tx.orderItem.findMany({ where: { orderId: record.orderId } });
      for (const item of items) {
        await tx.enrollment.upsert({
          where: { userId_courseId: { userId: order.userId, courseId: item.courseId } },
          create: { userId: order.userId, courseId: item.courseId, batchId: item.batchId },
          update: {},
        });
      }
      await tx.auditLog.create({ data: { actorId: order.userId, action: 'PAYMENT_CAPTURED', entity: 'Order', entityId: record.orderId } });
    });
    return { received: true };
  }
}
