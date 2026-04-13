import { Router } from "express";
import { z } from "zod";

import {
  getConversationWorkspaceForListing,
  listConversations,
  listMessagesForListing,
  sendMessageToListing,
  terminateConversationForListing,
} from "../services/platform.service";
import { requireAuth } from "../middleware/auth.middleware";

const sendMessageSchema = z.object({
  message: z.string().trim().min(1, "Message is required.").max(1000, "Message is too long."),
});

export const chatRouter = Router();

chatRouter.get("/", requireAuth, async (request, response) => {
  if (!request.auth.user) {
    return response.status(401).json({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required.",
      },
    });
  }

  return response.json({
    success: true,
    data: await listConversations(request.auth.user),
  });
});

chatRouter.get("/:listingId/messages", requireAuth, async (request, response) => {
  if (!request.auth.user) {
    return response.status(401).json({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required.",
      },
    });
  }

  const listingId = String(request.params.listingId);
  const listingMessages = await listMessagesForListing(listingId, request.auth.user);

  if (!listingMessages) {
    return response.status(404).json({
      success: false,
      error: {
        code: "CONVERSATION_NOT_FOUND",
        message: "Conversation not found for this listing.",
      },
    });
  }

  return response.json({
    success: true,
    data: listingMessages,
  });
});

chatRouter.get("/:listingId/workspace", requireAuth, async (request, response) => {
  if (!request.auth.user) {
    return response.status(401).json({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required.",
      },
    });
  }

  const workspace = await getConversationWorkspaceForListing(String(request.params.listingId), request.auth.user);
  if (!workspace) {
    return response.status(404).json({
      success: false,
      error: {
        code: "LISTING_NOT_FOUND",
        message: "Listing not found.",
      },
    });
  }

  return response.json({
    success: true,
    data: workspace,
  });
});

chatRouter.post("/:listingId/messages", requireAuth, async (request, response) => {
  const parseResult = sendMessageSchema.safeParse(request.body);

  if (!parseResult.success || !request.auth.user) {
    return response.status(400).json({
      success: false,
      error: {
        code: "INVALID_MESSAGE",
        message: "A valid message is required.",
        details: parseResult.success ? undefined : parseResult.error.flatten(),
      },
    });
  }

  const listingId = String(request.params.listingId);
  const result = await sendMessageToListing(listingId, request.auth.user, parseResult.data.message);

  if (!result) {
    return response.status(404).json({
      success: false,
      error: {
        code: "LISTING_NOT_FOUND",
        message: "Listing not found.",
      },
    });
  }

  if ("error" in result && result.error === "SELF_MESSAGE") {
    return response.status(400).json({
      success: false,
      error: {
        code: "SELF_MESSAGE_NOT_ALLOWED",
        message: "You cannot start a chat with your own listing.",
      },
    });
  }

  if ("error" in result && result.error === "BLOCKED") {
    return response.status(403).json({
      success: false,
      error: {
        code: "CHAT_BLOCKED",
        message: "Messaging is blocked between these users.",
      },
    });
  }

  if ("error" in result && result.error === "TERMINATED") {
    return response.status(409).json({
      success: false,
      error: {
        code: "CHAT_TERMINATED",
        message: "This chat has been terminated and can no longer accept messages.",
      },
    });
  }

  if ("error" in result && result.error === "MESSAGE_BLOCKED") {
    return response.status(400).json({
      success: false,
      error: {
        code: "MESSAGE_BLOCKED",
        message: result.warning || "This message was blocked by chat safety rules.",
        details: {
          flags: result.flags || [],
        },
      },
    });
  }

  return response.status(201).json({
    success: true,
    data: result,
  });
});

chatRouter.post("/:listingId/terminate", requireAuth, async (request, response) => {
  if (!request.auth.user) {
    return response.status(401).json({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required.",
      },
    });
  }

  const listingId = String(request.params.listingId);
  const result = await terminateConversationForListing(listingId, request.auth.user);

  if (!result) {
    return response.status(404).json({
      success: false,
      error: {
        code: "CONVERSATION_NOT_FOUND",
        message: "Conversation not found for this listing.",
      },
    });
  }

  return response.json({
    success: true,
    data: result,
  });
});
