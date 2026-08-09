import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { SellerApplicationsRepository } from '../infrastructure/seller-applications.repository';
import { SellerDocumentsRepository } from '../infrastructure/seller-documents.repository';
import { SellersRepository } from '../infrastructure/sellers.repository';
import { RbacService } from '../../rbac/application/rbac.service';
import { SecurityAuditService } from '../../auth/infrastructure/security-audit.service';
import { SellerApplicationEntity } from '../domain/seller-application.entity';
import { SellerDocumentEntity } from '../domain/seller-document.entity';
import {
  SellerApplicationStatus,
  SellerStatus,
  SellerVerificationStatus,
  SellerDocumentType,
  SellerDocumentStatus,
  SecurityEventType,
  UserRole,
} from '@prisma/client';

export interface ApplySellerData {
  businessName: string;
  businessType?: string;
  taxNumber?: string;
  commercialRegister?: string;
  contactPhone: string;
  contactEmail: string;
  notes?: string;
}

export interface UploadDocumentData {
  type: SellerDocumentType;
  fileReference: string;
  fileName?: string;
}

@Injectable()
export class SellerOnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly applicationsRepository: SellerApplicationsRepository,
    private readonly documentsRepository: SellerDocumentsRepository,
    private readonly sellersRepository: SellersRepository,
    private readonly rbacService: RbacService,
    private readonly securityAuditService: SecurityAuditService,
  ) {}

  async applyForSeller(userId: string, data: ApplySellerData): Promise<SellerApplicationEntity> {
    const existingSeller = await this.sellersRepository.findByUserId(userId);
    if (existingSeller) {
      throw new ConflictException('User is already an onboarded seller.');
    }

    const existingApp = await this.applicationsRepository.findLatestByUserId(userId);
    if (
      existingApp &&
      (existingApp.status === SellerApplicationStatus.SUBMITTED ||
        existingApp.status === SellerApplicationStatus.UNDER_REVIEW ||
        existingApp.status === SellerApplicationStatus.APPROVED)
    ) {
      throw new ConflictException(
        `An active seller application already exists in status '${existingApp.status}'.`,
      );
    }

    const application = await this.applicationsRepository.create({
      user: { connect: { id: userId } },
      businessName: data.businessName.trim(),
      businessType: data.businessType?.trim() || null,
      taxNumber: data.taxNumber?.trim() || null,
      commercialRegister: data.commercialRegister?.trim() || null,
      contactPhone: data.contactPhone.trim(),
      contactEmail: data.contactEmail.trim().toLowerCase(),
      notes: data.notes?.trim() || null,
      status: SellerApplicationStatus.SUBMITTED,
    });

    return SellerApplicationEntity.fromPrisma(application);
  }

  async getMyApplication(userId: string): Promise<SellerApplicationEntity> {
    const app = await this.applicationsRepository.findLatestByUserId(userId);
    if (!app) {
      throw new NotFoundException('No seller application found for this user.');
    }
    return SellerApplicationEntity.fromPrisma(app);
  }

  async uploadDocument(
    userId: string,
    data: UploadDocumentData,
  ): Promise<SellerDocumentEntity> {
    const seller = await this.sellersRepository.findByUserId(userId);
    if (!seller) {
      throw new ForbiddenException(
        'You must have an active or pending seller profile to upload business documents.',
      );
    }

    const doc = await this.documentsRepository.create({
      seller: { connect: { id: seller.id } },
      type: data.type,
      fileReference: data.fileReference,
      fileName: data.fileName || null,
      status: SellerDocumentStatus.PENDING,
    });

    await this.securityAuditService.logEvent(
      SecurityEventType.SELLER_DOCUMENT_UPLOADED,
      userId,
      undefined,
      undefined,
      { sellerId: seller.id, documentId: doc.id, type: doc.type },
    );

    return SellerDocumentEntity.fromPrisma(doc);
  }

  async getSellerDocuments(sellerId: string): Promise<SellerDocumentEntity[]> {
    const docs = await this.documentsRepository.findBySellerId(sellerId);
    return docs.map(SellerDocumentEntity.fromPrisma);
  }

  async approveApplication(
    adminUserId: string,
    applicationId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<SellerApplicationEntity> {
    const app = await this.applicationsRepository.findById(applicationId);
    if (!app) {
      throw new NotFoundException('Seller application not found.');
    }

    if (
      app.status !== SellerApplicationStatus.SUBMITTED &&
      app.status !== SellerApplicationStatus.UNDER_REVIEW
    ) {
      throw new BadRequestException(
        `Application cannot be approved from status '${app.status}'.`,
      );
    }

    // Atomic transaction: Seller creation + Application status update + RBAC role assignment
    return this.prisma.$transaction(async (tx) => {
      let seller = await tx.seller.findUnique({ where: { userId: app.userId } });

      if (!seller) {
        seller = await tx.seller.create({
          data: {
            userId: app.userId,
            businessName: app.businessName,
            phone: app.contactPhone,
            email: app.contactEmail,
            governorateState: 'Default State',
            city: 'Default City',
            address: 'Default Address',
            status: SellerStatus.ACTIVE,
            verificationStatus: SellerVerificationStatus.VERIFIED,
            approvedAt: new Date(),
          },
        });
      } else {
        seller = await tx.seller.update({
          where: { id: seller.id },
          data: {
            status: SellerStatus.ACTIVE,
            verificationStatus: SellerVerificationStatus.VERIFIED,
            approvedAt: new Date(),
          },
        });
      }

      const updatedApp = await tx.sellerApplication.update({
        where: { id: applicationId },
        data: {
          status: SellerApplicationStatus.APPROVED,
          sellerId: seller.id,
          reviewedByUserId: adminUserId,
          reviewedAt: new Date(),
        },
      });

      // Grant SELLER role to user via RbacService
      await this.rbacService.assignRolesToUser(
        adminUserId,
        app.userId,
        [UserRole.SELLER],
        ipAddress,
        userAgent,
      );

      await this.securityAuditService.logEvent(
        SecurityEventType.SELLER_APPROVED,
        adminUserId,
        ipAddress,
        userAgent,
        { targetUserId: app.userId, sellerId: seller.id, applicationId },
      );

      return SellerApplicationEntity.fromPrisma(updatedApp);
    });
  }

  async rejectApplication(
    adminUserId: string,
    applicationId: string,
    rejectionReason: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<SellerApplicationEntity> {
    const app = await this.applicationsRepository.findById(applicationId);
    if (!app) throw new NotFoundException('Seller application not found.');

    const updatedApp = await this.applicationsRepository.updateStatus(
      applicationId,
      SellerApplicationStatus.REJECTED,
      adminUserId,
      rejectionReason,
    );

    await this.securityAuditService.logEvent(
      SecurityEventType.SELLER_REJECTED,
      adminUserId,
      ipAddress,
      userAgent,
      { targetUserId: app.userId, applicationId, rejectionReason },
    );

    return SellerApplicationEntity.fromPrisma(updatedApp);
  }

  async reviewDocument(
    adminUserId: string,
    documentId: string,
    status: SellerDocumentStatus,
    rejectionReason?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<SellerDocumentEntity> {
    const doc = await this.documentsRepository.findById(documentId);
    if (!doc) throw new NotFoundException('Seller document not found.');

    const updated = await this.documentsRepository.updateStatus(
      documentId,
      status,
      adminUserId,
      rejectionReason,
    );

    await this.securityAuditService.logEvent(
      SecurityEventType.SELLER_DOCUMENT_REVIEWED,
      adminUserId,
      ipAddress,
      userAgent,
      { documentId, sellerId: doc.sellerId, status, rejectionReason },
    );

    return SellerDocumentEntity.fromPrisma(updated);
  }
}
