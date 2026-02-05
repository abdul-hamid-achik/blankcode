import { type SubmissionCreateInput, submissionCreateSchema } from '@blankcode/shared'
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import { CurrentUser } from '../../common/decorators/index.js'
import { SubmissionThrottle } from '../../common/decorators/throttle.decorator.js'
import { createZodPipe } from '../../common/pipes/index.js'
import { SubmissionsService } from './submissions.service.js'

@Controller('submissions')
export class SubmissionsController {
  constructor(private submissionsService: SubmissionsService) {}

  @SubmissionThrottle()
  @Post()
  async create(
    @CurrentUser() user: { id: string },
    @Body(createZodPipe(submissionCreateSchema)) body: SubmissionCreateInput
  ) {
    return {
      data: await this.submissionsService.create(user.id, body),
    }
  }

  @Get(':id')
  async findById(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return { data: await this.submissionsService.findById(id, user.id) }
  }

  @SubmissionThrottle()
  @Post(':id/retry')
  async retry(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return { data: await this.submissionsService.retry(id, user.id) }
  }

  @Get()
  async findByUser(
    @CurrentUser() user: { id: string },
    @Query('exerciseId') exerciseId?: string,
    @Query('limit') limit?: string
  ) {
    if (exerciseId) {
      return { data: await this.submissionsService.findByExercise(exerciseId, user.id) }
    }
    const parsedLimit = limit ? Number.parseInt(limit, 10) : undefined
    const validLimit =
      parsedLimit && Number.isFinite(parsedLimit) && parsedLimit > 0
        ? Math.min(parsedLimit, 100)
        : undefined
    return {
      data: await this.submissionsService.findByUser(user.id, validLimit),
    }
  }
}
