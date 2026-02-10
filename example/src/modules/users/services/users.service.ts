import { User, type IUser } from "../../../modules/auth/models/user.model.js";
import type { WeconContext } from "@weconjs/core";

interface UpdateUserInput {
  firstName?: string;
  lastName?: string;
  role?: "admin" | "user";
  isActive?: boolean;
}

export class UsersService {
  constructor(private ctx: WeconContext) {}

  async findAll(page = 1, limit = 20): Promise<{ users: IUser[]; total: number }> {
    const skip = (page - 1) * limit;
    const [users, total] = await Promise.all([
      User.find().skip(skip).limit(limit).sort({ createdAt: -1 }),
      User.countDocuments(),
    ]);
    return { users, total };
  }

  async findById(id: string): Promise<IUser | null> {
    return User.findById(id);
  }

  async update(id: string, input: UpdateUserInput): Promise<IUser | null> {
    const update: Record<string, unknown> = {};

    if (input.firstName !== undefined || input.lastName !== undefined) {
      if (input.firstName) update["name.first"] = input.firstName;
      if (input.lastName) update["name.last"] = input.lastName;
    }
    if (input.role) {
      update.role = input.role;
      update.roles = [input.role];
    }
    if (input.isActive !== undefined) {
      update.isActive = input.isActive;
    }

    return User.findByIdAndUpdate(id, { $set: update }, { new: true });
  }

  async delete(id: string): Promise<boolean> {
    const result = await User.findByIdAndDelete(id);
    return !!result;
  }

  async toggleActive(id: string): Promise<IUser | null> {
    const user = await User.findById(id);
    if (!user) return null;

    user.isActive = !user.isActive;
    await user.save();
    return user;
  }
}
