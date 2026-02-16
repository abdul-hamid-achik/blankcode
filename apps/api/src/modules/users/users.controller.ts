import { userUpdateSchema } from '@blankcode/shared'
import { Body, Controller, Get, Param, Patch, UsePipes } from '@nestjs/common'
import { CurrentUser } from '../../common/decorators/index.js'
import { createZodPipe } from '../../common/pipes/index.js'
import { UsersService } from './users.service.js'

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  async getMe(@CurrentUser() user: { id: string }) {
    return { data: await this.usersService.findById(user.id) }
  }

  @Get(':username')
  async getByUsername(@Param('username') username: string) {
    return { data: await this.usersService.findByUsername(username) }
  }

  @Patch('me')
  @UsePipes(createZodPipe(userUpdateSchema))
  async updateMe(@CurrentUser() user: { id: string }, @Body() body: unknown) {
    return {
      data: await this.usersService.update(
        user.id,
        body as Parameters<typeof this.usersService.update>[1]
      ),
    }
  }
}
