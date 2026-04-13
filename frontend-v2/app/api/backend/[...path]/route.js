import { NextResponse } from "next/server";

const BACKEND_BASE = process.env.UNIKART_BACKEND_URL || "http://127.0.0.1:4000";

async function proxyRequest(request, context) {
  const path = context.params?.path || [];
  const url = new URL(`${BACKEND_BASE}/${path.join("/")}${request.nextUrl.search}`);

  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  const authHeader = request.headers.get("authorization");
  const overrideHeader = request.headers.get("x-admin-override");
  const devHeader = request.headers.get("x-dev-auth-email");
  const devRoleHeader = request.headers.get("x-dev-auth-role");
  const devNameHeader = request.headers.get("x-dev-auth-name");

  if (contentType) headers.set("content-type", contentType);
  if (authHeader) headers.set("authorization", authHeader);
  if (overrideHeader) headers.set("x-admin-override", overrideHeader);
  if (devHeader) headers.set("x-dev-auth-email", devHeader);
  if (devRoleHeader) headers.set("x-dev-auth-role", devRoleHeader);
  if (devNameHeader) headers.set("x-dev-auth-name", devNameHeader);

  const init = {
    method: request.method,
    headers,
    cache: "no-store",
  };

  if (!["GET", "HEAD"].includes(request.method)) {
    init.body = await request.text();
  }

  try {
    const response = await fetch(url, init);
    const body = await response.arrayBuffer();
    const proxiedHeaders = new Headers();
    const responseType = response.headers.get("content-type") || "application/json";
    const contentDisposition = response.headers.get("content-disposition");
    proxiedHeaders.set("content-type", responseType);
    if (contentDisposition) proxiedHeaders.set("content-disposition", contentDisposition);
    return new NextResponse(body, { status: response.status, headers: proxiedHeaders });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "BACKEND_UNAVAILABLE",
          message: "UniKart backend is unavailable. Start the backend server, then retry your action.",
        },
      },
      { status: 503 },
    );
  }
}

export { proxyRequest as GET, proxyRequest as HEAD, proxyRequest as POST, proxyRequest as PATCH, proxyRequest as DELETE };
