import { userCreateSchema, userLoginSchema } from '@blankcode/shared'
import { Body, Controller, HttpCode, HttpStatus, Post, UsePipes } from '@nestjs/common'
import { z } from 'zod'
import { Public } from '../../common/decorators/index.js'
import { AuthThrottle } from '../../common/decorators/throttle.decorator.js'
import { createZodPipe } from '../../common/pipes/index.js'
import { AuthService } from './auth.service.js'

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @AuthThrottle()
  @Post('register')
  @UsePipes(createZodPipe(userCreateSchema))
  async register(@Body() body: unknown) {
    return this.authService.register(body as Parameters<typeof this.authService.register>[0])
  }

  @Public()
  @AuthThrottle()
  @Post('login')
  @UsePipes(createZodPipe(userLoginSchema))
  async login(@Body() body: unknown) {
    return this.authService.login(body as Parameters<typeof this.authService.login>[0])
  }

  @Public()
  @AuthThrottle()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UsePipes(createZodPipe(z.object({ refreshToken: z.string() })))
  async refresh(@Body() body: { refreshToken: string }) {
    return this.authService.validateAndRotateRefreshToken(body.refreshToken)
  }

  @Public()
  @AuthThrottle()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UsePipes(createZodPipe(z.object({ refreshToken: z.string() })))
  async logout(@Body() body: { refreshToken: string }) {
    await this.authService.revokeRefreshToken(body.refreshToken)
  }
}
