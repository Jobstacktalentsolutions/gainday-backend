import { Injectable } from '@nestjs/common';
import {
  RoleModule,
  UnregisteredRoleCategoryError,
} from './role-module.interface';
import { FinanceRoleModule } from './finance/finance.role-module';
import { SalesRoleModule } from './sales/sales.role-module';

@Injectable()
export class RoleRegistry {
  private readonly modules = new Map<string, RoleModule>();

  constructor() {
    this.register(FinanceRoleModule);
    this.register(SalesRoleModule);
  }

  register(module: RoleModule): void {
    for (const key of module.categoryKeys) {
      this.modules.set(this.normalize(key), module);
    }
  }

  /**
   * Exact match first, then '>'-delimited prefix fallback from most- to least-specific,
   * e.g. "Sales > SDR" falls back to "Sales" if no module is registered for the sub-role.
   */
  resolve(category: string): RoleModule {
    const exact = this.modules.get(this.normalize(category));
    if (exact) return exact;

    const parts = category.split('>').map((p) => p.trim());
    for (let i = parts.length - 1; i > 0; i--) {
      const candidate = parts.slice(0, i).join(' > ');
      const found = this.modules.get(this.normalize(candidate));
      if (found) return found;
    }

    throw new UnregisteredRoleCategoryError(category);
  }

  private normalize(key: string): string {
    return key.trim().toLowerCase();
  }
}
