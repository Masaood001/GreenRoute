/**
 * GreenRoute Browser Geolocation Service
 * Lightweight, zero-dependency browser Geolocation API wrapper.
 * Provides normalized location state, error translation, and memory-only tracking.
 */

export const GEOLOCATION_ERROR_CODES = Object.freeze({
  PERMISSION_DENIED: "PERMISSION_DENIED",
  POSITION_UNAVAILABLE: "POSITION_UNAVAILABLE",
  TIMEOUT: "TIMEOUT",
  NOT_SUPPORTED: "NOT_SUPPORTED",
  UNKNOWN_ERROR: "UNKNOWN_ERROR",
});

export const DEFAULT_GEOLOCATION_OPTIONS = Object.freeze({
  enableHighAccuracy: true,
  maximumAge: 0,
  timeout: 10000,
});

/**
 * Normalizes browser Geolocation position coordinates safely.
 * Preserves exact numerical GPS coordinates without rounding.
 * Normalizes missing/nullable speed and heading values to null.
 *
 * @param {GeolocationPosition} position - Raw browser geolocation position
 * @returns {{
 *   latitude: number,
 *   longitude: number,
 *   accuracy: number,
 *   speed: number | null,
 *   heading: number | null,
 *   timestamp: number
 * }} Normalized location object
 */
export function normalizeLocation(position) {
  if (!position || !position.coords) {
    const error = new Error("Invalid geolocation position structure.");
    error.code = GEOLOCATION_ERROR_CODES.POSITION_UNAVAILABLE;
    throw error;
  }

  const { latitude, longitude, accuracy, speed, heading } = position.coords;

  return {
    latitude: typeof latitude === "number" ? latitude : null,
    longitude: typeof longitude === "number" ? longitude : null,
    accuracy: typeof accuracy === "number" ? accuracy : null,
    speed: typeof speed === "number" && !Number.isNaN(speed) ? speed : null,
    heading: typeof heading === "number" && !Number.isNaN(heading) ? heading : null,
    timestamp: typeof position.timestamp === "number" ? position.timestamp : Date.now(),
  };
}

/**
 * Normalizes raw browser GeolocationPositionError objects into standard GreenRoute errors.
 * Ensures UI components never receive raw browser error instances.
 *
 * @param {Object|GeolocationPositionError|Error} error - Error object to normalize
 * @returns {Error} Normalized Error object with standard code property
 */
export function normalizeGeolocationError(error) {
  if (error && error.isNormalizedGeolocationError) {
    return error;
  }

  let code = GEOLOCATION_ERROR_CODES.UNKNOWN_ERROR;
  let message = "An unexpected error occurred while retrieving location.";

  if (error && typeof error.code === "number") {
    switch (error.code) {
      case 1:
        code = GEOLOCATION_ERROR_CODES.PERMISSION_DENIED;
        message = "Location permission was denied. Please enable location access in your browser settings.";
        break;
      case 2:
        code = GEOLOCATION_ERROR_CODES.POSITION_UNAVAILABLE;
        message = "Location information is unavailable. Please check your GPS or network connection.";
        break;
      case 3:
        code = GEOLOCATION_ERROR_CODES.TIMEOUT;
        message = "Location request timed out. Please try again.";
        break;
      default:
        code = GEOLOCATION_ERROR_CODES.UNKNOWN_ERROR;
        message = error.message || message;
        break;
    }
  } else if (error && error.code && Object.values(GEOLOCATION_ERROR_CODES).includes(error.code)) {
    code = error.code;
    message = error.message || message;
  } else if (error && error.message) {
    message = error.message;
  }

  const normalizedError = new Error(message);
  normalizedError.code = code;
  normalizedError.isNormalizedGeolocationError = true;
  return normalizedError;
}

/**
 * Obtains current single-shot GPS location from browser Geolocation API.
 *
 * @param {PositionOptions} [options] - Custom Geolocation options
 * @returns {Promise<{
 *   latitude: number,
 *   longitude: number,
 *   accuracy: number,
 *   speed: number | null,
 *   heading: number | null,
 *   timestamp: number
 * }>} Promise resolving to normalized location object
 */
export function getCurrentLocation(options = {}) {
  const mergedOptions = { ...DEFAULT_GEOLOCATION_OPTIONS, ...options };

  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      const err = new Error("Geolocation API is not supported in this environment.");
      err.code = GEOLOCATION_ERROR_CODES.NOT_SUPPORTED;
      return reject(normalizeGeolocationError(err));
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        try {
          const normalized = normalizeLocation(position);
          resolve(normalized);
        } catch (err) {
          reject(normalizeGeolocationError(err));
        }
      },
      (error) => {
        reject(normalizeGeolocationError(error));
      },
      mergedOptions
    );
  });
}

/**
 * Subscribes to continuous live position updates using watchPosition.
 * Keeps tracking updates strictly in-memory without persistent storage.
 *
 * @param {Function} onLocationUpdate - Callback for normalized location updates
 * @param {Function} [onError] - Callback for normalized geolocation errors
 * @param {PositionOptions} [options] - Custom Geolocation options
 * @returns {number|null} Watch ID for cancellation, or null if unsupported
 */
export function startLocationTracking(onLocationUpdate, onError, options = {}) {
  const mergedOptions = { ...DEFAULT_GEOLOCATION_OPTIONS, ...options };

  if (typeof navigator === "undefined" || !navigator.geolocation) {
    const err = new Error("Geolocation API is not supported in this environment.");
    err.code = GEOLOCATION_ERROR_CODES.NOT_SUPPORTED;
    if (typeof onError === "function") {
      onError(normalizeGeolocationError(err));
    }
    return null;
  }

  const successCallback = (position) => {
    try {
      const normalized = normalizeLocation(position);
      if (typeof onLocationUpdate === "function") {
        onLocationUpdate(normalized);
      }
    } catch (err) {
      if (typeof onError === "function") {
        onError(normalizeGeolocationError(err));
      }
    }
  };

  const errorCallback = (error) => {
    if (typeof onError === "function") {
      onError(normalizeGeolocationError(error));
    }
  };

  return navigator.geolocation.watchPosition(
    successCallback,
    errorCallback,
    mergedOptions
  );
}

/**
 * Stops continuous location tracking using clearWatch.
 *
 * @param {number|string|null} watchId - Watch ID returned by startLocationTracking
 */
export function stopLocationTracking(watchId) {
  if (watchId === null || watchId === undefined) {
    return;
  }

  if (
    typeof navigator !== "undefined" &&
    navigator.geolocation &&
    typeof navigator.geolocation.clearWatch === "function"
  ) {
    navigator.geolocation.clearWatch(watchId);
  }
}

/**
 * Classifies raw browser-provided GPS accuracy (in meters) into quality categories.
 * Base classification strictly on actual browser accuracy value without fabricating data.
 *
 * @param {number|null} accuracy - Browser-reported accuracy in meters
 * @returns {{
 *   quality: 'excellent' | 'good' | 'fair' | 'poor' | 'unknown',
 *   label: string,
 *   isLowAccuracy: boolean
 * }} Accuracy quality metadata
 */
export function getAccuracyClassification(accuracy) {
  if (typeof accuracy !== "number" || isNaN(accuracy) || accuracy === null) {
    return {
      quality: "unknown",
      label: "Accuracy unknown",
      isLowAccuracy: false,
    };
  }

  const rounded = Math.round(accuracy);

  if (accuracy <= 15) {
    return {
      quality: "excellent",
      label: `GPS accuracy: ~${rounded} m`,
      isLowAccuracy: false,
    };
  }

  if (accuracy <= 50) {
    return {
      quality: "good",
      label: `GPS accuracy: ~${rounded} m`,
      isLowAccuracy: false,
    };
  }

  if (accuracy <= 150) {
    return {
      quality: "fair",
      label: `GPS accuracy: ~${rounded} m`,
      isLowAccuracy: false,
    };
  }

  return {
    quality: "poor",
    label: `Low GPS accuracy (~${rounded} m)`,
    isLowAccuracy: true,
  };
}

/**
 * Calculates distance in meters between two geographic coordinates using the Haversine formula.
 *
 * @param {number} lat1
 * @param {number} lon1
 * @param {number} lat2
 * @param {number} lon2
 * @returns {number} Distance in meters
 */
export function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  if (
    typeof lat1 !== "number" || typeof lon1 !== "number" ||
    typeof lat2 !== "number" || typeof lon2 !== "number" ||
    isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)
  ) {
    return 0;
  }

  const R = 6371000;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Evaluates whether a new incoming GPS fix should update the current trusted displayed location.
 * Prefers better accuracy fixes and filters wild GPS jumps/outliers without fabricating coordinates.
 *
 * @param {object|null} currentTrusted - Current trusted location fix
 * @param {object} newFix - New incoming normalized location fix
 * @param {object} [options]
 * @returns {boolean} True if new fix should replace current trusted fix
 */
export function shouldAcceptNewLocationFix(currentTrusted, newFix, options = {}) {
  const { maxSpeedMs = 50, maxStaleSec = 30 } = options;

  if (!newFix || typeof newFix.latitude !== "number" || typeof newFix.longitude !== "number") {
    return false;
  }

  // 1. Initial Fix: Always accept the first fix so tracking activates and converges
  if (!currentTrusted || typeof currentTrusted.latitude !== "number" || typeof currentTrusted.longitude !== "number") {
    return true;
  }

  const newAcc = typeof newFix.accuracy === "number" && !isNaN(newFix.accuracy) ? newFix.accuracy : Infinity;
  const currAcc = typeof currentTrusted.accuracy === "number" && !isNaN(currentTrusted.accuracy) ? currentTrusted.accuracy : Infinity;

  // 2. Accuracy Improvement: Prefer newer readings with better accuracy
  if (newAcc < currAcc) {
    return true;
  }

  // 3. Distance & Implied Speed Check
  const distance = calculateDistanceMeters(
    currentTrusted.latitude,
    currentTrusted.longitude,
    newFix.latitude,
    newFix.longitude
  );

  const timeDeltaSec = (newFix.timestamp - currentTrusted.timestamp) / 1000;

  // If time delta is significant (> maxStaleSec), accept new location to avoid getting stuck
  if (timeDeltaSec > maxStaleSec) {
    return true;
  }

  // Detect extreme outlier jump: high implied speed (> maxSpeedMs) combined with significantly degraded accuracy (>100m)
  if (timeDeltaSec > 0) {
    const impliedSpeedMs = distance / timeDeltaSec;
    if (impliedSpeedMs > maxSpeedMs && newAcc > 100 && newAcc > currAcc * 2.5) {
      return false; // Reject wild outlier
    }
  }

  // 4. Accept reasonable updates
  return true;
}


