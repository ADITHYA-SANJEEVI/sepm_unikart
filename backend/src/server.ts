import cors from "cors";
import express from "express";

import { env } from "./config/env";
import { attachAuthContext } from "./middleware/auth.middleware";
import { errorHandler, notFoundHandler } from "./middleware/error.middleware";
import { adminRouter } from "./routes/admin.routes";
import { aiRouter } from "./routes/ai.routes";
import { authRouter } from "./routes/auth.routes";
import { chatRouter } from "./routes/chat.routes";
import { dashboardRouter } from "./routes/dashboard.routes";
import { healthRouter } from "./routes/health.routes";
import { listingsRouter } from "./routes/listings.routes";
import { mediaRouter } from "./routes/media.routes";
import { mapsRouter } from "./routes/maps.routes";
import { policiesRouter } from "./routes/policies.routes";
import { profilesRouter } from "./routes/profiles.routes";
import { schedulesRouter } from "./routes/schedules.routes";
import { usersRouter } from "./routes/users.routes";
import { cartRouter } from "./routes/cart.routes";

const app = express();

app.use(cors());
app.use(express.json({ limit: "15mb" }));
app.use(attachAuthContext);

app.use("/health", healthRouter);
app.use("/auth", authRouter);
app.use("/ai", aiRouter);
app.use("/admin", adminRouter);
app.use("/listings", listingsRouter);
app.use("/media", mediaRouter);
app.use("/maps", mapsRouter);
app.use("/cart", cartRouter);
app.use("/chat", chatRouter);
app.use("/dashboard", dashboardRouter);
app.use("/schedules", schedulesRouter);
app.use("/users", usersRouter);
app.use("/profiles", profilesRouter);
app.use("/policies", policiesRouter);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(`UniKart backend listening on port ${env.PORT}`);
  console.log(
    `[auth] auth_off=${env.AUTH_OFF} dev_bypass=${env.DEV_AUTH_BYPASS_ENABLED} bypass_emails=${env.DEV_AUTH_BYPASS_EMAILS.join(",")}`,
  );
});

export { app };
