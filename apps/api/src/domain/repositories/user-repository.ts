import type { User } from "../entities/user.js";

export interface CreateUserInput {
  email: string;
  passwordHash: string;
  name: string;
}

export interface UserRepository {
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  create(input: CreateUserInput): Promise<User>;
  touchLastLogin(id: string): Promise<void>;
  updateName(id: string, name: string): Promise<User>;
  updatePassword(id: string, passwordHash: string): Promise<void>;
}
