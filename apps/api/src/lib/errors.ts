export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function requireFound<T>(value: T | null): T {
  if (!value) throw new AppError(404, "Não encontramos esse registro.");
  return value;
}
