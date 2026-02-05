import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UsePipes,
} from '@nestjs/common'
import { z } from 'zod'
import { CurrentUser, Public } from '../../common/decorators/index.js'
import { createZodPipe } from '../../common/pipes/index.js'
import type { JwtPayload } from '../auth/jwt.strategy.js'
import { ExercisesService } from './exercises.service.js'

@Controller('exercises')
export class ExercisesByIdController {
  constructor(private exercisesService: ExercisesService) {}

  @Public()
  @Get(':id')
  async findById(@Param('id') id: string) {
    return { data: await this.exercisesService.findById(id) }
  }

  @Get(':id/progress')
  async findWithProgress(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return { data: await this.exercisesService.findWithProgress(id, user.sub) }
  }

  @Post(':id/draft')
  @HttpCode(HttpStatus.OK)
  @UsePipes(createZodPipe(z.object({ code: z.string() })))
  async saveDraft(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: { code: string }
  ) {
    return { data: await this.exercisesService.saveDraft(user.sub, id, body.code) }
  }

  @Delete(':id/draft')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteDraft(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    await this.exercisesService.deleteDraft(user.sub, id)
  }
}

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
