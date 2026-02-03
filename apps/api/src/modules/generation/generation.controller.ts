import { Controller, Post, Get, Body, Param } from '@nestjs/common'
import { GenerationService, type GenerateExerciseInput } from './generation.service.js'

@Controller('generation')
export class GenerationController {
  constructor(private generationService: GenerationService) {}

  @Post('exercises')
  async queueExerciseGeneration(@Body() body: GenerateExerciseInput) {
    return { data: await this.generationService.queueExerciseGeneration(body) }
  }

  @Get('jobs/:jobId')
  async getJobStatus(@Param('jobId') jobId: string) {
    return { data: await this.generationService.getJobStatus(jobId) }
  }
}
