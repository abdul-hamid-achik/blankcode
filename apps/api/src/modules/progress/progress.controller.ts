import { Controller, Get, Param, Query } from '@nestjs/common'
import { ProgressService } from './progress.service.js'
import { CurrentUser } from '../../common/decorators/index.js'

@Controller('progress')
export class ProgressController {
  constructor(private progressService: ProgressService) {}

  @Get('exercises/:exerciseId')
  async getExerciseProgress(
    @CurrentUser() user: { id: string },
    @Param('exerciseId') exerciseId: string
  ) {
    return { data: await this.progressService.getExerciseProgress(user.id, exerciseId) }
  }

  @Get('concepts/:conceptId')
  async getConceptMastery(
    @CurrentUser() user: { id: string },
    @Param('conceptId') conceptId: string
  ) {
    return { data: await this.progressService.getConceptMastery(user.id, conceptId) }
  }

  @Get('tracks/:trackSlug')
  async getTrackProgress(
    @CurrentUser() user: { id: string },
    @Param('trackSlug') trackSlug: string
  ) {
    return { data: await this.progressService.getTrackProgress(user.id, trackSlug) }
  }
}
