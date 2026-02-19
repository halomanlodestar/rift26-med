/** @format */
import express from "express";
import { config } from "./config/env";

const app = express();

const { PORT } = config;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
