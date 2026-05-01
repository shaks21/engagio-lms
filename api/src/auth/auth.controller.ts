import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
  UnauthorizedException,
  Headers,
} from "@nestjs/common";
import { AuthService } from "./auth.service";
import { RegisterDto, LoginDto } from "./dto/auth.dto";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";
import { RedisTokenBlacklistService } from "./redis-token-blacklist.service";
import { JwtService } from "@nestjs/jwt";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly blacklist: RedisTokenBlacklistService,
    private readonly jwt: JwtService,
  ) {}

  @Post("register")
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post("guest")
  @HttpCode(HttpStatus.OK)
  async guest(@Body() dto: { displayName: string }) {
    return this.authService.guestLogin(dto.displayName);
  }

  @Patch("me")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async updateProfile(@Request() req, @Body() dto: { name?: string; bio?: string; avatar?: string }) {
    return this.authService.updateProfile(req.user.id, dto);
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() body: { refreshToken: string }) {
    return this.authService.refreshTokens(body.refreshToken);
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  async logout(@Headers("authorization") authHeader: string | undefined) {
    if (!authHeader) {
      throw new UnauthorizedException("No token provided");
    }

    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") {
      throw new UnauthorizedException("Malformed authorization header");
    }

    const token = parts[1];

    // Decode token to get jti and exp
    const decoded = this.jwt.decode(token) as { jti?: string; exp?: number } | null;
    const jti = decoded?.jti;
    const exp = decoded?.exp ? decoded.exp - Math.floor(Date.now() / 1000) : 900;

    if (jti) {
      await this.blacklist.blacklist(jti, Math.max(1, exp));
    } else {
      // Fallback: blacklist a full token hash if no jti present
      await this.blacklist.blacklist(token.slice(-32), Math.max(1, exp));
    }

    return { message: "Logged out successfully" };
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  async getProfile(@Request() req) {
    return this.authService.getProfile(req.user.id);
  }
}
