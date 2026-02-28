/** @format */

import express from "express";
import { config } from "./config/env";
import analyzeRouter from "./routes/analyze.route";
import cors from "cors";

const app = express();
// will now my git bug will get fixed and i can push my code to github without any issues
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
