/** Settlement includes recorded exemptions; partial payment remains unsettled. */
export function isStudentSettled(remaining: number): boolean {
  return remaining <= 0;
}