import { Controller, Get, Patch, Body, Param, UsePipes } from '@nestjs/common'
import { UsersService } from './users.service.js'
import { userUpdateSchema } from '@blankcode/shared'
import { createZodPipe } from '../../common/pipes/index.js'
import { CurrentUser } from '../../common/decorators/index.js'

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  async getMe(@CurrentUser() user: { id: string }) {
    return this.usersService.findById(user.id)
  }

  @Get(':username')
  async getByUsername(@Param('username') username: string) {
    return this.usersService.findByUsername(username)
  }

  @Patch('me')
  @UsePipes(createZodPipe(userUpdateSchema))
  async updateMe(@CurrentUser() user: { id: string }, @Body() body: unknown) {
    return this.usersService.update(
      user.id,
      body as Parameters<typeof this.usersService.update>[1]
    )
  }
}
