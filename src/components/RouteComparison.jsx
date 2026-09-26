import RouteCard from './RouteCard';

export default function RouteComparison({ routes, selectedRoute, onSelectRoute }) {
  if (!routes || routes.length === 0) return null;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-bold text-slate-800">Suggested Routes</h2>
        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 bg-slate-200/50 px-2.5 py-1 rounded-md border border-slate-200">Mock Data</span>
      </div>
      
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
    </div>
  );
}
