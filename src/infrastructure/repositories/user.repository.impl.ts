import { User, UserRole } from "@/core/domain/entities";
import { IUserRepository } from "@/core/ports/repositories";
import { prisma } from "@/infrastructure/database/prisma";

export class UserRepositoryImpl implements IUserRepository {
  async findById(id: string): Promise<User | null> {
    const data = await prisma.user.findUnique({ where: { id } });
    if (!data) return null;
    return this.toDomain(data);
  }

  async findByEmail(email: string): Promise<User | null> {
    const data = await prisma.user.findUnique({ where: { email } });
    if (!data) return null;
    return this.toDomain(data);
  }

  async findAll(): Promise<User[]> {
    const data = await prisma.user.findMany();
    return data.map((d) => this.toDomain(d));
  }

  async create(user: User): Promise<User> {
    const data = await prisma.user.create({
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        roles: user.roles,
      },
    });
    return this.toDomain(data);
  }

  async update(user: User): Promise<User> {
    const data = await prisma.user.update({
      where: { id: user.id },
      data: {
        email: user.email,
        name: user.name,
        image: user.image,
        roles: user.roles,
      },
    });
    return this.toDomain(data);
  }

  async delete(id: string): Promise<void> {
    await prisma.user.delete({ where: { id } });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private toDomain(data: any): User {
    return User.create(
      {
        email: data.email,
        name: data.name ?? "",
        image: data.image ?? undefined,
        roles: (data.roles as UserRole[]) ?? [],
      },
      data.id,
      data.createdAt,
      data.updatedAt
    );
  }
}
