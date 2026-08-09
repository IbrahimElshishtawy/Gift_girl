import {
  SellerDocument as PrismaSellerDocument,
  SellerDocumentType,
  SellerDocumentStatus,
} from '@prisma/client';

export class SellerDocumentEntity {
  constructor(
    public readonly id: string,
    public readonly sellerId: string,
    public readonly type: SellerDocumentType,
    public readonly fileReference: string,
    public readonly fileName: string | null,
    public readonly status: SellerDocumentStatus,
    public readonly rejectionReason: string | null,
    public readonly uploadedAt: Date,
    public readonly reviewedAt: Date | null,
    public readonly reviewedByUserId: string | null,
  ) {}

  static fromPrisma(prisma: PrismaSellerDocument): SellerDocumentEntity {
    return new SellerDocumentEntity(
      prisma.id,
      prisma.sellerId,
      prisma.type,
      prisma.fileReference,
      prisma.fileName,
      prisma.status,
      prisma.rejectionReason,
      prisma.uploadedAt,
      prisma.reviewedAt,
      prisma.reviewedByUserId,
    );
  }
}
