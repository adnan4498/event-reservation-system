export interface FieldValidationError {
  field: string;
  message: string;
}

export class AppError extends Error {
  statusCode: number;
  errors?: FieldValidationError[] | undefined;

  constructor(
    message: string,
    statusCode: number,
    errors?: FieldValidationError[] | undefined,
  ) {
    super(message);

    this.statusCode = statusCode;
    this.errors = errors;

    Error.captureStackTrace(this, this.constructor);
  }
}
