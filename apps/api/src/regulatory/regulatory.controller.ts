import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/decorators';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { REGULATED_MODULES, resolveAllModules } from '@jpt/shared';

@ApiTags('regulatory')
@Public()
@Controller('regulatory')
export class RegulatoryController {
  @Get('modules')
  @ApiOperation({ summary: 'Which regulated capabilities are active in this environment and why' })
  modules() {
    const states = resolveAllModules(process.env);
    return Object.values(states).map((s) => ({
      module: s.module,
      tier: s.tier,
      enabled: s.enabled,
      reason: s.reason,
      description: REGULATED_MODULES[s.module].description,
      // The approval reference itself is internal; expose only whether one exists.
      hasApprovalReference: s.approvalReference !== null,
    }));
  }
}
