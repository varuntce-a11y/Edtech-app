import { Body, Controller, Delete, Get, Headers, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { AccessTokenGuard, AuthenticatedRequest } from '../auth/access-token.guard';
import { CommerceService } from './commerce.service';

class CartItemDto {
  @IsString()
  courseId!: string;

  @IsOptional()
  @IsString()
  batchId?: string;
}

class CreateOrderDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  billingName!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(300)
  billingAddress!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(300)
  deliveryAddress!: string;

  @IsOptional()
  @Matches(/^[0-9A-Z]{15}$/)
  gstin?: string;

  @IsOptional()
  @IsString()
  couponCode?: string;
}

class VerifyPaymentDto {
  @IsString()
  razorpay_order_id!: string;

  @IsString()
  razorpay_payment_id!: string;

  @IsString()
  razorpay_signature!: string;
}

class SimulatePaymentDto {
  @IsBoolean()
  success!: boolean;
}

@ApiTags('commerce')
@ApiBearerAuth()
@UseGuards(AccessTokenGuard)
@Controller()
export class CommerceController {
  constructor(private readonly commerce: CommerceService) {}

  @Get('cart')
  getCart(@Req() request: AuthenticatedRequest) {
    return this.commerce.getCart(request.userId);
  }

  @Post('cart/items')
  addCartItem(@Req() request: AuthenticatedRequest, @Body() body: CartItemDto) {
    return this.commerce.addCartItem(request.userId, body);
  }

  @Delete('cart/items/:courseId')
  removeCartItem(@Req() request: AuthenticatedRequest, @Param('courseId') courseId: string) {
    return this.commerce.removeCartItem(request.userId, courseId);
  }

  @Post('orders')
  @ApiOperation({ summary: 'Create an idempotent checkout order and reserve batch seats' })
  createOrder(
    @Req() request: AuthenticatedRequest,
    @Headers('idempotency-key') idempotencyKey: string,
    @Body() body: CreateOrderDto,
  ) {
    return this.commerce.createOrder(request.userId, idempotencyKey, body);
  }

  @Post('payments/:orderId/checkout')
  createPayment(@Req() request: AuthenticatedRequest, @Param('orderId') orderId: string) {
    return this.commerce.createPayment(request.userId, orderId);
  }

  @Post('payments/:orderId/simulate')
  simulatePayment(
    @Req() request: AuthenticatedRequest,
    @Param('orderId') orderId: string,
    @Body() body: SimulatePaymentDto,
  ) {
    return this.commerce.simulatePayment(request.userId, orderId, body.success);
  }

  @Post('payments/verify')
  verifyPayment(@Req() _request: AuthenticatedRequest, @Body() body: VerifyPaymentDto) {
    return this.commerce.verifyPayment(_request.userId, body);
  }
}

@ApiTags('payments')
@Controller('payments/webhook')
export class PaymentWebhookController {
  constructor(private readonly commerce: CommerceService) {}

  @Post()
  handleWebhook(@Headers('x-razorpay-signature') signature: string, @Req() request: AuthenticatedRequest & { rawBody?: Buffer }) {
    return this.commerce.handleWebhook(signature, request.rawBody);
  }
}
