import bcrypt from "bcryptjs";
import { PrismaClient, type Prisma } from "../src/generated/client/index.js";
import { ALL_PERMISSIONS, SYSTEM_ROLES } from "../src/permissions.js";
import { BRIEFING_TEMPLATES, type FieldSeed } from "./seed-data/briefing-templates.js";

const prisma = new PrismaClient();

/**
 * Upsert em cascata Template -> Section -> Field. Campos-filho de um GROUP
 * vão num segundo passe: só existe `parentFieldId` depois que o campo pai
 * já tem `id` gravado.
 */
async function seedBriefingTemplates() {
  for (const tpl of BRIEFING_TEMPLATES) {
    const template = await prisma.briefingTemplate.upsert({
      where: { key: tpl.key },
      update: { name: tpl.name, description: tpl.description, kind: tpl.kind },
      create: {
        key: tpl.key,
        kind: tpl.kind,
        name: tpl.name,
        description: tpl.description,
      },
    });

    for (const [sectionOrder, section] of tpl.sections.entries()) {
      const dbSection = await prisma.briefingSection.upsert({
        where: { templateId_key: { templateId: template.id, key: section.key } },
        update: { title: section.title, description: section.description, order: sectionOrder },
        create: {
          templateId: template.id,
          key: section.key,
          title: section.title,
          description: section.description,
          order: sectionOrder,
        },
      });

      const pendingGroups: { parentFieldId: string; parentKey: string; children: FieldSeed[] }[] =
        [];

      for (const [fieldOrder, field] of section.fields.entries()) {
        const dbField = await prisma.briefingField.upsert({
          where: { sectionId_key: { sectionId: dbSection.id, key: field.key } },
          update: {
            label: field.label,
            type: field.type,
            order: fieldOrder,
            required: field.required ?? false,
            helpText: field.helpText,
            config: field.config as Prisma.InputJsonValue | undefined,
          },
          create: {
            sectionId: dbSection.id,
            key: field.key,
            label: field.label,
            type: field.type,
            order: fieldOrder,
            required: field.required ?? false,
            helpText: field.helpText,
            config: field.config as Prisma.InputJsonValue | undefined,
          },
        });

        if (field.children?.length) {
          pendingGroups.push({
            parentFieldId: dbField.id,
            parentKey: field.key,
            children: field.children,
          });
        }
      }

      // segundo passe: campos-filho de GROUP, agora que o pai tem id.
      // Key namespaceada "<pai>.<filho>" (ex.: "servicos.nome") -- garante
      // unicidade em @@unique([sectionId, key]) mesmo se outro campo de
      // topo (ou outro GROUP) usar a mesma key de filho no futuro.
      for (const { parentFieldId, parentKey, children } of pendingGroups) {
        for (const [childOrder, child] of children.entries()) {
          const childKey = `${parentKey}.${child.key}`;
          await prisma.briefingField.upsert({
            where: { sectionId_key: { sectionId: dbSection.id, key: childKey } },
            update: {
              label: child.label,
              type: child.type,
              order: childOrder,
              required: child.required ?? false,
              helpText: child.helpText,
              config: child.config as Prisma.InputJsonValue | undefined,
              parentFieldId,
            },
            create: {
              sectionId: dbSection.id,
              parentFieldId,
              key: childKey,
              label: child.label,
              type: child.type,
              order: childOrder,
              required: child.required ?? false,
              helpText: child.helpText,
              config: child.config as Prisma.InputJsonValue | undefined,
            },
          });
        }
      }
    }
  }
}

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
  // Guard: recusar a senha padrão sempre que o banco alvo NÃO for local. Olhar
  // só o NODE_ENV do processo não basta -- em dev a `DATABASE_URL` pode
  // apontar pra nuvem (Supabase), e aí o seed criaria `rick@milweb.com.br`
  // com uma senha pública do repositório num banco alcançável pela API de
  // produção. A URL do banco é a fonte de verdade do alvo.
  const dbUrl = process.env.DATABASE_URL ?? "";
  const targetsLocalDb = /@(localhost|127\.0\.0\.1|host\.docker\.internal|db|postgres)[:/]/.test(
    dbUrl,
  );
  if (
    !process.env.SEED_OWNER_PASSWORD &&
    (process.env.NODE_ENV === "production" || !targetsLocalDb)
  ) {
    throw new Error(
      "SEED_OWNER_PASSWORD é obrigatória quando o banco alvo não é local -- recusando criar um " +
        "owner com a senha padrão de dev (pública no repositório) num banco de nuvem/produção.",
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

  console.log("Seed: templates de briefing...");
  await seedBriefingTemplates();

  // Não imprime a senha (vazaria em logs de CI). Só mostra a origem dela.
  const passwordSource = process.env.SEED_OWNER_PASSWORD
    ? "SEED_OWNER_PASSWORD"
    : "padrão de dev (millead-dev-only)";
  console.log(`Seed concluído. Login: rick@milweb.com.br / senha: [${passwordSource}].`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
