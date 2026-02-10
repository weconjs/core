import type { Socket } from "socket.io";
import type { WeconContext } from "@weconjs/core";

export default function usersSocketHandler(
  socket: Socket,
  ctx: WeconContext
): void {
  socket.on("users:subscribe", (data: { userId: string }) => {
    if (socket.data.userId) {
      socket.join(`user:${data.userId}`);
      ctx.logger.debug("Socket subscribed to user updates", {
        socketId: socket.id,
        targetUser: data.userId,
      });
    }
  });

  socket.on("users:unsubscribe", (data: { userId: string }) => {
    socket.leave(`user:${data.userId}`);
  });
}
