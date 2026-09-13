import { Injectable } from '@nestjs/common';
import { RoleCategory } from '../../generation/roles/role-category.enum';
import { RoleAnchorConfig } from './anchor-role-config.interface';
import { FINANCE_ANCHOR_CONFIG } from './finance.anchor-config';
import { SALES_ANCHOR_CONFIG } from './sales.anchor-config';

export class UnregisteredAnchorRoleCategoryError extends Error {
  constructor(category: string) {
    super(`No anchor role config is registered for category "${category}".`);
    this.name = 'UnregisteredAnchorRoleCategoryError';
  }
}

/** Resolves a question_bank.category string (e.g. "Sales > SDR") to its anchor/grading config.
 *  Same exact-then-'>'-prefix-fallback resolution as generation's RoleRegistry, kept as an
 *  independent implementation here rather than a shared dependency — grading is deliberately
 *  decoupled from the generation module (see README.md). */
@Injectable()
export class AnchorRoleRegistry {
  private readonly configs = new Map<string, RoleAnchorConfig>([
    [this.normalize(RoleCategory.FINANCE), FINANCE_ANCHOR_CONFIG],
    [this.normalize(RoleCategory.SALES), SALES_ANCHOR_CONFIG],
  ]);

  resolve(category: string): RoleAnchorConfig {
    const exact = this.configs.get(this.normalize(category));
    if (exact) return exact;

    const parts = category.split('>').map((p) => p.trim());
    for (let i = parts.length - 1; i > 0; i--) {
      const candidate = parts.slice(0, i).join(' > ');
      const found = this.configs.get(this.normalize(candidate));
      if (found) return found;
    }

    throw new UnregisteredAnchorRoleCategoryError(category);
  }

  private normalize(key: string): string {
    return key.trim().toLowerCase();
  }
}
