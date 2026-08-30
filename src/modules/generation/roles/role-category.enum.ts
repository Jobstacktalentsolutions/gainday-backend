/**
 * Top-level role-routing key (doc Section 2.2/3: the extracted Category field routes to a
 * role module). This enumerates only the top-level key each role module registers under —
 * sub-domain granularity (e.g. "Finance > Reconciliation", "Sales > SDR") stays free text
 * appended after ">", since the LLM extracts that per job and it can't be enumerated ahead
 * of time without constraining extraction to a fixed list.
 *
 * Add a value here when registering a new role module's top-level categoryKey.
 */
export enum RoleCategory {
  FINANCE = 'Finance',
  SALES = 'Sales',
}
