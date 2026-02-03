import { Module } from '@nestjs/common'
import { ExercisesController, ExercisesByIdController } from './exercises.controller.js'
import { ExercisesService } from './exercises.service.js'

@Module({
  controllers: [ExercisesController, ExercisesByIdController],
  providers: [ExercisesService],
  exports: [ExercisesService],
})
export class ExercisesModule {}
