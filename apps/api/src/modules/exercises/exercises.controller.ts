import { Controller, Get, Param } from '@nestjs/common'
import { ExercisesService } from './exercises.service.js'
import { Public } from '../../common/decorators/index.js'

@Controller('tracks/:trackSlug/concepts/:conceptSlug/exercises')
export class ExercisesController {
  constructor(private exercisesService: ExercisesService) {}

  @Public()
  @Get()
  async findByConceptSlug(
    @Param('trackSlug') trackSlug: string,
    @Param('conceptSlug') conceptSlug: string
  ) {
    return { data: await this.exercisesService.findByConceptSlug(trackSlug, conceptSlug) }
  }

  @Public()
  @Get(':exerciseSlug')
  async findBySlug(
    @Param('trackSlug') trackSlug: string,
    @Param('conceptSlug') conceptSlug: string,
    @Param('exerciseSlug') exerciseSlug: string
  ) {
    return { data: await this.exercisesService.findBySlug(trackSlug, conceptSlug, exerciseSlug) }
  }
}
