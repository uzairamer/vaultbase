import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"

const publicPaths = ["/login", "/register", "/api/auth"]

export default auth((req) => {
  const { pathname } = req.nextUrl
  const isPublic = publicPaths.some((p) => pathname.startsWith(p))

  if (!req.auth && !isPublic && pathname !== "/") {
    return NextResponse.redirect(new URL("/login", req.url))
  }
})

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public).*)"],
}
