import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { ChainOverviewDto, ChainTickDto } from '@jpt/shared';
import { CurrentAuth, RequirePermissions, Staff } from '../auth/decorators';
import type { AuthContext } from '../common/request-context';
import { TokenizationService } from './tokenization.service';

@ApiTags('admin')
@Staff()
@Controller('admin')
export class ChainController {
  constructor(private readonly tokenization: TokenizationService) {}

  @Get('chain')
  @RequirePermissions('token:operate')
  @ApiOperation({ summary: 'Token contracts, allocation queue and last reconciliation per offering' })
  overview(): Promise<ChainOverviewDto> {
    return this.tokenization.overview();
  }

  @Post('chain/tick')
  @HttpCode(200)
  @RequirePermissions('token:operate')
  @ApiOperation({ summary: 'Run the allocation worker now (it also runs on a timer)' })
  tick(): Promise<ChainTickDto> {
    return this.tokenization.tick();
  }

  @Post('offerings/:id/contract')
  @HttpCode(201)
  @RequirePermissions('token:operate')
  @ApiOperation({ summary: 'Deploy the token contracts for an offering on the configured chain (simulated by default)' })
  deploy(@CurrentAuth() auth: AuthContext, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.tokenization.deploy(auth, id);
  }

  @Post('chain/allocations/:id/retry')
  @HttpCode(204)
  @RequirePermissions('token:operate')
  retry(@CurrentAuth() auth: AuthContext, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.tokenization.retry(auth, id);
  }
}
