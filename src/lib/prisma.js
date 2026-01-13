
// ================================================================
// FILE 1: src/lib/prisma.js
// ================================================================

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  log: ['error', 'warn'],
  errorFormat: 'minimal',
});

// Connection state tracking
let isConnected = false;
let connectionPromise = null;

/**
 * Ensure Prisma is connected before operations
 * Prevents "Engine is not yet connected" errors
 */
async function ensurePrismaConnection() {
  if (isConnected) return;
  
  if (connectionPromise) {
    await connectionPromise;
    return;
  }

  connectionPromise = (async () => {
    try {
      await prisma.$connect();
      isConnected = true;
      console.log('[Prisma] ✅ Database connected');
    } catch (error) {
      console.error('[Prisma] ❌ Connection failed:', error.message);
      throw error;
    } finally {
      connectionPromise = null;
    }
  })();

  await connectionPromise;
}

// Auto-connect on import
ensurePrismaConnection();

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
  isConnected = false;
});

export { prisma, ensurePrismaConnection };
