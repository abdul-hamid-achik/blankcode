import { Controller, Get, Post, Body, Param, Query, UsePipes } from '@nestjs/common'
import { SubmissionsService } from './submissions.service.js'
import { submissionCreateSchema } from '@blankcode/shared'
import { createZodPipe } from '../../common/pipes/index.js'
import { CurrentUser } from '../../common/decorators/index.js'

@Controller('submissions')
export class SubmissionsController {
  constructor(private submissionsService: SubmissionsService) {}

  @Post()
  @UsePipes(createZodPipe(submissionCreateSchema))
  async create(@CurrentUser() user: { id: string }, @Body() body: unknown) {
    return {
      data: await this.submissionsService.create(
        user.id,
        body as Parameters<typeof this.submissionsService.create>[1]
      ),
    }
  }

  @Get(':id')
  async findById(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return { data: await this.submissionsService.findById(id, user.id) }
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
    return {
      data: await this.submissionsService.findByUser(
        user.id,
        limit ? Number.parseInt(limit, 10) : undefined
      ),
    }
  }
}
