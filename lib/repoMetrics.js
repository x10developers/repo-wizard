import { prisma } from "./prisma.js";

export async function getRepoMetrics(repoId) {
  const [repo, reminders] = await Promise.all([
    prisma.repositories.findUnique({ where: { id: repoId } }),
    prisma.reminders.findMany({
      where: { repo_id: repoId },
      orderBy: { created_at: "desc" },
      take: 50
    })
  ]);

  return {
    repo,
    reminders
  };
}
