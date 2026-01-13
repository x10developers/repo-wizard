export class AppError extends Error {
  constructor(message, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();
    Error.captureStackTrace(this, this.constructor);
  }
}

export class DatabaseError extends AppError {
  constructor(message, originalError = null) {
    super(message, 500, true);
    this.name = 'DatabaseError';
    this.originalError = originalError;
  }
}

export class GitHubAPIError extends AppError {
  constructor(message, statusCode = 500) {
    super(message, statusCode, true);
    this.name = 'GitHubAPIError';
  }
}

export class ValidationError extends AppError {
  constructor(message) {
    super(message, 400, true);
    this.name = 'ValidationError';
  }
}

/**
 * Async wrapper to catch errors in route handlers
 */
export const asyncHandler = (fn) => {
  return async (req, res, next) => {
    try {
      await fn(req, res, next);
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Retry logic for transient failures
 */
export async function withRetry(
  operation,
  maxRetries = 3,
  delayMs = 1000,
  backoffMultiplier = 2
) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      // Don't retry operational errors (validation, permissions, etc.)
      if (error.isOperational && error.statusCode < 500) {
        throw error;
      }
      
      if (attempt < maxRetries) {
        const delay = delayMs * Math.pow(backoffMultiplier, attempt - 1);
        console.log(`[Retry] Attempt ${attempt} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw new AppError(
    `Operation failed after ${maxRetries} attempts: ${lastError.message}`,
    500,
    false
  );
}

/**
 * Safe database operation wrapper with auto-reconnect
 */
export async function safeDbOperation(operation, fallbackValue = null) {
  const { ensurePrismaConnection, resetConnection } = await import("../lib/prisma.js");
  
  let retries = 3;
  let lastError;
  
  while (retries > 0) {
    try {
      await ensurePrismaConnection();
      return await operation();
    } catch (error) {
      lastError = error;
      
      // If connection error, reset and retry
      if (error.message?.includes('Engine is not yet connected') || 
          error.message?.includes('Response from the Engine was empty') ||
          error.message?.includes('Connection is not yet established')) {
        retries--;
        if (retries > 0) {
          console.log(`[DB] Connection lost, retrying... (${retries} attempts left)`);
          resetConnection(); // Reset connection flag
          await new Promise(resolve => setTimeout(resolve, 500));
          continue;
        }
      }
      
      // Handle specific Prisma errors
      if (error.code === 'P2002') {
        throw new ValidationError('Resource already exists');
      }
      if (error.code === 'P2025') {
        throw new ValidationError('Resource not found');
      }
      if (error.code === 'P2003') {
        throw new ValidationError('Foreign key constraint failed');
      }
      
      break;
    }
  }
  
  console.error('[DB Error]', lastError.message);
  throw new DatabaseError('Database operation failed', lastError);
}