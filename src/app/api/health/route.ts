// Liveness for container hosts; database errors remain visible in their own UI.
export function GET() {
  return Response.json(
    { status: "ok", service: "resolve", payments: "mock" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
