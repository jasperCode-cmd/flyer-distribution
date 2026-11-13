// Where a client's route report lives. Pure.

export function reportPath(token: string): string {
  return `/route-report/${token}`;
}
