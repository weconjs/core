import type { Socket } from "socket.io";
import type { WeconContext } from "@weconjs/core";
import { AuthService } from "../services/auth.service.js";

export default function authSocketHandler(
  socket: Socket,
  ctx: WeconContext
): void {
  const authService = new AuthService(ctx);

  socket.on("auth:verify", async (data: { token: string }, callback) => {
    try {
      const payload = authService.verifyToken(data.token);
      const profile = await authService.getProfile(payload.userId);

      if (profile) {
        socket.data.userId = payload.userId;
        socket.data.roles = payload.roles;
        socket.join(`user:${payload.userId}`);
        callback({ success: true, user: profile });
      } else {
        callback({ success: false, error: "User not found" });
      }
    } catch {
      callback({ success: false, error: "Invalid token" });
    }
  });

  socket.on("disconnect", () => {
    ctx.logger.debug("Socket disconnected", {
      socketId: socket.id,
      userId: socket.data.userId,
    });
  });
}
