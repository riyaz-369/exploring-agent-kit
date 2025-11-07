import dotenv from "dotenv";

dotenv.config();

export const config = {
  keys: {
    geminiApiKey: process.env.GEMINI_API_KEY,
  },
};
