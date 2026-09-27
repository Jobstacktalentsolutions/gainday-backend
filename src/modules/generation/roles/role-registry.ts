import { Injectable, Logger } from '@nestjs/common';
import { RoleModule } from './role-module.interface';
import { FinanceRoleModule } from './finance/finance.role-module';
import { SalesRoleModule } from './sales/sales.role-module';
import { GenericRoleModule } from './generic/generic.role-module';

@Injectable()
export class RoleRegistry {
  private readonly logger = new Logger(RoleRegistry.name);
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

  /** All distinct registered role modules (deduped — a module may be registered under several
   *  category keys), plus the generic fallback module — used to build a taskType ->
   *  component-type lookup table for the frontend that also covers generic-category tasks. */
  getAllModules(): RoleModule[] {
    return [...new Set(this.modules.values()), GenericRoleModule];
  }

  /**
   * Exact match first, then '>'-delimited prefix fallback from most- to least-specific,
   * e.g. "Sales > SDR" falls back to "Sales" if no module is registered for the sub-role.
   *
   * Falls back to GenericRoleModule — rather than throwing — for any category with no purpose-
   * built module. The client wants any role supported, and a hand-authored module can't be
   * written ahead of time for every domain a job posting might name; the generic module trades
   * content precision for guaranteed coverage (text/markdown-only tasks, see its own doc comment)
   * instead of the pipeline failing outright for an unmodeled category.
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

    this.logger.log(
      `No role module registered for category "${category}" — falling back to GenericRoleModule.`,
    );
    return GenericRoleModule;
  }

  private normalize(key: string): string {
    return key.trim().toLowerCase();
  }
}
