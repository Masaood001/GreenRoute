import MapView from './MapView';
export default function MapPlaceholder({ selectedRoute, routes = [], areaId = 'panki-kanpur' }) {
  return <MapView selectedRoute={selectedRoute} routes={routes} areaId={areaId} />;
}
