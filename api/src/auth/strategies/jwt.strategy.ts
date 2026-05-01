import { ExtractJwt, Strategy } from "passport-jwt";
import { PassportStrategy } from "@nestjs/passport";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../prisma/prisma.service";
import { RedisTokenBlacklistService } from "../redis-token-blacklist.service";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly blacklist: RedisTokenBlacklistService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>("JWT_SECRET") || "fall-back-super-secret-key-change-in-production",
      passReqToCallback: true,
    });
  }

  async validate(req: any, payload: { sub: string; email: string; role: string; tenantId: string }) {
    // Check blacklist
    const authHeader = req.headers?.authorization || '';
    const parts = authHeader.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      const rawToken = parts[1];
      const blacklisted = await this.blacklist.isBlacklisted(rawToken.slice(-32));
      if (blacklisted) {
        throw new UnauthorizedException("Token has been revoked");
      }
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException("User no longer exists");
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      tenantId: payload.tenantId,
    };
  }
}
