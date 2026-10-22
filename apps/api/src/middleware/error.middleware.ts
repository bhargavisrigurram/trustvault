import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { config } from '../config/index.js';

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Handle Zod schema validation errors
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input data',
        details: err.errors.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
        })),
      },
    });
    return;
  }

  // Handle CORS errors
  if (err.message && err.message.includes('CORS request rejected')) {
    res.status(403).json({
      success: false,
      error: {
        code: 'CORS_ERROR',
        message: 'Cross-origin request blocked by security policy',
      },
    });
    return;
  }

  // Handle Payload Too Large
  if (err.type === 'entity.too.large') {
    res.status(413).json({
      success: false,
      error: {
        code: 'PAYLOAD_TOO_LARGE',
        message: 'Request entity exceeds allowed size limit',
      },
    });
    return;
  }

  // Log unexpected errors securely without leaking sensitive values
  console.error('[Internal Error]:', {
    method: req.method,
    path: req.path,
    message: err.message,
    ...(config.env === 'development' ? { stack: err.stack } : {}),
  });

  const statusCode = typeof err.statusCode === 'number' ? err.statusCode : 500;
  res.status(statusCode).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message:
        statusCode === 500 && config.env === 'production'
          ? 'An unexpected error occurred'
          : err.message || 'Internal server error',
    },
  });
}
