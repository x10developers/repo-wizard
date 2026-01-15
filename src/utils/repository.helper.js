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

  // ✅ Extract installation_id from webhook payload
  const installationId = payload.installation?.id || null;

  console.log(`[Repository] Ensuring ${repoFullName} exists...`);
  console.log(`[Repository] Installation ID from payload:`, installationId); // DEBUG

  if (!installationId) {
    console.error(`[Repository] ❌ WARNING: No installation_id in payload!`);
  }

  return await safeDbOperation(async () => {
    // Check if repo exists
    const existing = await prisma.repositories.findUnique({
      where: { id: repoFullName },
    });

    if (existing) {
      console.log(`[Repository] ✅ Repository exists: ${repoFullName}`);

      // ✅ Update installation_id if it changed or was missing
      if (installationId && existing.installation_id !== installationId) {
        await prisma.repositories.update({
          where: { id: repoFullName },
          data: { installation_id: installationId },
        });
        console.log(
          `[Repository] ✅ Updated installation_id: ${installationId}`
        );
      }

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

      // Create repository WITH installation_id
      const repo = await tx.repositories.create({
        data: {
          id: repoFullName,
          full_name: repoFullName,
          owner_id: owner,
          is_active: true,
          installation_id: installationId, // ✅ Store it!
          created_at: new Date(),
        },
      });

      return repo;
    });

    console.log(`[Repository] ✅ Repository created: ${repoFullName}`);
    if (installationId) {
      console.log(`[Repository] ✅ With installation_id: ${installationId}`);
    }

    return result;
  });
}

/**
 * Get installation_id for a repository
 * Used by reminder scheduler when posting comments
 */
export async function getInstallationId(repoFullName) {
  try {
    const repo = await prisma.repositories.findUnique({
      where: { id: repoFullName },
      select: { installation_id: true },
    });

    if (!repo) {
      throw new Error(`Repository ${repoFullName} not found in database`);
    }

    if (!repo.installation_id) {
      throw new Error(
        `PERMANENT: No installation_id for repository ${repoFullName}`
      );
    }

    return repo.installation_id;
  } catch (error) {
    console.error(`[Repository] Error getting installation_id:`, error.message);
    throw error;
  }
}
