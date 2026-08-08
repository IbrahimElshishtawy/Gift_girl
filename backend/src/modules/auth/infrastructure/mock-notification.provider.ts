import { Injectable, Logger } from '@nestjs/common';
import { INotificationProvider } from './notification-provider.interface';

@Injectable()
export class MockNotificationProvider implements INotificationProvider {
  private readonly logger = new Logger(MockNotificationProvider.name);

  async sendVerificationToken(
    destination: string,
    _token: string,
    type: 'EMAIL' | 'PHONE',
  ): Promise<void> {
    this.logger.log(
      `[MOCK NOTIFICATION] Sent ${type} verification code to ${destination}. (Code redacted for security)`,
    );
  }

  async sendPasswordResetToken(
    destination: string,
    _token: string,
  ): Promise<void> {
    this.logger.log(
      `[MOCK NOTIFICATION] Sent password reset link to ${destination}. (Token redacted for security)`,
    );
  }
}
