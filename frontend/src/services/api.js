export const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function def_request(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = {
    "Content-Type": "application/json",
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

  async getUserSlips(userId) {
    return def_request(`/slips/user/${userId}`);
  },

  async cancelSlip(slipId) {
    return def_request(`/slips/${slipId}/cancel`, {
      method: "POST"
    });
  },

  async getLiveMatches() {
    return def_request("/matches/live");
  },

  connectWebSocket(onMessage) {
    const wsUrl = API_BASE_URL.replace(/^http/, "ws") + "/ws";
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        onMessage(msg);
      } catch (err) {
        console.error("Failed to parse WebSocket message:", err);
      }
    };

    ws.onclose = () => {
      console.log("WebSocket connection closed. Reconnecting in 5s...");
      setTimeout(() => {
        apiService.connectWebSocket(onMessage);
      }, 5000);
    };

    ws.onerror = (err) => {
      console.error("WebSocket error:", err);
    };

    return ws;
  }
};

