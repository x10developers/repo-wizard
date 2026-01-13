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
      isConnected = false;
      throw error;
    } finally {
      connectionPromise = null;
    }
  })();

  await connectionPromise;
}

/**
 * Reset connection flag (for when connection is lost)
 */
export function resetConnection() {
  isConnected = false;
  connectionPromise = null;
}

// Auto-connect on import
ensurePrismaConnection();

// Handle disconnection
prisma.$on('beforeExit', async () => {
  isConnected = false;
});

// Graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
  isConnected = false;
});

// Reconnect on SIGTERM
process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  isConnected = false;
});

export { prisma, ensurePrismaConnection };