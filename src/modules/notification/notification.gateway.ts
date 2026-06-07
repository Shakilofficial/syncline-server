import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../../core/prisma/prisma.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class NotificationGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private logger = new Logger('WebSockets');

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      // Retrieve token from auth block or query string
      let token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization ||
        client.handshake.query?.token;

      if (token && typeof token === 'string' && token.startsWith('Bearer ')) {
        token = token.slice(7);
      }

      if (!token || typeof token !== 'string') {
        this.logger.warn(`Disconnecting unauthenticated client ${client.id}`);
        client.disconnect();
        return;
      }

      const accessSecret = this.configService.get<string>('JWT_ACCESS_SECRET');
      const payload = await this.jwtService.verifyAsync(token, {
        secret: accessSecret,
      });

      // Attach user details to socket data store
      client.data.user = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
      };

      const userId = payload.sub;

      // Join private user room for targeted notifications
      await client.join(`user:${userId}`);
      this.logger.log(
        `👤 User ${userId} connected. Socket joined private room user:${userId}`,
      );

      // Join project rooms for all projects this user is member of
      const memberships = await this.prisma.projectMember.findMany({
        where: { userId },
        select: { projectId: true },
      });

      for (const member of memberships) {
        await client.join(`project:${member.projectId}`);
        this.logger.log(
          `📁 Socket ${client.id} joined room project:${member.projectId}`,
        );
      }
    } catch (err: any) {
      this.logger.error(
        `Authentication failed for client ${client.id}: ${err.message}`,
      );
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`🔌 Client disconnected: ${client.id}`);
  }

  // ── Helper API ─────────────────────────────────

  sendToUser(userId: string, event: string, payload: any) {
    this.server.to(`user:${userId}`).emit(event, payload);
    this.logger.log(`⚡ Event "${event}" dispatched to user:${userId}`);
  }

  sendToProject(projectId: string, event: string, payload: any) {
    this.server.to(`project:${projectId}`).emit(event, payload);
    this.logger.log(`⚡ Event "${event}" dispatched to project:${projectId}`);
  }
}
