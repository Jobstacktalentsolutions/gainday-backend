export class InsufficientCreditsError extends Error {
  constructor(
    readonly balance: number,
    readonly needed: number,
  ) {
    super(`Insufficient credits: ${needed} needed, ${balance} available`);
  }

  get shortfall(): number {
    return this.needed - this.balance;
  }
}
