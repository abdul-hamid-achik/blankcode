import { type SubmissionCreateInput, submissionCreateSchema } from '@blankcode/shared'
import { BadRequestException, Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import { z } from 'zod'
import { CurrentUser } from '../../common/decorators/index.js'
import { SubmissionThrottle } from '../../common/decorators/throttle.decorator.js'
import { createZodPipe } from '../../common/pipes/index.js'
import { SubmissionsService } from './submissions.service.js'

const submissionQuerySchema = z.object({
  exerciseId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
})

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
    @Query('limit') limit?: string,
    @Query('offset') offset?: string
  ) {
    const parsed = submissionQuerySchema.safeParse({ exerciseId, limit, offset })
    if (!parsed.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: parsed.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      })
    }

    const query = parsed.data

    if (query.exerciseId) {
      return { data: await this.submissionsService.findByExercise(query.exerciseId, user.id) }
    }

    return {
      data: await this.submissionsService.findByUser(user.id, query.limit, query.offset),
    }
  }
}
