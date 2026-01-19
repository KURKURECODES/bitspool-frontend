import { useEffect } from 'react';
import { useAuth } from './AuthContext';

const API_BASE_URL = 'http://localhost:5000';

class ApiService {
  constructor() {
    this.getIdToken = null;
  }

  setTokenGetter(getIdToken) {
    this.getIdToken = getIdToken;
  }

  async request(endpoint, options = {}) {
    const token = await this.getIdToken?.();
    
    const config = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
    };

    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Request failed');
    }

    return response.json();
  }

  async getRides() {
    return this.request('/api/rides');
  }

  async createRide(rideData) {
    return this.request('/api/rides', {
      method: 'POST',
      body: JSON.stringify(rideData),
    });
  }

  async requestRide(rideId, passengerData) {
    return this.request(`/api/rides/${rideId}/request`, {
      method: 'POST',
      body: JSON.stringify(passengerData),
    });
  }

  async respondToRequest(requestId, action) {
    return this.request(`/api/requests/${requestId}/respond`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    });
  }

  async getMyRides() {
    return this.request('/api/my-rides');
  }

  async getRideRequests(rideId) {
    return this.request(`/api/rides/${rideId}/requests`);
  }
}

const apiService = new ApiService();

export const useApi = () => {
  const { getIdToken } = useAuth();
  
  useEffect(() => {
    apiService.setTokenGetter(getIdToken);
  }, [getIdToken]);

  return apiService;
};

export default apiService;