
// ================================================================
// FILE 3: src/utils/repository.helper.js
// ================================================================

import { prisma } from "../lib/prisma.js";
import { safeDbOperation } from "./errors.js";

/**
 * Ensure repository exists in database
 * Creates user/org and repository if needed
 */
export async function ensureRepositoryExists(payload) {
  const repoFullName = payload.repository.full_name;
  const owner = payload.repository.owner.login;
  const ownerType = payload.repository.owner.type.toLowerCase();

  console.log(`[Repository] Ensuring ${repoFullName} exists...`);

  return await safeDbOperation(async () => {
    // Check if repo exists
    const existing = await prisma.repositories.findUnique({
      where: { id: repoFullName },
    });

    if (existing) {
      console.log(`[Repository] ✅ Repository exists: ${repoFullName}`);
      return existing;
    }

    console.log(`[Repository] Creating new repository...`);

    // Use transaction for atomic user + repo creation
    const result = await prisma.$transaction(async (tx) => {
      // Ensure user/org exists
      await tx.users.upsert({
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

      // Create repository
      const repo = await tx.repositories.create({
        data: {
          id: repoFullName,
          full_name: repoFullName,
          owner_id: owner,
          is_active: true,
          created_at: new Date(),
        },
      });

      return repo;
    });

    console.log(`[Repository] ✅ Repository created: ${repoFullName}`);
    return result;
  });
}
