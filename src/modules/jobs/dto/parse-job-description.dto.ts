import { IsString, MinLength } from 'class-validator';

export class ParseJobDescriptionDto {
  @IsString()
  @MinLength(40, {
    message: 'Give at least 40 characters so Gainday has enough to work with',
  })
  rawText: string;
}
