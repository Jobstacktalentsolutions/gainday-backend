import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { SupportService } from './support.service';
import { CreateSupportMessageDto } from './dto/create-support-message.dto';

@Controller('support')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async submitSupportMessage(@Body() dto: CreateSupportMessageDto) {
    return this.supportService.createMessage(dto);
  }
}
