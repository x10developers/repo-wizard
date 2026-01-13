/**
 * Auto-create repository and user if they don't exist
 * Add this to your mention.handler.js
 */

import { prisma } from "../lib/prisma.js";

/**
 * Ensure repository exists in database
 * Creates user/org and repository if needed
 */
export async function ensureRepositoryExists(payload) {
  const repoFullName = payload.repository.full_name;
  const owner = payload.repository.owner.login;
  const ownerType = payload.repository.owner.type.toLowerCase(); // 'user' or 'organization'

  console.log(`[Repository] Checking if ${repoFullName} exists...`);

  try {
    // Check if repo exists
    const existing = await prisma.repositories.findUnique({
      where: { id: repoFullName },
    });

    if (existing) {
      console.log(`[Repository] ✅ Repository exists: ${repoFullName}`);
      return existing;
    }

    console.log(`[Repository] Repository not found, creating...`);

    // Step 1: Ensure user/org exists
    await prisma.users.upsert({
      where: { id: owner },
      update: {
        username: owner,
        type: ownerType,
      },
      create: {
        id: owner,
        username: owner,
        type: ownerType,
        created_at: new Date(),
      },
    });

    console.log(`[Repository] ✅ User/org ensured: ${owner}`);

    // Step 2: Create repository
    const repo = await prisma.repositories.create({
      data: {
        id: repoFullName,
        full_name: repoFullName,
        owner_id: owner,
        is_active: true,
        created_at: new Date(),
      },
    });

    console.log(`[Repository] ✅ Repository created: ${repoFullName}`);
    return repo;

  } catch (error) {
    console.error(`[Repository] ❌ Failed to ensure repository:`, error);
    throw error;
  }
}