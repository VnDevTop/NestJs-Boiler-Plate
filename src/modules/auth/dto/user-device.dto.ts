import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { UserDevice } from '../entities/index.js';

export class UserDeviceDto {
  @ApiProperty({
    example: '8d7d34d4-8a52-4a7f-a92e-2d6d3ef9e631',
  })
  id!: string;

  @ApiPropertyOptional({
    example: 'MacBook Pro',
    nullable: true,
  })
  deviceName!: string | null;

  @ApiPropertyOptional({
    example: '::1',
    nullable: true,
  })
  ipAddress!: string | null;

  @ApiPropertyOptional({
    example: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    nullable: true,
  })
  userAgent!: string | null;

  @ApiProperty({
    example: true,
  })
  isActive!: boolean;

  @ApiProperty({
    example: '2026-09-26T00:00:00.000Z',
  })
  createdAt!: Date;

  @ApiProperty({
    example: '2026-09-27T12:00:00.000Z',
  })
  updatedAt!: Date;

  constructor(device: UserDevice) {
    this.id = device.id;
    this.deviceName = device.deviceName;
    this.ipAddress = device.ipAddress;
    this.userAgent = device.userAgent;
    this.isActive = device.isActive;
    this.createdAt = device.createdAt;
    this.updatedAt = device.updatedAt;
  }

  static fromEntity(device: UserDevice): UserDeviceDto {
    return new UserDeviceDto(device);
  }

  static fromEntities(devices: UserDevice[]): UserDeviceDto[] {
    return devices.map((device) => UserDeviceDto.fromEntity(device));
  }
}
