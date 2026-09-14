import { IUserRepository } from "@/core/ports/repositories";
import { UserRepositoryImpl } from "@/infrastructure/repositories";
import { GetUserUseCase } from "@/core/use-cases";

// Simple dependency injection container
class Container {
  private static instance: Container;

  // Repositories
  readonly userRepository: IUserRepository;

  // Use Cases
  readonly getUserUseCase: GetUserUseCase;

  private constructor() {
    // Wire repositories
    this.userRepository = new UserRepositoryImpl();

    // Wire use cases
    this.getUserUseCase = new GetUserUseCase(this.userRepository);
  }

  static getInstance(): Container {
    if (!Container.instance) {
      Container.instance = new Container();
    }
    return Container.instance;
  }
}

export const container = Container.getInstance();
