import { ApiProperty } from '@nestjs/swagger';
import { IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class ConfigItem {
    @ApiProperty()
    @IsString()
    key: string;

    @ApiProperty()
    @IsString()
    value: string;
}

export class ImportConfigDto {
    @ApiProperty({ type: [ConfigItem] })
    @ValidateNested({ each: true })
    @Type(() => ConfigItem)
    items: ConfigItem[];
    @ApiProperty({ description: 'Version of the configuration' })
    @IsString()
    @Type(() => String)
    version: string;
}

