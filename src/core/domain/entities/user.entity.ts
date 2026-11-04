import { BaseEntity } from "./base.entity";

interface UserProps {
  email: string;
  name: string;
  image?: string;
  roles: UserRole[];
}

export enum UserRole {
  PATIENT = "PATIENT",
  PROFESSIONAL = "PROFESSIONAL",
  ADMIN = "ADMIN",
}

export class User extends BaseEntity<UserProps> {
  get email(): string { return this.props.email; }
  get name(): string { return this.props.name; }
  get image(): string | undefined { return this.props.image; }
  get roles(): UserRole[] { return this.props.roles; }

  public isAdmin(): boolean {
    return this.props.roles.includes(UserRole.ADMIN);
  }

  public isProfessional(): boolean {
    return this.props.roles.includes(UserRole.PROFESSIONAL);
  }

  public static create(props: UserProps, id: string, createdAt?: Date, updatedAt?: Date): User {
    return new User(props, id, createdAt, updatedAt);
  }
}
