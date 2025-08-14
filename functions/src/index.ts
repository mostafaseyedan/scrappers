import { setGlobalOptions } from "firebase-functions";

// Set any global function options here (applies to all exported v2 functions)
setGlobalOptions({ maxInstances: 10 });

// Side-effect import to ensure Firebase Admin is initialized once
import "./config/firebase";

// Re-export individual functions (barrel pattern)
export * from "./firestore/makeUppercase";
export * from "./schedulers/dailyMaintenance";
export * from "./http/chatgpt";

// Add future exports above this line.
