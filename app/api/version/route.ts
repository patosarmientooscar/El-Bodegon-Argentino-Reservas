// Commit publicado ahora mismo en Vercel. Lo consulta UpdateChecker para que
// el móvil (app añadida a la pantalla de inicio) se recargue sola tras un deploy.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(
    { sha: process.env.VERCEL_GIT_COMMIT_SHA ?? null },
    { headers: { "Cache-Control": "no-store" } },
  );
}
