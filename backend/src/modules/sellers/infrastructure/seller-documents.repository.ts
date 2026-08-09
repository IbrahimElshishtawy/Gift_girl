import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { SellerDocument, Prisma, SellerDocumentStatus } from '@prisma/client';

@Injectable()
export class SellerDocumentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<SellerDocument | null> {
    return this.prisma.sellerDocument.findUnique({ where: { id } });
  }

  async findBySellerId(sellerId: string): Promise<SellerDocument[]> {
    return this.prisma.sellerDocument.findMany({
      where: { sellerId },
      orderBy: { uploadedAt: 'desc' },
    });
  }

  async create(data: Prisma.SellerDocumentCreateInput): Promise<SellerDocument> {
    return this.prisma.sellerDocument.create({ data });
  }

  async updateStatus(
    id: string,
    status: SellerDocumentStatus,
    reviewedByUserId?: string,
    rejectionReason?: string,
  ): Promise<SellerDocument> {
    return this.prisma.sellerDocument.update({
      where: { id },
      data: {
        status,
        reviewedByUserId,
        reviewedAt: new Date(),
        rejectionReason: rejectionReason || null,
      },
    });
  }
}
