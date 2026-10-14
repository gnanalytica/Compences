/** Liveness probe. Deliberately says nothing about configuration or versions. */
export async function GET() {
  return Response.json({ status: 'ok', service: 'compences' });
}
