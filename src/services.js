import axios from "axios";

const api = axios.create({
  baseURL: "http://10.116.18.76:3000/api", // cambia si usas otro puerto
  headers: {
    "Content-Type": "application/json"
  }
});

export default api;
