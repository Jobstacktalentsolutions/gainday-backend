import { IsOptional, IsString, IsNotEmpty, MinLength } from 'class-validator';
import { PaginationQueryDto } from './pagination-query.dto';

export class ListSupportMessagesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  status?: string;
}

export class UpdateSupportStatusDto {
  @IsNotEmpty()
  @IsString()
  status: string;
}

export class ReplySupportMessageDto {
  @IsNotEmpty()
  @IsString()
  @MinLength(5, { message: 'Reply message must be at least 5 characters long' })
  replyMessage: string;

  @IsOptional()
  @IsString()
  markStatus?: string;
}
