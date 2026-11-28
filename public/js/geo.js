// Lat/lng -> local km around Charing Cross (x east, y north). The 3D scene
// uses x for east and -y for its z axis.
export const ORIGIN = { lat: 51.5074, lng: -0.1278 };
const KX = Math.cos((51.5 * Math.PI) / 180) * 111.32;
const KY = 110.57;

export const project = (lat, lng) => [(lng - ORIGIN.lng) * KX, (lat - ORIGIN.lat) * KY];
