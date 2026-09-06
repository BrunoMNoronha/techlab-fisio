import type { NextConfig } from "next";

// O roteamento same-origin para apps/api (/api/*) é provido pelo Route Handler
// transparente em `app/api/[...caminho]/route.ts`, garantindo que o cabeçalho
// `Host` público original recebido do navegador (ex: localhost:3000) seja
// estritamente preservado perante a `ProtecaoCsrfGuard` do NestJS (P-2.3D-04).
const nextConfig: NextConfig = {};

export default nextConfig;
