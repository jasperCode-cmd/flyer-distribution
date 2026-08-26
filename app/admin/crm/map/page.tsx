import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function MapPage() {
  const jobsWithCoords = await prisma.job.count({
    where: { latitude: { not: null }, longitude: { not: null } },
  });

  return (
    <div>
      <h1 className="text-xl font-bold text-blue-900 mb-1">Job Map</h1>
      <p className="text-sm text-gray-500 mb-4">
        A geographic view of jobs, once a mapping provider is connected.
      </p>

      <div className="bg-white rounded-lg border border-gray-200 p-10 text-center">
        <div className="max-w-md mx-auto">
          <p className="text-4xl mb-3">🗺️</p>
          <h2 className="text-sm font-bold text-blue-900 mb-2">No map connected yet</h2>
          <p className="text-sm text-gray-500">
            The <code className="bg-gray-100 px-1 rounded">Job</code> record already has{" "}
            <code className="bg-gray-100 px-1 rounded">latitude</code> and{" "}
            <code className="bg-gray-100 px-1 rounded">longitude</code> fields ready to store
            coordinates. To show pins here, connect a mapping provider (e.g. Google Maps or
            Mapbox), geocode job addresses into those fields, and render the map on this page —
            none of that is wired up yet, and no external mapping API is called anywhere in this
            build.
          </p>
          {jobsWithCoords > 0 && (
            <p className="text-xs text-gray-400 mt-3">
              {jobsWithCoords} job(s) currently have coordinates stored.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
