import RouteCard from './RouteCard';

export default function RouteComparison({ routes, selectedRoute, onSelectRoute, loading = false, isFallback = false }) {
  const hasRoutes = Array.isArray(routes) && routes.length > 0;

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="flex items-center justify-between mb-2 sm:mb-3">
        <h2 className="text-xl font-bold text-slate-800">Suggested Routes</h2>
        <span className={`text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-md border ${loading ? 'bg-amber-50 text-amber-700 border-amber-200' :
            isFallback ? 'bg-amber-100 text-amber-800 border-amber-200' :
              'bg-emerald-100 text-emerald-800 border-emerald-200'
          }`}>
          {loading ? 'Calculating...' : isFallback ? 'Offline Fallback' : 'Live Data'}
        </span>
      </div>

      {loading ? (
        <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 text-slate-500 font-medium">
          Calculating optimal campus routes using live environmental data...
        </div>
      ) : !hasRoutes ? (
        <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 text-slate-500 font-medium">
          No routes found matching your criteria. Try adjusting origin or destination.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {routes.map(route => (
            <RouteCard
              key={route.id}
              route={route}
              isSelected={selectedRoute?.id === route.id}
              onClick={onSelectRoute}
            />
          ))}
        </div>
      )}
    </div>
  );
}
