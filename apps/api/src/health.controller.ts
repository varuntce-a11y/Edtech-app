import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Liveness probe' })
  getHealth() {
    return { status: 'ok', service: 'upskillin-api', timestamp: new Date().toISOString() };
  }
}
