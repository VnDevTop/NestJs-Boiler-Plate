import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';

import { CreateUserDto } from './dto/index.js';
import { UpdateUserDto } from './dto/index.js';
import { UserResponseDto } from './dto/index.js';
import { UsersService } from './users.service.js';
import { Role } from '../../common/enums/index.js';
import { Roles } from '../../common/decorators/index.js';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Roles(Role.Admin, Role.SuperAdmin)
  @Post()
  create(@Body() createUserDto: CreateUserDto): Promise<UserResponseDto> {
    return this.usersService.create(createUserDto);
  }

  @Roles(Role.Admin, Role.SuperAdmin)
  @Get()
  findAll(): Promise<UserResponseDto[]> {
    return this.usersService.findAll();
  }

  @Get(':id')
  findProfile(@Param('id') id: string): Promise<UserResponseDto> {
    return this.usersService.findProfileById(id);
  }

  @Roles(Role.Admin, Role.SuperAdmin)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    return this.usersService.update(id, updateUserDto);
  }

  @Roles(Role.Admin, Role.SuperAdmin)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string): Promise<void> {
    return this.usersService.softDelete(id);
  }
}
