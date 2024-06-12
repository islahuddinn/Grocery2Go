// Helper function to calculate distance (using Haversine formula)
function calculateDistance(products, userLocation) {
  if (!products.length || !userLocation) return 0;

  const shopLocation = products[0].shop.location.coordinates;
  const [lat1, lon1] = userLocation || shopLocation;
  const [lat2, lon2] = shopLocation;

  const R = 6371; // Radius of the Earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // Distance in km
  return distance;
}

function deg2rad(deg) {
  return deg * (Math.PI / 180);
}

// Helper function to calculate expected delivery time
function calculateExpectedDeliveryTime(products, userLocation, speed) {
  const distance = calculateDistance(products, userLocation);
  const time = distance / speed; // Time in hours
  return time * 60; // Convert to minutes
}
module.exports = {
  calculateDistance,
  calculateExpectedDeliveryTime,
};
