import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { z } from 'zod';

import {
  ROUTES,
  aiConversationQuerySchema,
  createAiConversationSchema,
  sendAiMessageSchema,
  type AiConversationResponse,
  type AiMessageResponse,
  type SendAiMessageResponse,
} from '@sora/contracts';

import { ClientIp, CurrentUser, type AuthenticatedUser } from '../common/decorators.ts';
import type { Enveloped } from '../common/envelope.ts';
import { zodPipe } from '../common/zod-validation.pipe.ts';
import { AiService } from './ai.service.ts';

@Controller()
export class AiController {
  constructor(private readonly ai: AiService) {}

  @Get(ROUTES.ai.conversations())
  listConversations(
    @CurrentUser() user: AuthenticatedUser,
    @Query(zodPipe(aiConversationQuerySchema)) query: z.infer<typeof aiConversationQuerySchema>,
  ): Promise<Enveloped<AiConversationResponse[]>> {
    return this.ai.listConversations(user, query);
  }

  @Post(ROUTES.ai.createConversation())
  createConversation(
    @CurrentUser() user: AuthenticatedUser,
    @Body(zodPipe(createAiConversationSchema)) body: z.infer<typeof createAiConversationSchema>,
  ): Promise<AiConversationResponse> {
    return this.ai.createConversation(user, body);
  }

  @HttpCode(HttpStatus.OK)
  @Post(ROUTES.ai.deleteConversation(':conversationId'))
  deleteConversation(
    @CurrentUser() user: AuthenticatedUser,
    @Param('conversationId') conversationId: string,
  ): Promise<AiConversationResponse> {
    return this.ai.deleteConversation(user, conversationId);
  }

  @Get(ROUTES.ai.messages(':conversationId'))
  listMessages(
    @CurrentUser() user: AuthenticatedUser,
    @Param('conversationId') conversationId: string,
    @Query(zodPipe(aiConversationQuerySchema)) query: z.infer<typeof aiConversationQuerySchema>,
  ): Promise<Enveloped<AiMessageResponse[]>> {
    return this.ai.listMessages(user, conversationId, query);
  }

  @Post(ROUTES.ai.sendMessage(':conversationId'))
  sendMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('conversationId') conversationId: string,
    @Body(zodPipe(sendAiMessageSchema)) body: z.infer<typeof sendAiMessageSchema>,
  ): Promise<SendAiMessageResponse> {
    return this.ai.sendMessage(user, conversationId, body);
  }

  @HttpCode(HttpStatus.OK)
  @Post(ROUTES.ai.confirmAction(':conversationId', ':messageId'))
  confirmAction(
    @CurrentUser() user: AuthenticatedUser,
    @Param('conversationId') conversationId: string,
    @Param('messageId') messageId: string,
    @ClientIp() ip: string | null,
  ): Promise<AiMessageResponse> {
    return this.ai.confirmAction(user, conversationId, messageId, ip);
  }

  @HttpCode(HttpStatus.OK)
  @Post(ROUTES.ai.dismissAction(':conversationId', ':messageId'))
  dismissAction(
    @CurrentUser() user: AuthenticatedUser,
    @Param('conversationId') conversationId: string,
    @Param('messageId') messageId: string,
  ): Promise<AiMessageResponse> {
    return this.ai.dismissAction(user, conversationId, messageId);
  }
}
