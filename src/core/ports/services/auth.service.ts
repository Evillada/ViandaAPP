import { User } from "@/core/domain/entities";

export interface IAuthService {
  getCurrentUser(): Promise<User | null>;
  signIn(email: string, password: string): Promise<User>;
  signOut(): Promise<void>;
}
