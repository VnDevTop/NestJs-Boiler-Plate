import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, IsNull, Repository } from 'typeorm';

import { UserDeviceDto } from './dto/index.js';
import { UserDevice } from './entities/index.js';
import { DeviceMetadata } from './types/index.js';

@Injectable()
export class DeviceService {
  constructor(
    @InjectRepository(UserDevice)
    private readonly devicesRepository: Repository<UserDevice>,
  ) {}

  private get store(): EntityManager {
    return this.devicesRepository.manager;
  }

  /**
   * Resolves the device behind an incoming login request.
   *
   * Devices are fingerprinted by user agent, so repeated logins from the same
   * browser or app reuse a single row instead of piling up duplicates. A
   * previously revoked device is reactivated, because logging in again from the
   * same client is a legitimate new session.
   */
  async register(
    userId: string,
    metadata: DeviceMetadata,
    manager: EntityManager = this.store,
  ): Promise<UserDevice> {
    const existing = await manager.findOne(UserDevice, {
      where: {
        userId,
        userAgent: metadata.userAgent === null ? IsNull() : metadata.userAgent,
      },
    });

    if (existing) {
      existing.ipAddress = metadata.ipAddress;
      existing.deviceName = metadata.deviceName ?? existing.deviceName;
      existing.isActive = true;

      return manager.save(existing);
    }

    const device = manager.create(UserDevice, {
      userId,
      deviceName: metadata.deviceName,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      isActive: true,
    });

    return manager.save(device);
  }

  async listByUserId(userId: string): Promise<UserDeviceDto[]> {
    const devices = await this.devicesRepository.find({
      where: { userId, isActive: true },
      order: { createdAt: 'DESC' },
    });

    return UserDeviceDto.fromEntities(devices);
  }

  async findActiveById(
    userId: string,
    deviceId: string,
  ): Promise<UserDevice | null> {
    return this.devicesRepository.findOne({
      where: { id: deviceId, userId, isActive: true },
    });
  }

  async revoke(userId: string, deviceId: string): Promise<UserDevice> {
    const device = await this.findActiveById(userId, deviceId);

    if (!device) {
      throw new NotFoundException('Device not found');
    }

    device.isActive = false;

    return this.devicesRepository.save(device);
  }

  async revokeAllByUserId(userId: string): Promise<number> {
    const result = await this.devicesRepository.update(
      { userId, isActive: true },
      { isActive: false },
    );

    return result.affected ?? 0;
  }
}
