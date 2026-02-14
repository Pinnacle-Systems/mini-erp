import { prisma } from "../src/lib/prisma.js";
import * as argon2 from "argon2";

const seed = async () => {
  const passwordHash = await argon2.hash("admin");

  const superAdmin = await prisma.identity.upsert({
    where: { email: "admin@mystore.com" },
    update: {
      password_hash: passwordHash,
    },
    create: {
      name: "Admin User",
      email: "admin@mystore.com",
      password_hash: passwordHash,
      system_role: "PLATFORM_ADMIN",
    },
  });

  console.log("Super admin: ", superAdmin);
};

try {
  await seed();
} catch (err) {
  console.error(err);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
