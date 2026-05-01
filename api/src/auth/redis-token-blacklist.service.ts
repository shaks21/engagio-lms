import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Redis } from "ioredis";

@Injectable()
export class RedisTokenBlacklistService {
  private readonly redis: Redis;
  private readonly logger = new Logger(RedisTokenBlacklistService.name);

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>("REDIS_HOST", "localhost");
    const port = this.config.get<number>("REDIS_PORT", 6379);
    this.redis = new Redis({ host, port });
    this.logger.log(`Connected to Redis at ${host}:${port}`);
  }

  /**
   * Blacklist a JWT token until its natural expiry.
   * Uses Redis SET with TTL for automatic expiration.
   */
  async blacklist(token: string, expiresIn: number): Promise<void> {
    const key = `jwt:blacklist:${token}`;
    await this.redis.set(key, "1", "EX", Math.max(1, expiresIn));
    this.logger.debug(`Blacklisted token ${token.slice(0, 8)}...`);
  }

  /**
   * Check if a token has been blacklisted.
   */
  async isBlacklisted(token: string): Promise<boolean> {
    const key = `jwt:blacklist:${token}`;
    const exists = await this.redis.exists(key);
    return exists === 1;
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }
}
