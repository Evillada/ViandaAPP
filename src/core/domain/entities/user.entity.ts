import { BaseEntity } from "./base.entity";

interface UserProps {
  email: string;
  name: string;
  image?: string;
  role: UserRole;
}

export enum UserRole {
  ADMIN = "ADMIN",
  USER = "USER",
  PROFESSIONAL = "PROFESSIONAL",
}

export class User extends BaseEntity<UserProps> {
  get email(): string { return this.props.email; }
  get name(): string { return this.props.name; }
  get image(): string | undefined { return this.props.image; }
  get role(): UserRole { return this.props.role; }

  public isAdmin(): boolean {
    return this.props.role === UserRole.ADMIN;
  }

  public isProfessional(): boolean {
    return this.props.role === UserRole.PROFESSIONAL;
  }

  public static create(props: UserProps, id: string, createdAt?: Date, updatedAt?: Date): User {
    return new User(props, id, createdAt, updatedAt);
  }
}
