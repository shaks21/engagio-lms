import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import * as bcrypt from "bcrypt";
import { PrismaService } from "../prisma/prisma.service";
import { RegisterDto, LoginDto } from "./dto/auth.dto";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findFirst({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException("Email already registered");
    }

    let tenant = await this.prisma.tenant.findFirst();
    if (!tenant) {
      tenant = await this.prisma.tenant.create({
        data: { name: "Engagio Default Organization" },
      });
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: dto.email,
        password: hashedPassword,
        role: (dto.role || "STUDENT") as any,
      },
    });

    const tokens = await this.generateTokens(
      user.id,
      user.email,
      user.role,
      user.tenantId,
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
      },
      ...tokens,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const passwordMatch = await bcrypt.compare(dto.password, user.password);

    if (!passwordMatch) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const tokens = await this.generateTokens(
      user.id,
      user.email,
      user.role,
      user.tenantId,
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
      },
      ...tokens,
    };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        tenantId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException("User not found");
    }

    return user;
  }

  private async generateTokens(
    userId: string,
    email: string,
    role: string,
    tenantId: string,
  ) {
    const accessToken = await this.jwt.signAsync(
      { sub: userId, email, role, tenantId },
      {
        secret: this.config.get<string>("JWT_SECRET"),
        expiresIn: this.config.get<string>("JWT_ACCESS_EXPIRES_IN", "15m") as any,
      },
    );

    const refreshToken = await this.jwt.signAsync(
      { sub: userId },
      {
        secret: this.config.get<string>("JWT_REFRESH_SECRET"),
        expiresIn: this.config.get<string>("JWT_REFRESH_EXPIRES_IN", "7d") as any,
      },
    );

    return { accessToken, refreshToken };
  }

  async refreshTokens(refreshToken: string) {
    try {
      const payload = this.jwt.verify(refreshToken, {
        secret: this.config.get<string>("JWT_REFRESH_SECRET"),
      }) as { sub: string };

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user) {
        throw new UnauthorizedException("User not found");
      }

      const tokens = await this.generateTokens(
        user.id,
        user.email,
        user.role,
        user.tenantId,
      );

      return {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          tenantId: user.tenantId,
        },
        ...tokens,
      };
    } catch {
      throw new UnauthorizedException("Invalid refresh token");
    }
  }
}
