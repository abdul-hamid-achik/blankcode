import { Controller, Get, Param } from '@nestjs/common'
import { TracksService } from './tracks.service.js'
import { Public } from '../../common/decorators/index.js'

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
  async findBySlug(@Param('slug') slug: string) {
    return { data: await this.tracksService.findBySlug(slug) }
  }
}
