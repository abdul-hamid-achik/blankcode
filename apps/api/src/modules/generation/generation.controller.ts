import { Body, Controller, Get, Param, Post, UseGuards, UsePipes } from '@nestjs/common'
import { z } from 'zod'
import { AdminGuard } from '../../common/guards/index.js'
import { createZodPipe } from '../../common/pipes/index.js'
import { type GenerateExerciseInput, GenerationService } from './generation.service.js'

const generateExerciseSchema = z.object({
  trackSlug: z.enum(['typescript', 'vue', 'react', 'node', 'go', 'rust', 'python']),
  conceptSlug: z.string().min(1).max(100),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced', 'expert']),
  topic: z.string().max(200).optional(),
})

@Controller('generation')
@UseGuards(AdminGuard)
export class GenerationController {
  constructor(private generationService: GenerationService) {}

  @Post('exercises')
  @UsePipes(createZodPipe(generateExerciseSchema))
  async queueExerciseGeneration(@Body() body: GenerateExerciseInput) {
    return { data: await this.generationService.queueExerciseGeneration(body) }
  }

  @Get('jobs/:jobId')
  async getJobStatus(@Param('jobId') jobId: string) {
    return { data: await this.generationService.getJobStatus(jobId) }
  }
}
