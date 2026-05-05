import axios from 'axios';

const API = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '/api',
  timeout: 10000
});

// Attach JWT token to every request automatically
API.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('voting_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 responses — token expired
API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      sessionStorage.clear();
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

export const fetchBallot = () => API.get('/voter/ballot');

export const castVote = (candidateID) =>
  API.post('/vote/cast', { candidateID });

export const fetchResults = (constituencyID) =>
  API.get(`/dashboard/results/${constituencyID}`);

export const fetchStats = () => API.get('/dashboard/stats');

export const verifyTransaction = (txID) =>
  API.get(`/dashboard/transaction/${txID}`);

export const fetchBlockchain = () => API.get('/dashboard/blockchain');

export default API;
