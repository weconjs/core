import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { User, type IUser } from "../models/user.model.js";
import type { WeconContext } from "@weconjs/core";

interface AuthConfig {
  jwtSecret: string;
  jwtExpiresIn: number;
  saltRounds: number;
}

interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

interface LoginInput {
  email: string;
  password: string;
}

interface AuthResult {
  user: Record<string, unknown>;
  token: string;
}

export class AuthService {
  private config: AuthConfig;

  constructor(private ctx: WeconContext) {
    this.config = ctx.getModuleConfig<AuthConfig>("auth");
  }

  async register(input: RegisterInput): Promise<AuthResult> {
    const existing = await User.findOne({ email: input.email });
    if (existing) {
      throw new Error("Email already registered");
    }

    const hashedPassword = await bcrypt.hash(
      input.password,
      this.config.saltRounds
    );

    const user = await User.create({
      email: input.email,
      password: hashedPassword,
      name: { first: input.firstName, last: input.lastName },
      role: "user",
      roles: ["user"],
    });

    const token = this.generateToken(user);
    const userObj = user.toObject();
    const { password: _, ...userWithoutPassword } = userObj;

    return { user: userWithoutPassword, token };
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const user = await User.findOne({ email: input.email }).select("+password");
    if (!user) {
      throw new Error("Invalid credentials");
    }

    const isMatch = await bcrypt.compare(input.password, user.password);
    if (!isMatch) {
      throw new Error("Invalid credentials");
    }

    if (!user.isActive) {
      throw new Error("Account is deactivated");
    }

    const token = this.generateToken(user);
    const userObj = user.toObject();
    const { password: _, ...userWithoutPassword } = userObj;

    return { user: userWithoutPassword, token };
  }

  async getProfile(userId: string): Promise<IUser | null> {
    return User.findById(userId);
  }

  verifyToken(token: string): { userId: string; role: string; roles: string[] } {
    const payload = jwt.verify(token, this.config.jwtSecret) as {
      sub: string;
      role: string;
      roles: string[];
    };
    return { userId: payload.sub, role: payload.role, roles: payload.roles };
  }

  private generateToken(user: IUser): string {
    return jwt.sign(
      {
        sub: user._id,
        email: user.email,
        role: user.role,
        roles: user.roles,
      },
      this.config.jwtSecret,
      { expiresIn: this.config.jwtExpiresIn }
    );
  }
}
