import type { TrackSlug } from '@blankcode/shared'
import { Controller, Get, Param } from '@nestjs/common'
import { Public } from '../../common/decorators/index.js'
import type { TracksService } from './tracks.service.js'

@Controller('tracks')
export class TracksController {
  constructor(private tracksService: TracksService) {}

  @Public()
  @Get()
  async findAll() {
    return { data: await this.tracksService.findAll() }
  }

  @Public()
  @Get(':slug')
  async findBySlug(@Param('slug') slug: TrackSlug) {
    return { data: await this.tracksService.findBySlug(slug) }
  }
}
