import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/client/index.js";
import { ALL_PERMISSIONS, SYSTEM_ROLES } from "../src/permissions.js";

const prisma = new PrismaClient();

const DEFAULT_STAGES = [
  { name: "Novo Lead", order: 0 },
  { name: "Contato", order: 1 },
  { name: "Resposta", order: 2 },
  { name: "Reunião", order: 3 },
  { name: "Proposta", order: 4 },
  { name: "Fechado", order: 5, isWon: true },
  { name: "Perdido", order: 6, isLost: true },
] as const;

async function main() {
  console.log("Seed: catálogo de permissões...");
  for (const key of ALL_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key },
      update: {},
      create: { key, description: key },
    });
  }

  console.log("Seed: organização MilWeb...");
  const org = await prisma.organization.upsert({
    where: { slug: "milweb" },
    update: {},
    create: { name: "MilWeb", slug: "milweb" },
  });

  console.log("Seed: papéis padrão...");
  for (const roleDef of SYSTEM_ROLES) {
    const role = await prisma.role.upsert({
      where: { organizationId_name: { organizationId: org.id, name: roleDef.name } },
      update: {},
      create: {
        organizationId: org.id,
        name: roleDef.name,
        description: roleDef.description,
        isSystem: true,
      },
    });

    const permissions = await prisma.permission.findMany({
      where: { key: { in: [...roleDef.permissions] } },
    });
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: permissions.map((p) => ({ roleId: role.id, permissionId: p.id })),
      skipDuplicates: true,
    });
  }

  console.log("Seed: usuário owner...");
  const ownerRole = await prisma.role.findFirstOrThrow({
    where: { organizationId: org.id, name: "Owner" },
  });
  if (process.env.NODE_ENV === "production" && !process.env.SEED_OWNER_PASSWORD) {
    throw new Error(
      "SEED_OWNER_PASSWORD é obrigatória em produção -- recusando criar um owner com a senha padrão de dev.",
    );
  }
  const seedPassword = process.env.SEED_OWNER_PASSWORD ?? "millead-dev-only";
  const passwordHash = await bcrypt.hash(seedPassword, 12);
  const owner = await prisma.user.upsert({
    where: { email: "rick@milweb.com.br" },
    update: {},
    create: {
      email: "rick@milweb.com.br",
      name: "Rick",
      passwordHash,
    },
  });
  await prisma.membership.upsert({
    where: { userId_organizationId: { userId: owner.id, organizationId: org.id } },
    update: {},
    create: {
      userId: owner.id,
      organizationId: org.id,
      roleId: ownerRole.id,
      status: "ACTIVE",
      joinedAt: new Date(),
    },
  });

  console.log("Seed: pipeline padrão...");
  const pipeline = await prisma.pipeline.upsert({
    where: { id: `${org.id}-default-pipeline` },
    update: {},
    create: {
      id: `${org.id}-default-pipeline`,
      organizationId: org.id,
      name: "Prospecção MilWeb",
      isDefault: true,
    },
  });
  for (const stage of DEFAULT_STAGES) {
    await prisma.pipelineStage.upsert({
      where: { pipelineId_order: { pipelineId: pipeline.id, order: stage.order } },
      update: {},
      create: {
        organizationId: org.id,
        pipelineId: pipeline.id,
        name: stage.name,
        order: stage.order,
        isWon: "isWon" in stage ? stage.isWon : false,
        isLost: "isLost" in stage ? stage.isLost : false,
      },
    });
  }

  console.log(
    `Seed concluído. Login: rick@milweb.com.br / senha: ${seedPassword} (defina SEED_OWNER_PASSWORD em produção).`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
