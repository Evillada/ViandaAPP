import { User } from "@/core/domain/entities";
import { IUserRepository } from "@/core/ports/repositories";

export class GetUserUseCase {
  constructor(private readonly userRepository: IUserRepository) {}

  async execute(id: string): Promise<User | null> {
    return this.userRepository.findById(id);
  }
}
