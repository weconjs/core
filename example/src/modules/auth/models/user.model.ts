import mongoose, { Schema, type Document } from "mongoose";

export interface IUser extends Document {
  email: string;
  password: string;
  name: { first: string; last: string };
  role: "admin" | "user";
  roles: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    name: {
      first: { type: String, required: true, trim: true },
      last: { type: String, required: true, trim: true },
    },
    role: {
      type: String,
      enum: ["admin", "user"],
      default: "user",
    },
    roles: {
      type: [String],
      default: ["user"],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

userSchema.index({ email: 1 });
userSchema.index({ role: 1 });

export const User = mongoose.model<IUser>("User", userSchema);
