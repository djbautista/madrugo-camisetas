import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // El cliente de Turso (libSQL) incluye un binario nativo opcional para el
  // modo archivo local; no debe ser empaquetado por Turbopack.
  serverExternalPackages: ["@libsql/client", "libsql"],
};

export default nextConfig;
