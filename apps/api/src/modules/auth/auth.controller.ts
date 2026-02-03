import { Controller, Post, Body, UsePipes } from '@nestjs/common'
import { AuthService } from './auth.service.js'
import { userCreateSchema, userLoginSchema } from '@blankcode/shared'
import { createZodPipe } from '../../common/pipes/index.js'
import { Public } from '../../common/decorators/index.js'

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('register')
  @UsePipes(createZodPipe(userCreateSchema))
  async register(@Body() body: unknown) {
    return this.authService.register(body as Parameters<typeof this.authService.register>[0])
  }

  @Public()
  @Post('login')
  @UsePipes(createZodPipe(userLoginSchema))
  async login(@Body() body: unknown) {
    return this.authService.login(body as Parameters<typeof this.authService.login>[0])
  }
}
