import { NextResponse, type NextRequest } from "next/server";

// En Next.js 16 el middleware se llama "proxy". Aquí solo hacemos una
// comprobación optimista: si no hay cookie de sesión, redirigimos a /login.
// La verificación real (firma + rol) ocurre en las páginas y server actions.

const COOKIE_NAME = "madrugo_session";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Rutas públicas / internas que no requieren sesión.
  const isPublic =
    pathname === "/login" ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname === "/favicon.ico";

  if (isPublic) return NextResponse.next();

  const hasSession = request.cookies.has(COOKIE_NAME);
  if (!hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
