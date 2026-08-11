// NextAuth owns these handlers, so there is nowhere here to wrap a limit
// around. Sign-in throttling lives in the credentials provider's authorize()
// in @/lib/auth, which is the only part of this route that does work an
// attacker would want to repeat.
export { GET, POST } from "@/lib/auth";
