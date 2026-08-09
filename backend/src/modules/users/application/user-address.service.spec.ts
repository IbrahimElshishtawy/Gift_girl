import { Test, TestingModule } from '@nestjs/testing';
import { UserAddressService } from './user-address.service';
import { UserAddressRepository } from '../infrastructure/user-address.repository';
import { SecurityAuditService } from '../../auth/infrastructure/security-audit.service';
import { UserAddressEntity } from '../domain/user-address.entity';

describe('UserAddressService', () => {
  let service: UserAddressService;

  const mockAddressEntity = UserAddressEntity.fromPrisma({
    id: 'addr_1',
    userId: 'usr_1',
    label: 'Home',
    recipientName: 'Sarah Elshishtawy',
    phone: '+201012345678',
    country: 'Egypt',
    governorateState: 'Gharbia',
    city: 'Tanta',
    district: null,
    street: 'El-Galaa St',
    building: null,
    apartment: null,
    floor: null,
    postalCode: null,
    isDefault: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const mockAddressRepository = {
    findByUserId: jest.fn().mockResolvedValue([mockAddressEntity]),
    createAddress: jest.fn().mockResolvedValue(mockAddressEntity),
    updateAddress: jest.fn().mockResolvedValue(mockAddressEntity),
    deleteAddress: jest.fn().mockResolvedValue(undefined),
    setDefaultAddress: jest.fn().mockResolvedValue(mockAddressEntity),
  };

  const mockSecurityAuditService = {
    logEvent: jest.fn().mockResolvedValue({ id: 'sa_1' }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserAddressService,
        { provide: UserAddressRepository, useValue: mockAddressRepository },
        { provide: SecurityAuditService, useValue: mockSecurityAuditService },
      ],
    }).compile();

    service = module.get<UserAddressService>(UserAddressService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return user addresses', async () => {
    const addresses = await service.getUserAddresses('usr_1');
    expect(addresses).toHaveLength(1);
    expect(addresses[0].recipientName).toBe('Sarah Elshishtawy');
  });

  it('should create address and log audit event', async () => {
    const result = await service.createAddress('usr_1', {
      recipientName: 'Sarah Elshishtawy',
      phone: '+201012345678',
      governorateState: 'Gharbia',
      city: 'Tanta',
      street: 'El-Galaa St',
    });
    expect(result.id).toBe('addr_1');
    expect(mockSecurityAuditService.logEvent).toHaveBeenCalled();
  });

  it('should update address and log audit event', async () => {
    const result = await service.updateAddress('addr_1', 'usr_1', {
      recipientName: 'Sarah updated',
    });
    expect(result.recipientName).toBe('Sarah Elshishtawy');
    expect(mockSecurityAuditService.logEvent).toHaveBeenCalled();
  });

  it('should delete address and log audit event', async () => {
    await service.deleteAddress('addr_1', 'usr_1');
    expect(mockAddressRepository.deleteAddress).toHaveBeenCalledWith('addr_1', 'usr_1');
    expect(mockSecurityAuditService.logEvent).toHaveBeenCalled();
  });

  it('should set default address and log audit event', async () => {
    const result = await service.setDefaultAddress('addr_1', 'usr_1');
    expect(result.isDefault).toBe(true);
    expect(mockSecurityAuditService.logEvent).toHaveBeenCalled();
  });
});
