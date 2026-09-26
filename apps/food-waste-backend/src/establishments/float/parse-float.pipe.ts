import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

import { appError } from '../../common/errors';
@Injectable()
export class ParseFloatPipe implements PipeTransform<string, number> {
  transform(value: string): number {
    const val = parseFloat(value);
    if (isNaN(val)) {
      throw new BadRequestException(appError('INVALID_NUMBER'));
    }
    return val;
  }
}
