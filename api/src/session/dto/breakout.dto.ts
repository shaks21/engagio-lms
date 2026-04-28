import {
  IsObject,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsEnum,
  IsArray,
} from 'class-validator';

export class BreakoutPatchBody {
  @IsObject()
  assignments!: Record<string, string>;

  @IsOptional()
  @IsBoolean()
  grantPermissions?: boolean;
}

export class BreakoutAutoBody {
  @IsNumber()
  groupCount!: number;

  @IsOptional()
  @IsEnum(['SHUFFLE', 'ROUND_ROBIN'] as const)
  algorithm?: 'SHUFFLE' | 'ROUND_ROBIN';

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  participants?: string[];
}

export class BreakoutSelfSelectBody {
  @IsOptional()
  @IsString()
  breakoutRoomId?: string | null;
}

export class BreakoutModeBody {
  @IsEnum(['AUTO', 'MANUAL', 'SELF_SELECT'] as const)
  assignmentMode!: 'AUTO' | 'MANUAL' | 'SELF_SELECT';

  @IsOptional()
  @IsNumber()
  groupCount?: number;
}
