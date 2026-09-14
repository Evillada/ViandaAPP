export class Email {
  private readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  public static create(value: string): Email {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      throw new Error(`Invalid email: ${value}`);
    }
    return new Email(value.toLowerCase().trim());
  }

  public getValue(): string {
    return this.value;
  }

  public equals(other: Email): boolean {
    return this.value === other.value;
  }
}
