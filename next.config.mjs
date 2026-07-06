/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: [
    "pdf-parse",
    "mammoth",
    "pdfkit",
    "bcryptjs",
    "@prisma/adapter-better-sqlite3",
    "@prisma/adapter-pg",
    "better-sqlite3",
    "pg"
  ],
  typedRoutes: true,
  turbopack: {
    root: process.cwd()
  }
};

export default nextConfig;
