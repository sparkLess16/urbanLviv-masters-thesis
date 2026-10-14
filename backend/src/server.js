import dotenv from "dotenv";
import connectDB from "./config/db.js";

dotenv.config();

// app is imported after dotenv so route modules see the env variables
const { default: app } = await import("./app.js");

connectDB();

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
