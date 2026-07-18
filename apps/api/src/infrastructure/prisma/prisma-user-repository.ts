import { prisma } from "@millead/database";
import type { User } from "../../domain/entities/user.js";
import type { CreateUserInput, UserRepository } from "../../domain/repositories/user-repository.js";

export class PrismaUserRepository implements UserRepository {
  async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { email } });
  }

  async findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { id } });
  }

  async create(input: CreateUserInput): Promise<User> {
    return prisma.user.create({ data: input });
  }

  async touchLastLogin(id: string): Promise<void> {
    await prisma.user.update({ where: { id }, data: { lastLoginAt: new Date() } });
  }

  async updateName(id: string, name: string): Promise<User> {
    return prisma.user.update({ where: { id }, data: { name } });
  }
}
