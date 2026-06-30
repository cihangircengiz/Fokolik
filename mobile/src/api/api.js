import { useAuthStore } from '../store/useAuthStore';

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "https://fokolik-api.cengiz.in";

async function def_request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = useAuthStore.getState().token;
  
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { "Authorization": `Bearer ${token}` } : {}),
    ...options.headers,
  };

  try {
    const response = await fetch(url, { ...options, headers });
    const data = await response.json();

    if (!response.ok) {
      // Propagate the FastAPI HTTP detail error
      const errorMsg = data.detail || "An error occurred";
      throw new Error(errorMsg);
    }
    return data;
  } catch (error) {
    console.error(`API Request failed for ${endpoint}:`, error);
    throw error;
  }
}

export const apiService = {
  async createUser(username) {
    return def_request("/users/", {
      method: "POST",
      body: JSON.stringify({ username }),
    });
  },

  async getUser(username) {
    return def_request(`/users/${username}`);
  },

  async getMatches(date) {
    const query = date ? `?date=${date}` : "";
    return def_request(`/matches/${query}`);
  },

  async placeSlip(userId, oddIds, amount) {
    return def_request("/slips/", {
      method: "POST",
      body: JSON.stringify({
        user_id: userId,
        odd_ids: oddIds,
        amount: parseFloat(amount),
      }),
    });
  },

  async getUserSlips() {
    return def_request(`/slips/my_slips`);
  },

  async cancelSlip(slipId) {
    return def_request(`/slips/${slipId}/cancel`, {
      method: "POST"
    });
  },

  async getLiveMatches() {
    return def_request("/matches/live");
  },

  async getPublicBattles() {
    return def_request("/battles/public");
  },

  async getMyBattles() {
    return def_request("/battles/my");
  },

  async getLeaderboard() {
    return def_request("/battles/leaderboard");
  },

  connectWebSocket(onMessage) {
    const wsUrl = API_BASE_URL.replace(/^https/, 'wss').replace(/^http/, 'ws') + '/ws';
    let ws = null;
    let reconnectTimer = null;
    let pollTimer = null;
    let lastMatchData = null;
    let closed = false;

    const startPolling = () => {
      if (pollTimer) return;
      console.log('[WS] Falling back to polling every 15s...');
      pollTimer = setInterval(async () => {
        try {
          const today = new Date().toISOString().split('T')[0];
          const data = await def_request(`/matches/?date=${today}`);
          if (data && Array.isArray(data)) {
            onMessage({ type: 'match_updates', data });
          }
        } catch (e) {
          // silent
        }
      }, 15000);
    };

    const stopPolling = () => {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    };

    const connect = () => {
      if (closed) return;
      try {
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          console.log('[WS] Connected to', wsUrl);
          stopPolling();
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            onMessage(msg);
          } catch (err) {
            console.error('[WS] Parse error:', err);
          }
        };

        ws.onclose = (e) => {
          if (closed) return;
          console.log('[WS] Closed. Code:', e.code, '— starting polling fallback, retry in 30s...');
          startPolling();
          reconnectTimer = setTimeout(connect, 30000);
        };

        ws.onerror = () => {
          // onerror fires before onclose; just log silently
        };
      } catch (e) {
        console.error('[WS] Could not create WebSocket:', e);
        startPolling();
      }
    };

    connect();

    // Return a "handle" to close everything
    return {
      close: () => {
        closed = true;
        if (reconnectTimer) clearTimeout(reconnectTimer);
        stopPolling();
        if (ws) ws.close();
      }
    };
  }
};

