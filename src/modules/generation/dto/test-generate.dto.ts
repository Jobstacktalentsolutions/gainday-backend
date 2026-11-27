import { IsArray, IsIn, IsOptional, IsString, IsNotEmpty } from 'class-validator';
import { SKILL_LEVEL } from '../../../common/skill-level';

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

  /** Defaults to mid level, as a job saved without a level does. */
  @IsOptional()
  @IsIn(Object.values(SKILL_LEVEL))
  skillLevel?: string;

  /** Omit to let the pipeline infer the role from the description. */
  @IsOptional()
  @IsString()
  role?: string;
}
