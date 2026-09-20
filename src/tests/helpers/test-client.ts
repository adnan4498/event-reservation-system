import request from "supertest";
import app from "../../app.js";

export const api = () => request(app);
export const agent = () => request.agent(app);