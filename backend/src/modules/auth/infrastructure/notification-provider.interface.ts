export interface INotificationProvider {
  sendVerificationToken(destination: string, token: string, type: 'EMAIL' | 'PHONE'): Promise<void>;

  sendPasswordResetToken(destination: string, token: string): Promise<void>;
}
