import express from "express";
import { config } from "./config/env";
import analyzeRouter from "./routes/analyze.route";

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api", analyzeRouter);

const { PORT } = config;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
