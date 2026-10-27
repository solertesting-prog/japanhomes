import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import {
  AdminFinanceController,
  AdminOverviewController,
  AdminPropertiesController,
  AuditController,
  DistributionsController,
} from './admin.controllers';
import { AdminUsersController } from './admin-users.controller';
import { DistributionsService } from './distributions.service';

@Module({
  imports: [AuthModule, SubscriptionsModule],
  controllers: [
    AdminOverviewController,
    AdminUsersController,
    AdminPropertiesController,
    AdminFinanceController,
    DistributionsController,
    AuditController,
  ],
  providers: [DistributionsService],
})
export class AdminModule {}
