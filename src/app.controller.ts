import { Controller, Get } from '@nestjs/common';
import { Public } from './common/decorators/public.decorator';

@Controller()
export class AppController {
  @Public()
  @Get()
  getHealth() {
    return {
      message: 'Syncline API Server is running!',
      timestamp: new Date().toISOString(),
    };
  }
}
