import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

/**
 * TenantGuard ensures multi-tenant data isolation by verifying that the
 * authenticated user belongs to the requested tenant and injecting the
 * tenantId into the request for downstream filtering.
 *
 * Usage with @UseGuards(TenantGuard) on controllers:
 *   - Reads user.tenantId from the JWT payload (attached by JwtStrategy)
 *   - Optionally validates tenantId against request params/body
 *   - Attaches verified tenantId to req.tenantId for service-layer queries
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.tenantId) {
      throw new ForbiddenException("Tenant context required");
    }

    // Verify tenant still exists
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: user.tenantId },
    });

    if (!tenant) {
      throw new ForbiddenException("Tenant not found");
    }

    // If the request includes a tenantId param, body, or query, verify it matches
    const requestedTenantId =
      request.params?.tenantId ||
      request.body?.tenantId ||
      request.query?.tenantId;

    if (
      requestedTenantId &&
      requestedTenantId !== user.tenantId
    ) {
      throw new ForbiddenException("Access denied to tenant resources");
    }

    // Inject verified tenantId into request for service-layer enforcement
    request.tenantId = user.tenantId;

    return true;
  }
}
