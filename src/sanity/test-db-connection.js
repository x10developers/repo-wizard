/**
 * Test database connection and repository existence
 */

import { prisma } from "./lib/prisma.js";

async function testConnection() {
  console.log("🧪 Testing database connection...\n");

  try {
    // Test 1: Basic connection
    console.log("Test 1: Connecting to database...");
    await prisma.$connect();
    console.log("✅ Connected to database\n");

    // Test 2: Count reminders
    console.log("Test 2: Counting reminders...");
    const reminderCount = await prisma.reminders.count();
    console.log(`✅ Found ${reminderCount} reminders\n`);

    // Test 3: List all repositories
    console.log("Test 3: Listing repositories...");
    const repos = await prisma.repositories.findMany({
      select: {
        id: true,
        full_name: true,
        is_active: true,
      },
    });
    
    if (repos.length === 0) {
      console.log("⚠️  NO REPOSITORIES FOUND!");
      console.log("This is likely why reminders fail to save.\n");
      console.log("You need to add your repository first:");
      console.log(`
INSERT INTO repositories (id, full_name, owner_id, is_active, created_at)
VALUES (
  'your-username/your-repo',
  'your-username/your-repo',
  'user_test',
  true,
  NOW()
);
      `);
    } else {
      console.log(`✅ Found ${repos.length} repositories:`);
      repos.forEach(repo => {
        console.log(`   - ${repo.full_name} (active: ${repo.is_active})`);
      });
    }
    console.log();

    // Test 4: Try creating a test reminder
    console.log("Test 4: Creating test reminder...");
    
    if (repos.length > 0) {
      const testReminder = await prisma.reminders.create({
        data: {
          id: crypto.randomUUID(),
          repo_id: repos[0].id, // Use first available repo
          issue_number: 999,
          message: "Test reminder",
          scheduled_at: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
          status: "pending",
          retry_count: 0,
        },
      });
      
      console.log("✅ Test reminder created!");
      console.log("   ID:", testReminder.id);
      console.log("   Repo:", testReminder.repo_id);
      console.log("   Issue:", testReminder.issue_number);
      
      // Clean up test reminder
      await prisma.reminders.delete({
        where: { id: testReminder.id },
      });
      console.log("✅ Test reminder cleaned up\n");
    } else {
      console.log("⚠️  Skipping test reminder (no repositories available)\n");
    }

    console.log("🎉 All tests passed!");
    
  } catch (error) {
    console.error("\n❌ Test failed!");
    console.error("Error:", error.message);
    console.error("\nFull error:", error);
    
    if (error.code === 'P2002') {
      console.error("\n⚠️  Unique constraint violation - duplicate data");
    } else if (error.code === 'P2003') {
      console.error("\n⚠️  Foreign key constraint failed");
      console.error("This means the repository doesn't exist in the database!");
    } else if (error.code === 'P1001') {
      console.error("\n⚠️  Can't reach database server");
      console.error("Check your DATABASE_URL in .env");
    }
    
  } finally {
    await prisma.$disconnect();
  }
}

// Need crypto for UUID
import crypto from "crypto";

testConnection();