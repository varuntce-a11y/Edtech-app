import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AccessTokenGuard } from './access-token.guard';

@Injectable()
export class OptionalAccessTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{ headers: { authorization?: string } }>();
    if (!request.headers.authorization) return true;
    return new AccessTokenGuard().canActivate(context);
  }
}
