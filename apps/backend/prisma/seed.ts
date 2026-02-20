import { prisma } from "../src/lib/prisma.js";
import * as argon2 from "argon2";

const seed = async () => {
  const passwordHash = await argon2.hash("admin");
  const adminPhone = "1234567890";

  const superAdmin = await prisma.identity.upsert({
    where: { phone: adminPhone },
    update: {
      email: "admin@mystore.com",
      password_hash: passwordHash,
    },
    create: {
      name: "Admin User",
      phone: adminPhone,
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
