import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class ParseFloatPipe implements PipeTransform<string, number> {
    transform(value: string): number {
        const val = parseFloat(value);
        if (isNaN(val)) {
            throw new BadRequestException(`Validation failed. "${value}" is not a float number.`);
        }
        return val;
    }
}
