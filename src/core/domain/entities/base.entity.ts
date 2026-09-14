export abstract class BaseEntity<T> {
  protected readonly props: T;
  public readonly id: string;
  public readonly createdAt: Date;
  public readonly updatedAt: Date;

  constructor(props: T, id: string, createdAt?: Date, updatedAt?: Date) {
    this.props = props;
    this.id = id;
    this.createdAt = createdAt ?? new Date();
    this.updatedAt = updatedAt ?? new Date();
  }

  public equals(entity: BaseEntity<T>): boolean {
    return this.id === entity.id;
  }
}
