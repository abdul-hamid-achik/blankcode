import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common'
import { ZodSchema, ZodError } from 'zod'

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: unknown) {
    const result = this.schema.safeParse(value)
    if (!result.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: result.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      })
    }
    return result.data
  }
}

export function createZodPipe<T>(schema: ZodSchema<T>) {
  return new ZodValidationPipe(schema)
}
