import { Test, TestingModule } from '@nestjs/testing';
import { RbacService } from './rbac.service';
import { RbacRepository } from '../infrastructure/rbac.repository';
import { PrismaService } from '../../../database/prisma.service';
import { SecurityAuditService } from '../../auth/infrastructure/security-audit.service';
import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';

describe('RbacService', () => {
  let service: RbacService;

  const mockRbacRepository = {
    findPermissionsForUser: jest.fn().mockResolvedValue([
      { code: 'users.read', resource: 'users', action: 'read' },
    ]),
    findAllRoles: jest.fn().mockResolvedValue([
      { code: 'CUSTOMER', name: 'Customer', isSystem: true },
    ]),
    findAllPermissions: jest.fn().mockResolvedValue([
      { code: 'users.read', resource: 'users', action: 'read' },
    ]),
    findRoleByCode: jest.fn().mockImplementation((code: string) =>
      Promise.resolve({ id: `role_${code}`, code, name: code, isSystem: true }),
    ),
    findRoleById: jest.fn().mockResolvedValue({ id: 'role_1', code: 'ADMIN' }),
    findPermissionByCode: jest.fn().mockImplementation((code: string) =>
      Promise.resolve({ id: `perm_${code}`, code, resource: 'res', action: 'act' }),
    ),
    assignRolesToUser: jest.fn().mockResolvedValue(undefined),
    assignPermissionsToRole: jest.fn().mockResolvedValue(undefined),
  };

  const mockPrismaService = {
    user: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        if (where.id === 'super_admin_id') {
          return Promise.resolve({ id: 'super_admin_id', role: UserRole.SUPER_ADMIN });
        }
        if (where.id === 'admin_id') {
          return Promise.resolve({ id: 'admin_id', role: UserRole.ADMIN });
        }
        return Promise.resolve({ id: where.id, role: UserRole.CUSTOMER });
      }),
      update: jest.fn().mockResolvedValue({ id: 'usr_1', role: UserRole.ADMIN }),
    },
    userRoleAssignment: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    $transaction: jest.fn().mockImplementation((cb) => cb(mockPrismaService)),
  };

  const mockSecurityAuditService = {
    logEvent: jest.fn().mockResolvedValue({ id: 'sa_1' }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RbacService,
        { provide: RbacRepository, useValue: mockRbacRepository },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: SecurityAuditService, useValue: mockSecurityAuditService },
      ],
    }).compile();

    service = module.get<RbacService>(RbacService);
  });

  it('should evaluate user permissions correctly', async () => {
    const hasPerm = await service.hasPermission('usr_1', ['users.read']);
    expect(hasPerm).toBe(true);

    const hasMissingPerm = await service.hasPermission('usr_1', ['users.delete']);
    expect(hasMissingPerm).toBe(false);
  });

  it('should prevent non-super-admin from assigning SUPER_ADMIN role (Privilege Escalation Protection)', async () => {
    await expect(
      service.assignRolesToUser('admin_id', 'target_usr', [UserRole.SUPER_ADMIN]),
    ).rejects.toThrow(ForbiddenException);
  });

  it('should allow super-admin to assign SUPER_ADMIN role', async () => {
    await service.assignRolesToUser('super_admin_id', 'target_usr', [UserRole.SUPER_ADMIN]);
    expect(mockSecurityAuditService.logEvent).toHaveBeenCalled();
  });
});
