import type { Socket } from "socket.io";
import type { WeconContext } from "@weconjs/core";

export default function postsSocketHandler(
  socket: Socket,
  ctx: WeconContext
): void {
  socket.on("posts:subscribe", (data?: { tag?: string }) => {
    const room = data?.tag ? `posts:tag:${data.tag}` : "posts:feed";
    socket.join(room);
    ctx.logger.debug("Socket subscribed to posts", {
      socketId: socket.id,
      room,
    });
  });

  socket.on("posts:unsubscribe", (data?: { tag?: string }) => {
    const room = data?.tag ? `posts:tag:${data.tag}` : "posts:feed";
    socket.leave(room);
  });
}
