import { Router } from "express";
import { z } from "zod";

import { requireAuth } from "../middleware/auth.middleware";
import { addCartItem, clearCart, listCart, removeCartItem, simulateCheckout, updateCartItemQuantity } from "../services/platform.service";

export const cartRouter = Router();

const addItemSchema = z.object({
  listingId: z.string().trim().min(1),
  quantity: z.coerce.number().int().positive().max(10).default(1),
});

const updateItemSchema = z.object({
  quantity: z.coerce.number().int().positive().max(10),
});

cartRouter.get("/", requireAuth, async (request, response) => {
  if (!request.auth.user) {
    return response.status(401).json({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Authentication required." },
    });
  }

  return response.json({
    success: true,
    data: await listCart(request.auth.user),
  });
});

cartRouter.post("/items", requireAuth, async (request, response) => {
  const parsed = addItemSchema.safeParse(request.body);
  if (!parsed.success || !request.auth.user) {
    return response.status(400).json({
      success: false,
      error: {
        code: "INVALID_CART_ITEM",
        message: "A valid listing ID and quantity are required.",
        details: parsed.success ? undefined : parsed.error.flatten(),
      },
    });
  }

  return response.status(201).json({
    success: true,
    data: await addCartItem(request.auth.user, parsed.data.listingId, parsed.data.quantity),
  });
});

cartRouter.delete("/items/:cartItemId", requireAuth, async (request, response) => {
  if (!request.auth.user) {
    return response.status(401).json({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Authentication required." },
    });
  }

  const removed = await removeCartItem(request.auth.user, String(request.params.cartItemId));
  if (!removed) {
    return response.status(404).json({
      success: false,
      error: { code: "CART_ITEM_NOT_FOUND", message: "Cart item not found." },
    });
  }

  return response.status(204).send();
});

cartRouter.patch("/items/:cartItemId", requireAuth, async (request, response) => {
  const parsed = updateItemSchema.safeParse(request.body);
  if (!parsed.success || !request.auth.user) {
    return response.status(400).json({
      success: false,
      error: {
        code: "INVALID_CART_QUANTITY",
        message: "A valid positive quantity is required.",
        details: parsed.success ? undefined : parsed.error.flatten(),
      },
    });
  }

  return response.json({
    success: true,
    data: await updateCartItemQuantity(request.auth.user, String(request.params.cartItemId), parsed.data.quantity),
  });
});

cartRouter.delete("/", requireAuth, async (request, response) => {
  if (!request.auth.user) {
    return response.status(401).json({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Authentication required." },
    });
  }

  await clearCart(request.auth.user);
  return response.status(204).send();
});

cartRouter.post("/checkout-simulate", requireAuth, async (request, response) => {
  if (!request.auth.user) {
    return response.status(401).json({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Authentication required." },
    });
  }

  return response.json({
    success: true,
    data: await simulateCheckout(request.auth.user),
  });
});
