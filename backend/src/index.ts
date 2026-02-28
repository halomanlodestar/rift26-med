/** @format */

import express from "express";
import { config } from "./config/env";
import analyzeRouter from "./routes/analyze.route";
import cors from "cors";

const app = express();

// Middleware
app.use(express.json());
app.use(
  cors({
    origin: "*",
  }),
);
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api", analyzeRouter);

const { PORT } = config;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
