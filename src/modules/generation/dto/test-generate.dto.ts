import { IsArray, IsOptional, IsString, IsNotEmpty } from 'class-validator';

export class TestGenerateDto {
  @IsString()
  @IsNotEmpty()
  description: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requiredSkills?: string[];

  @IsOptional()
  @IsString()
  businessProblem?: string;
}
