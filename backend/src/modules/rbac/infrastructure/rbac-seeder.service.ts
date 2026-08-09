import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RbacRepository } from './rbac.repository';
import { UserRole } from '@prisma/client';

@Injectable()
export class RbacSeederService implements OnModuleInit {
  private readonly logger = new Logger(RbacSeederService.name);

  constructor(private readonly rbacRepository: RbacRepository) {}

  async onModuleInit(): Promise<void> {
    await this.seedPermissionsAndRoles();
  }

  async seedPermissionsAndRoles(): Promise<void> {
    try {
      this.logger.log('Bootstrapping system RBAC permissions and default roles...');

      // Base system permissions
      const basePermissions = [
        {
          code: 'users.read',
          name: 'Read Users',
          resource: 'users',
          action: 'read',
          description: 'View user profiles and list',
        },
        {
          code: 'users.create',
          name: 'Create Users',
          resource: 'users',
          action: 'create',
          description: 'Create user accounts',
        },
        {
          code: 'users.update',
          name: 'Update Users',
          resource: 'users',
          action: 'update',
          description: 'Update user identity details',
        },
        {
          code: 'users.suspend',
          name: 'Suspend Users',
          resource: 'users',
          action: 'suspend',
          description: 'Suspend or activate user accounts',
        },
        {
          code: 'users.delete',
          name: 'Delete Users',
          resource: 'users',
          action: 'delete',
          description: 'Deactivate or soft-delete accounts',
        },
        {
          code: 'users.assign_role',
          name: 'Assign User Roles',
          resource: 'users',
          action: 'assign_role',
          description: 'Modify user assigned roles',
        },
        {
          code: 'roles.read',
          name: 'Read Roles',
          resource: 'roles',
          action: 'read',
          description: 'View role definitions',
        },
        {
          code: 'roles.manage',
          name: 'Manage Roles',
          resource: 'roles',
          action: 'manage',
          description: 'Create or update custom roles',
        },
        {
          code: 'permissions.assign',
          name: 'Assign Permissions',
          resource: 'permissions',
          action: 'assign',
          description: 'Assign permissions to roles',
        },
        {
          code: 'profile.read',
          name: 'Read Own Profile',
          resource: 'profile',
          action: 'read',
          description: 'Read own authenticated profile',
        },
        {
          code: 'profile.update',
          name: 'Update Own Profile',
          resource: 'profile',
          action: 'update',
          description: 'Update own authenticated profile',
        },
        {
          code: 'addresses.manage',
          name: 'Manage Own Addresses',
          resource: 'addresses',
          action: 'manage',
          description: 'Create, update, delete own addresses',
        },
        {
          code: 'sellers.read',
          name: 'Read Sellers',
          resource: 'sellers',
          action: 'read',
          description: 'View seller profiles and list',
        },
        {
          code: 'sellers.review',
          name: 'Review Seller Applications',
          resource: 'sellers',
          action: 'review',
          description: 'Review seller onboarding applications',
        },
        {
          code: 'sellers.approve',
          name: 'Approve Sellers',
          resource: 'sellers',
          action: 'approve',
          description: 'Approve seller applications',
        },
        {
          code: 'sellers.reject',
          name: 'Reject Sellers',
          resource: 'sellers',
          action: 'reject',
          description: 'Reject seller applications',
        },
        {
          code: 'sellers.suspend',
          name: 'Suspend Sellers',
          resource: 'sellers',
          action: 'suspend',
          description: 'Suspend or activate sellers',
        },
        {
          code: 'sellers.activate',
          name: 'Activate Sellers',
          resource: 'sellers',
          action: 'activate',
          description: 'Activate sellers',
        },
        {
          code: 'stores.read',
          name: 'Read Stores',
          resource: 'stores',
          action: 'read',
          description: 'View store profiles and list',
        },
        {
          code: 'stores.approve',
          name: 'Approve Stores',
          resource: 'stores',
          action: 'approve',
          description: 'Approve storefronts',
        },
        {
          code: 'stores.suspend',
          name: 'Suspend Stores',
          resource: 'stores',
          action: 'suspend',
          description: 'Suspend storefronts',
        },
        {
          code: 'seller_documents.read',
          name: 'Read Seller Documents',
          resource: 'seller_documents',
          action: 'read',
          description: 'View verification documents',
        },
        {
          code: 'seller_documents.review',
          name: 'Review Seller Documents',
          resource: 'seller_documents',
          action: 'review',
          description: 'Approve or reject verification documents',
        },
        {
          code: 'seller.profile.read',
          name: 'Read Own Seller Profile',
          resource: 'seller.profile',
          action: 'read',
          description: 'View own seller profile',
        },
        {
          code: 'seller.profile.update',
          name: 'Update Own Seller Profile',
          resource: 'seller.profile',
          action: 'update',
          description: 'Update own seller profile',
        },
        {
          code: 'store.read',
          name: 'Read Own Store',
          resource: 'store',
          action: 'read',
          description: 'View own store',
        },
        {
          code: 'store.update',
          name: 'Update Own Store',
          resource: 'store',
          action: 'update',
          description: 'Update own store details',
        },
      ];

      for (const p of basePermissions) {
        const existing = await this.rbacRepository.findPermissionByCode(p.code);
        if (!existing) {
          await this.rbacRepository.createPermission(p);
        }
      }

      // Default System Roles
      const systemRoles = [
        {
          code: UserRole.CUSTOMER,
          name: 'Customer',
          description: 'Standard platform buyer customer',
          isSystem: true,
        },
        {
          code: UserRole.SELLER,
          name: 'Seller',
          description: 'Vendor store owner',
          isSystem: true,
        },
        {
          code: UserRole.SELLER_STAFF,
          name: 'Seller Staff',
          description: 'Vendor store staff member',
          isSystem: true,
        },
        {
          code: UserRole.DELIVERY_AGENT,
          name: 'Delivery Agent',
          description: 'Courier / delivery personnel',
          isSystem: true,
        },
        {
          code: UserRole.ADMIN,
          name: 'Administrator',
          description: 'Platform Administrator',
          isSystem: true,
        },
        {
          code: UserRole.SUPER_ADMIN,
          name: 'Super Administrator',
          description: 'Full system super administrator',
          isSystem: true,
        },
      ];

      for (const r of systemRoles) {
        const existing = await this.rbacRepository.findRoleByCode(r.code);
        if (!existing) {
          await this.rbacRepository.createRole(r);
        }
      }

      // Default role permission mapping
      const allPermissions = await this.rbacRepository.findAllPermissions();
      const permMap = new Map(allPermissions.map((p) => [p.code, p.id]));

      // 1. CUSTOMER base permissions
      const customerRole = await this.rbacRepository.findRoleByCode(UserRole.CUSTOMER);
      if (customerRole) {
        const customerPermCodes = ['profile.read', 'profile.update', 'addresses.manage'];
        const customerPermIds = customerPermCodes
          .map((c) => permMap.get(c))
          .filter((id): id is string => Boolean(id));
        await this.rbacRepository.assignPermissionsToRole(customerRole.id, customerPermIds);
      }

      // 2. SELLER base permissions
      const sellerRole = await this.rbacRepository.findRoleByCode(UserRole.SELLER);
      if (sellerRole) {
        const sellerPermCodes = [
          'profile.read',
          'profile.update',
          'addresses.manage',
          'seller.profile.read',
          'seller.profile.update',
          'store.read',
          'store.update',
        ];
        const sellerPermIds = sellerPermCodes
          .map((c) => permMap.get(c))
          .filter((id): id is string => Boolean(id));
        await this.rbacRepository.assignPermissionsToRole(sellerRole.id, sellerPermIds);
      }

      // 3. SELLER_STAFF base permissions
      const sellerStaffRole = await this.rbacRepository.findRoleByCode(UserRole.SELLER_STAFF);
      if (sellerStaffRole) {
        const staffPermCodes = [
          'profile.read',
          'profile.update',
          'seller.profile.read',
          'store.read',
          'store.update',
        ];
        const staffPermIds = staffPermCodes
          .map((c) => permMap.get(c))
          .filter((id): id is string => Boolean(id));
        await this.rbacRepository.assignPermissionsToRole(sellerStaffRole.id, staffPermIds);
      }

      // 4. ADMIN base permissions
      const adminRole = await this.rbacRepository.findRoleByCode(UserRole.ADMIN);
      if (adminRole) {
        const adminPermCodes = [
          'users.read',
          'users.update',
          'users.suspend',
          'users.assign_role',
          'roles.read',
          'roles.manage',
          'profile.read',
          'profile.update',
          'addresses.manage',
          'sellers.read',
          'sellers.review',
          'sellers.approve',
          'sellers.reject',
          'sellers.suspend',
          'sellers.activate',
          'stores.read',
          'stores.approve',
          'stores.suspend',
          'seller_documents.read',
          'seller_documents.review',
        ];
        const adminPermIds = adminPermCodes
          .map((c) => permMap.get(c))
          .filter((id): id is string => Boolean(id));
        await this.rbacRepository.assignPermissionsToRole(adminRole.id, adminPermIds);
      }

      // 5. SUPER_ADMIN base permissions (All permissions)
      const superAdminRole = await this.rbacRepository.findRoleByCode(UserRole.SUPER_ADMIN);
      if (superAdminRole) {
        const allIds = Array.from(permMap.values());
        await this.rbacRepository.assignPermissionsToRole(superAdminRole.id, allIds);
      }

      this.logger.log('System RBAC permissions & roles seeded successfully.');
    } catch (error) {
      this.logger.error('Failed to seed system RBAC permissions and roles:', error);
    }
  }
}
