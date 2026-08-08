import { Global, Module, OnModuleDestroy } from '@nestjs/common';
import { QueueFactoryService } from './queue.service';

@Global()
@Module({
  providers: [QueueFactoryService],
  exports: [QueueFactoryService],
})
export class QueueModule implements OnModuleDestroy {
  constructor(private readonly queueFactory: QueueFactoryService) {}

  async onModuleDestroy(): Promise<void> {
    await this.queueFactory.closeAll();
  }
}
