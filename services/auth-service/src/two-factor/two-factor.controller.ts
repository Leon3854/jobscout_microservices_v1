import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TwoFactorService } from './two-factor.service';
import { TwoFactorVerifyDto } from '../auth/dto/two-factor.dto';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';

@ApiTags('2fa')
@Controller('2fa')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class TwoFactorController {
  constructor(private readonly twoFactorService: TwoFactorService) {}

  @Post('setup')
  @ApiOperation({ summary: 'Generate 2FA secret' })
  @ApiResponse({ status: 200, description: 'Secret generated' })
  async setup(@Req() req: any) {
    return this.twoFactorService.generateSecret(req.user.id);
  }

  @Post('enable')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Enable 2FA' })
  @ApiResponse({ status: 200, description: '2FA enabled' })
  async enable(@Req() req: any, @Body() body: TwoFactorVerifyDto) {
    const enabled = await this.twoFactorService.enable(req.user.id, body.code);
    return { enabled };
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify 2FA code' })
  @ApiResponse({ status: 200, description: 'Code is valid' })
  async verify(@Req() req: any, @Body() body: TwoFactorVerifyDto) {
    const valid = await this.twoFactorService.verify(req.user.id, body.code);
    return { valid };
  }

  @Post('disable')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Disable 2FA' })
  @ApiResponse({ status: 200, description: '2FA disabled' })
  async disable(@Req() req: any) {
    await this.twoFactorService.disable(req.user.id);
    return { disabled: true };
  }
}
